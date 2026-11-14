"""Línea de comandos del pipeline.

    python -m pipeline historico          # una vez (y cuando cambie el método)
    python -m pipeline caminos            # una vez (y cada tanto, para actualizar OSM)
    python -m pipeline mensual --emision 2026-12 --prob-nino 0.62 --intensidad moderada
"""

import argparse
import sys
from datetime import date

from . import c3s, caminos, control_calidad, gee, indice, oni, openmeteo
from .comun import cargar_config, departamentos, escribir_json, leer_json, ruta


def cmd_historico(cfg, args):
    hoy = date.today()
    anio_hasta = hoy.year if hoy.month >= 3 else hoy.year - 1
    print("Descargando ONI de NOAA CPC…")
    serie = oni.parsear(oni.descargar(cfg["fuentes"]["oni"]))
    u = cfg["umbrales"]
    ninos = {a: i for a, i in oni.veranos_nino(serie, u["oni_umbral"], u["oni_temporadas_minimas"]).items()
             if cfg["clima"]["historico_desde"] <= a <= anio_hasta}
    print(f"Veranos Niño desde {cfg['clima']['historico_desde']}: " + ", ".join(f"{a - 1}-{str(a)[-2:]} ({i})" for a, i in sorted(ninos.items())))
    escribir_json(ruta(cfg, "intermedio", "oni.json"), {"serie": serie, "veranos_nino": ninos})

    print(f"Calculando series de verano {cfg['clima']['historico_desde']}–{anio_hasta} en Earth Engine (puede tardar varios minutos)…")
    hist = gee.historico(cfg, anio_hasta)
    escribir_json(ruta(cfg, "intermedio", "historico.json"), hist)
    resumen = indice.resumir_historico(hist, ninos, cfg)
    escribir_json(ruta(cfg, "intermedio", "historico_resumen.json"), resumen)
    print(f"Listo: {len(resumen)} departamentos en {ruta(cfg, 'intermedio')}")


def cmd_capas(cfg, args):
    """Recalcula solo las capas fijas (relieve, bosque, población) sin repetir las series anuales."""
    p = ruta(cfg, "intermedio", "historico.json")
    try:
        hist = leer_json(p)
        ninos = {int(k): v for k, v in leer_json(ruta(cfg, "intermedio", "oni.json"))["veranos_nino"].items()}
    except FileNotFoundError:
        sys.exit("Falta el histórico. Corré antes `python -m pipeline historico`.")
    print("Recalculando relieve (HAND), pérdida de bosque y población en Earth Engine…")
    for d, v in gee.capas_fijas(cfg).items():
        hist["departamentos"][d].update(v)
    escribir_json(p, hist)
    resumen = indice.resumir_historico(hist, ninos, cfg)
    escribir_json(ruta(cfg, "intermedio", "historico_resumen.json"), resumen)
    hs = sorted(v["hand_medio"] for v in resumen.values())
    print(f"Listo. Altura media sobre el drenaje: de {hs[0]:.1f} m a {hs[-1]:.1f} m según el departamento.")


def cmd_caminos(cfg, args):
    print("Descargando caminos de OpenStreetMap (Overpass)…")
    tot, geo = caminos.resumir(cfg, caminos.descargar(cfg))
    escribir_json(ruta(cfg, "intermedio", "caminos.json"), tot)
    escribir_json(ruta(cfg, "intermedio", "caminos_rurales.geojson"), geo, indent=None)
    csv_ee = ruta(cfg, "intermedio", "caminos_rurales_ee.csv")
    caminos.a_csv_wkt(geo, csv_ee)
    km = sum(v["km_rurales"] for v in tot.values())
    print(f"Listo: {km:,.0f} km de caminos rurales. Para medir caminos con agua, subí {csv_ee} "
          "como asset de tabla en Earth Engine y anotá su ruta en gee.asset_caminos (ver PIPELINE.md).")


def _mes_anterior(anio, mes):
    return (anio - 1, 12) if mes == 1 else (anio, mes - 1)


def _agua(cfg, anio, mes):
    p = ruta(cfg, "intermedio", f"agua_{anio}-{mes:02d}.json")
    try:
        return leer_json(p)
    except FileNotFoundError:
        print(f"Midiendo agua observada {anio}-{mes:02d} con Sentinel-1…")
        datos = gee.agua_observada(cfg, anio, mes, cfg["gee"].get("asset_caminos"))
        escribir_json(p, datos)
        return datos


def cmd_mensual(cfg, args):
    anio, mes = map(int, args.emision.split("-"))
    anio_final = args.anio_objetivo or (anio + 1 if mes >= 3 else anio)
    try:
        hist = leer_json(ruta(cfg, "intermedio", "historico_resumen.json"))
        tramos = leer_json(ruta(cfg, "intermedio", "caminos.json"))
        ninos = {int(k): v for k, v in leer_json(ruta(cfg, "intermedio", "oni.json"))["veranos_nino"].items()}
    except FileNotFoundError as e:
        sys.exit(f"Falta {e.filename}. Corré antes `python -m pipeline historico` y `python -m pipeline caminos`.")

    fuente = cfg.get("pronostico", {}).get("fuente", "openmeteo")
    temporada = f"{cfg['estacion']['nombre']} {anio_final - 1}-{anio_final}"
    if fuente == "c3s":
        print(f"Pronóstico C3S iniciado en {args.emision} para {temporada}…")
        pron = c3s.pronostico(cfg, anio, mes, anio_final, ruta(cfg, "intermedio", "c3s"))
    else:
        print(f"Pronóstico ECMWF SEAS5 vía Open-Meteo para {temporada}…")
        pron = openmeteo.pronostico(cfg, anio_final)
    escribir_json(ruta(cfg, "intermedio", f"pronostico_{args.emision}.json"), pron)

    a_ag, m_ag = _mes_anterior(anio, mes) if not args.mes_agua else map(int, args.mes_agua.split("-"))
    agua = _agua(cfg, a_ag, m_ag)
    agua_prev = _agua(cfg, *_mes_anterior(a_ag, m_ag))

    em = indice.construir(cfg, emision=args.emision, anio_final=anio_final, prob_nino=args.prob_nino,
                          intensidad=args.intensidad, hist=hist, caminos=tramos, c3s=pron, agua=agua,
                          agua_anterior=agua_prev, veranos_nino=ninos)

    publicacion = ruta(cfg, "publicacion")
    anterior = None
    try:
        actual = leer_json(publicacion / "emision-actual.json")
        anterior = leer_json(publicacion / actual["archivo"])
        if anterior.get("demo"):
            anterior = None
    except FileNotFoundError:
        pass
    ids = [f["id"] for f in departamentos(cfg)["features"]]
    errores, avisos = control_calidad.revisar(em, ids, anterior, cfg["control_calidad"]["saltos_maximos_categoria"])
    for a in avisos:
        print("AVISO:", a)
    if errores:
        for e in errores:
            print("ERROR:", e)
        borr = ruta(cfg, "intermedio", f"emision-{args.emision}-rechazada.json")
        escribir_json(borr, em)
        sys.exit(f"La emisión no pasó el control de calidad. Quedó en {borr} para revisar.")

    if args.borrador:
        destino = ruta(cfg, "intermedio", f"emision-{args.emision}-borrador.json")
        escribir_json(destino, em)
        print(f"Borrador listo en {destino}. No se publicó.")
        return
    archivo = f"emision-{args.emision}.json"
    escribir_json(publicacion / archivo, em)
    escribir_json(publicacion / "emision-actual.json", {"emision": args.emision, "archivo": archivo, "demo": False}, indent=None)
    print(f"Emisión {args.emision} publicada en {publicacion}. Revisá la web local y subí los cambios con git.")


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m pipeline", description="Pipeline del SIG El Niño Argentina")
    p.add_argument("--config", help="ruta a otro config.yaml")
    sub = p.add_subparsers(dest="comando", required=True)
    sub.add_parser("historico", help="series históricas y compuestos Niño (Earth Engine + ONI)")
    sub.add_parser("capas", help="recalcula solo relieve, bosque y población (sin repetir las series)")
    sub.add_parser("caminos", help="red de caminos de OpenStreetMap por departamento")
    m = sub.add_parser("mensual", help="emisión del mes (pronóstico SEAS5 + Sentinel-1 + índices)")
    m.add_argument("--emision", required=True, help="AAAA-MM, mes de la emisión")
    m.add_argument("--prob-nino", required=True, type=float, help="probabilidad oficial de El Niño para el trimestre (0–1), de IRI/CPC")
    m.add_argument("--intensidad", default="sin definir", help="intensidad esperada según IRI/CPC (débil, moderada, fuerte)")
    m.add_argument("--anio-objetivo", type=int, help="año del febrero del trimestre objetivo (por defecto, el próximo verano)")
    m.add_argument("--mes-agua", help="AAAA-MM del agua observada (por defecto, el mes anterior a la emisión)")
    m.add_argument("--borrador", action="store_true", help="no publica: deja el resultado en pipeline/datos")
    args = p.parse_args(argv)
    cfg = cargar_config(args.config)
    {"historico": cmd_historico, "capas": cmd_capas, "caminos": cmd_caminos, "mensual": cmd_mensual}[args.comando](cfg, args)


if __name__ == "__main__":
    main()
