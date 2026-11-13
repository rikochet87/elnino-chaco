"""Pruebas del pipeline que no necesitan cuentas ni conexión."""

import json
import random
from pathlib import Path

import numpy as np
import pytest
import xarray as xr

from pipeline import c3s, caminos, compuestos, control_calidad, indice, oni, otsu
from pipeline.comun import RAIZ, anios_estacion, cargar_config, departamentos

CFG = cargar_config()
IDS = [f["id"] for f in departamentos(CFG)["features"]]


# --- Estación -----------------------------------------------------------------

def test_anios_estacion_def():
    assert anios_estacion(2016, [12, 1, 2]) == [(2015, 12), (2016, 1), (2016, 2)]


def test_anios_estacion_sin_cambio_de_anio():
    assert anios_estacion(2020, [6, 7, 8]) == [(2020, 6), (2020, 7), (2020, 8)]


# --- ONI ----------------------------------------------------------------------

def _texto_oni(valores):
    lineas = ["   SEAS  YR   TOTAL   ANOM"]
    anio, i = 1996, 0
    for v in valores:
        t = oni.TEMPORADAS[i % 12]
        lineas.append(f"   {t} {anio + (i // 12)}   27.00   {v:5.2f}")
        i += 1
    return "\n".join(lineas)


def test_oni_parsea_y_clasifica():
    # 1996: neutral; desde AMJ 1997 hasta MAM 1998 Niño con pico 2,4
    vals = [0.0] * 12 + [-0.4, -0.2, 0.1, 0.3, 0.8, 1.2, 1.6, 1.9, 2.2, 2.4, 2.4, 2.2] + [1.9, 1.4, 1.0, 0.5, 0.0, -0.6] + [-1.0] * 6
    serie = oni.parsear(_texto_oni(vals))
    assert serie[0] == {"temporada": "DJF", "anio": 1996, "anom": 0.0}
    v = oni.veranos_nino(serie)
    assert v == {1998: "muy fuerte"}


def test_oni_descarta_episodios_cortos():
    vals = [0.0, 0.6, 0.7, 0.6, 0.6, 0.0] + [0.0] * 6
    assert oni.episodios(oni.parsear(_texto_oni(vals))) == []


def test_oni_formato_desconocido():
    with pytest.raises(ValueError):
        oni.parsear("<html>error</html>")


# --- Compuestos ---------------------------------------------------------------

def test_compuestos_lluvia():
    serie = {a: 400.0 for a in range(1982, 2025)}
    serie[1983], serie[1998], serie[2016] = 600.0, 560.0, 380.0
    r = compuestos.resumen(serie, [1983, 1998, 2016], (1991, 2020), relativo=True)
    assert r["normal"] == pytest.approx((400 * 28 + 560 + 380) / 30)
    assert r["consistencia"] == pytest.approx(2 / 3)
    assert r["anom_nino"] > 0


def test_compuestos_referencia_incompleta():
    with pytest.raises(ValueError):
        compuestos.resumen({2000: 1.0}, [2000], (1991, 2020), relativo=False)


# --- Otsu ---------------------------------------------------------------------

def test_otsu_separa_dos_modos():
    centros = [x / 10 for x in range(-300, 0)]
    conteos = [2000 * np.exp(-((c + 22) ** 2) / 2) + 15000 * np.exp(-((c + 10) ** 2) / 4) for c in centros]
    u = otsu.umbral(centros, conteos)
    assert -19 < u < -13


# --- C3S ----------------------------------------------------------------------

def test_plazos_noviembre_para_def():
    assert c3s.plazos(11, 2026, [12, 1, 2], 2027) == [2, 3, 4]


def test_plazos_fuera_de_alcance():
    with pytest.raises(ValueError):
        c3s.plazos(1, 2027, [12, 1, 2], 2027)


def _nc(tmp_path, nombre, inicios, miembros, valor):
    lat = np.arange(-29.0, -22.0, 1.0)
    lon = np.arange(-64.0, -57.0, 1.0)
    rng = np.random.default_rng(len(inicios))
    datos = valor + rng.normal(0, 1e-9, size=(len(miembros), len(inicios), 3, lat.size, lon.size))
    ds = xr.Dataset(
        {"tprate": (("number", "forecast_reference_time", "forecastMonth", "latitude", "longitude"), datos)},
        coords={"number": miembros, "forecast_reference_time": inicios, "forecastMonth": [2, 3, 4], "latitude": lat, "longitude": lon},
    )
    p = tmp_path / nombre
    ds.to_netcdf(p)
    return p


def test_c3s_probabilidades_humedo(tmp_path):
    hind = _nc(tmp_path, "h.nc", list(range(24)), list(range(25)), 4e-8)
    pron = _nc(tmp_path, "p.nc", [0], list(range(51)), 6e-8)  # todo el pronóstico por encima del hindcast
    h = c3s.acumulado_estacion(c3s._abrir(hind), [2, 3, 4], 11)
    p = c3s.acumulado_estacion(c3s._abrir(pron), [2, 3, 4], 11)
    sup, nor, inf = c3s.probabilidades(h, p)
    res = c3s.por_departamento(CFG, sup, nor, inf)
    assert set(res) == set(IDS)
    assert all(v["prob_superior"] == 1.0 and v["prob_inferior"] == 0.0 for v in res.values())


# --- Caminos ------------------------------------------------------------------

def test_caminos_por_departamento():
    # Un camino rural de ~10 km dentro de San Fernando, cerca de Resistencia
    osm = {"elements": [
        {"type": "way", "tags": {"highway": "track"}, "geometry": [{"lon": -59.10, "lat": -27.70}, {"lon": -59.00, "lat": -27.70}]},
        {"type": "way", "tags": {"highway": "primary"}, "geometry": [{"lon": -59.10, "lat": -27.75}, {"lon": -59.05, "lat": -27.75}]},
    ]}
    tot, geo = caminos.resumir(CFG, osm)
    sf = tot["san-fernando"]
    assert 9 < sf["km_rurales"] < 11
    assert 14 < sf["km_total"] < 16
    assert 0.6 < sf["prop_rural"] < 0.7
    assert len(geo["features"]) == 1


def test_caminos_csv_para_earth_engine(tmp_path):
    geo = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"tipo": "track"}, "geometry": {"type": "LineString", "coordinates": [[-59.1, -27.7], [-59.0, -27.7]]}}]}
    p = tmp_path / "c.csv"
    caminos.a_csv_wkt(geo, p)
    lineas = p.read_text(encoding="utf-8").splitlines()
    assert lineas[0] == "tipo,WKT"
    assert lineas[1].startswith('track,"LINESTRING (-59.1 -27.7')


# --- Índices y control de calidad ---------------------------------------------

def _entradas(semilla=1):
    rnd = random.Random(semilla)
    hist = {d: {
        "lluvia_normal_mm": rnd.uniform(300, 500), "anom_nino_pct": rnd.uniform(-5, 40), "consistencia": rnd.uniform(0.4, 1),
        "noches_normal": rnd.uniform(10, 50), "noches_anom_nino": rnd.uniform(-5, 5),
        "aptos_normal": rnd.uniform(60, 90), "aptos_anom_nino": rnd.uniform(-3, 3),
        "frac_zona_baja": rnd.uniform(0.05, 0.6), "perdida_bosque_pct": rnd.uniform(0, 40),
        "poblacion": rnd.uniform(5000, 400000), "n_nino": 12,
    } for d in IDS}
    tramos = {d: {"km_total": 1000.0, "km_rurales": rnd.uniform(200, 900), "prop_rural": rnd.uniform(0.3, 0.9)} for d in IDS}
    probs = {}
    for d in IDS:
        s = round(rnd.uniform(0.3, 0.6), 2)
        i = round(rnd.uniform(0.1, 0.3), 2)
        probs[d] = {"prob_superior": s, "prob_normal": round(1 - s - i, 2), "prob_inferior": i}
    pron = {"sistema": "ecmwf SEAS5 sistema 51", "inicio": "2026-11", "plazos": [2, 3, 4], "departamentos": probs}
    agua = {"fecha_ultima_imagen": "2026-10-29", "umbral_db": -17.2, "imagenes": 9,
            "departamentos": {d: {"km2": rnd.uniform(0, 80), "km_caminos": None} for d in IDS}}
    return hist, tramos, pron, agua


def _construir(semilla=1):
    hist, tramos, pron, agua = _entradas(semilla)
    return indice.construir(CFG, emision="2026-11", anio_final=2027, prob_nino=0.6, intensidad="moderada",
                            hist=hist, caminos=tramos, c3s=pron, agua=agua, agua_anterior=agua, veranos_nino={1998: "muy fuerte"})


def _claves(d, prefijo=""):
    out = set()
    for k, v in d.items():
        out.add(prefijo + k)
        if isinstance(v, dict) and k not in ("departamentos",):
            out |= _claves(v, prefijo + k + ".")
    return out


def test_emision_tiene_el_esquema_de_la_web():
    em = _construir()
    demo = json.loads((RAIZ / "docs" / "data" / "emision-2026-11.json").read_text(encoding="utf-8"))
    d_demo = next(iter(demo["departamentos"].values()))
    d_real = em["departamentos"]["san-fernando"]
    falta = _claves(d_demo) - _claves(d_real)
    assert not falta, f"Faltan campos que usa la web: {falta}"
    for k in ("emision", "trimestre", "trimestre_texto", "prob_nino", "proxima_emision", "metodo"):
        assert k in em
    assert em["agua_obs"]["fecha_imagen"] and em["agua_obs"]["umbral_db"]
    assert em["trimestre"] == "DEF 2026-27"
    assert em["proxima_emision"] == "2026-12"
    assert em["demo"] is False


def test_quintiles_cinco_por_clase():
    em = _construir()
    for mod in ("anegamiento", "dengue", "calor"):
        cats = [v[mod]["categoria"] for v in em["departamentos"].values()]
        assert sorted(cats) == sorted([c for c in range(1, 6) for _ in range(5)])


def test_r_es_media_geometrica():
    # H, E y V se publican redondeados a 3 decimales: se tolera ese error al recomputar.
    em = _construir()
    for v in em["departamentos"].values():
        a = v["anegamiento"]
        assert a["R"] == pytest.approx((a["H"] * a["E"] * a["V"]) ** (1 / 3), rel=0.05, abs=5e-3)


def test_control_calidad_aprueba_emision_valida():
    errores, avisos = control_calidad.revisar(_construir(), IDS)
    assert errores == []
    assert any("caminos" in a for a in avisos)


def test_control_calidad_detecta_problemas():
    em = _construir()
    del em["departamentos"]["bermejo"]
    em["departamentos"]["san-fernando"]["lluvia"]["prob_superior"] = 0.9
    errores, _ = control_calidad.revisar(em, IDS)
    assert any("bermejo" in e for e in errores)
    assert any("suman" in e for e in errores)


def test_control_calidad_avisa_saltos():
    em, previa = _construir(1), _construir(1)
    previa["emision"] = "2026-10"
    em["departamentos"]["bermejo"]["anegamiento"]["categoria"] = 5
    previa["departamentos"]["bermejo"]["anegamiento"]["categoria"] = 1
    _, avisos = control_calidad.revisar(em, IDS, previa)
    assert any("bermejo" in a and "4 categorías" in a for a in avisos)


def test_faltan_entradas():
    hist, tramos, pron, agua = _entradas()
    del tramos["bermejo"]
    with pytest.raises(ValueError, match="bermejo"):
        indice.construir(CFG, emision="2026-11", anio_final=2027, prob_nino=0.6, intensidad="x",
                         hist=hist, caminos=tramos, c3s=pron, agua=agua, agua_anterior=None, veranos_nino={})
