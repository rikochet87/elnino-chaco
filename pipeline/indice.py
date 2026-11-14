"""Combina las entradas procesadas en una emisión con el esquema que lee la web.

Fórmulas (versión 0.1, a calibrar):

Anegamiento y caminos
    H = P(Niño)·(w1·Â + w2·C) + w3·F       (escala fija 0–1, sin min-max)
        Â: anomalía de lluvia de verano en años Niño / anom_lluvia_max_pct, recortada a [0, 1]
        C: consistencia de signo de esa anomalía (0–1)
        F: probabilidad de lluvia superior a lo normal según ECMWF SEAS5 (0–1)
    E = norm( densidad de caminos rurales, km/km² )
    V = norm( media de: relieve bajo (inverso de la altura media HAND), pérdida de bosque nativo )
    R = (H·E·V)^(1/3); categorías por quintiles.

Dengue (condiciones climáticas para el vector, no casos)
    Hd = sqrt( norm(días aptos normales + P·anomalía Niño) · norm(P·Â + F̂) )
    índice = norm( sqrt(Hd · norm(población)) )

Calor (calor húmedo nocturno)
    Hc = norm( noches tropicales normales + P·anomalía Niño )
    índice = norm( sqrt(Hc · norm(población)) )

norm(): min-max sobre los departamentos del área, al rango [piso, 1].
"""

from datetime import date

from pyproj import Geod
from shapely.geometry import shape

from . import compuestos
from .comun import departamentos


def areas_km2(cfg: dict) -> dict:
    g = Geod(ellps="WGS84")
    return {f["id"]: abs(g.geometry_area_perimeter(shape(f["geometry"]))[0]) / 1e6 for f in departamentos(cfg)["features"]}


def norm(valores: dict, piso: float = 0.01) -> dict:
    lo, hi = min(valores.values()), max(valores.values())
    if hi == lo:
        return {k: 0.5 for k in valores}
    return {k: piso + (v - lo) / (hi - lo) * (1 - piso) for k, v in valores.items()}


def quintiles(valores: dict) -> dict:
    orden = sorted(valores, key=lambda k: (valores[k], k))
    n = len(orden)
    return {k: min(5, i * 5 // n + 1) for i, k in enumerate(orden)}


def etiqueta_trimestre(nombre: str, anio_final: int) -> str:
    return f"{nombre} {anio_final - 1}-{str(anio_final)[-2:]}"


def mes_siguiente(emision: str) -> str:
    a, m = map(int, emision.split("-"))
    return f"{a + (m == 12)}-{m % 12 + 1:02d}"


def resumir_historico(historico: dict, veranos_nino: dict, cfg: dict) -> dict:
    """Normales y compuestos Niño por departamento."""
    ref = tuple(cfg["clima"]["referencia"])
    anios = sorted(veranos_nino)
    salida = {}
    for d, s in historico["departamentos"].items():
        ll = compuestos.resumen(s["lluvia_mm"], anios, ref, relativo=True)
        nt = compuestos.resumen(s["noches_tropicales"], anios, ref, relativo=False)
        da = compuestos.resumen(s["dias_aptos_dengue"], anios, ref, relativo=False)
        salida[d] = {
            "lluvia_normal_mm": ll["normal"], "anom_nino_pct": ll["anom_nino"], "consistencia": ll["consistencia"],
            "noches_normal": nt["normal"], "noches_anom_nino": nt["anom_nino"],
            "aptos_normal": da["normal"], "aptos_anom_nino": da["anom_nino"],
            "frac_zona_baja": s["frac_zona_baja"], "hand_medio": s.get("hand_medio"),
            "perdida_bosque_pct": s["perdida_bosque_pct"],
            "poblacion": s["poblacion"], "n_nino": ll["n_nino"],
        }
    return salida


def construir(cfg: dict, *, emision: str, anio_final: int, prob_nino: float, intensidad: str,
              hist: dict, caminos: dict, c3s: dict, agua: dict, agua_anterior: dict | None,
              veranos_nino: dict) -> dict:
    """Arma la emisión completa. `hist` es la salida de resumir_historico()."""
    w = cfg["indice"]["pesos"]
    piso = cfg["indice"]["piso_normalizacion"]
    P = prob_nino
    ids = sorted(hist)
    faltan = [d for d in ids if d not in caminos or d not in c3s["departamentos"] or d not in agua["departamentos"]]
    if faltan:
        raise ValueError(f"Faltan entradas para: {', '.join(faltan)}")

    n = lambda vals: norm(vals, piso)
    A = n({d: hist[d]["anom_nino_pct"] for d in ids})
    F = n({d: c3s["departamentos"][d]["prob_superior"] for d in ids})
    # La amenaza va en escala fija (no min-max): si el pronóstico da ~95 % de lluvia superior
    # en todos lados, la amenaza es alta en todos lados y no se inventan diferencias.
    tope = cfg["indice"].get("anom_lluvia_max_pct", 30)
    A_fija = {d: min(max(hist[d]["anom_nino_pct"], 0) / tope, 1.0) for d in ids}
    H = {d: max(piso, P * (w["w1"] * A_fija[d] + w["w2"] * hist[d]["consistencia"])
                + w["w3"] * c3s["departamentos"][d]["prob_superior"]) for d in ids}
    # Exposición por densidad (km de camino rural por km²): con km totales, los departamentos
    # más grandes salían primeros solo por tamaño.
    area = areas_km2(cfg)
    dens = {d: caminos[d]["km_rurales"] / area[d] for d in ids}
    E = n(dens)
    # Zonas bajas: con la altura media sobre el drenaje (HAND), menor altura = más vulnerable.
    if all(hist[d].get("hand_medio") is not None for d in ids):
        baja = n({d: -hist[d]["hand_medio"] for d in ids})
    else:
        baja = n({d: hist[d]["frac_zona_baja"] for d in ids})
    bosque = n({d: hist[d]["perdida_bosque_pct"] for d in ids})
    V = n({d: (baja[d] + bosque[d]) / 2 for d in ids})
    R = {d: (H[d] * E[d] * V[d]) ** (1 / 3) for d in ids}

    pob = n({d: hist[d]["poblacion"] for d in ids})
    humedad = n({d: P * A[d] + F[d] for d in ids})
    aptos = n({d: hist[d]["aptos_normal"] + P * hist[d]["aptos_anom_nino"] for d in ids})
    dengue = n({d: ((aptos[d] * humedad[d]) ** 0.5 * pob[d]) ** 0.5 for d in ids})
    noches = n({d: hist[d]["noches_normal"] + P * hist[d]["noches_anom_nino"] for d in ids})
    calor = n({d: (noches[d] * pob[d]) ** 0.5 for d in ids})

    cR, cD, cC = quintiles(R), quintiles(dengue), quintiles(calor)
    deptos = {}
    for d in ids:
        p = c3s["departamentos"][d]
        a = agua["departamentos"][d]
        previo = (agua_anterior or {}).get("departamentos", {}).get(d, {}).get("km2")
        deptos[d] = {
            "lluvia": {
                "prob_superior": p["prob_superior"], "prob_normal": p.get("prob_normal"), "prob_inferior": p["prob_inferior"],
                "anom_pronostico_pct": p.get("anom_pronostico_pct"),
                "normal_mm": int(round(hist[d]["lluvia_normal_mm"] / 10) * 10),
                "anom_nino_pct": int(round(hist[d]["anom_nino_pct"])),
            },
            "anegamiento": {
                "H": round(H[d], 3), "E": round(E[d], 3), "V": round(V[d], 3), "R": round(R[d], 3),
                "categoria": cR[d], "perdida_bosque_pct": round(hist[d]["perdida_bosque_pct"], 1),
            },
            "dengue": {"indice": round(dengue[d], 3), "categoria": cD[d]},
            "calor": {"indice": round(calor[d], 3), "categoria": cC[d]},
            "agua_obs": {
                "km2": a["km2"],
                "km2_mes_anterior": previo,
                "km_caminos": a.get("km_caminos"),
            },
            "componentes": {
                "consistencia": round(hist[d]["consistencia"], 2),
                "frac_zona_baja": round(hist[d]["frac_zona_baja"], 3),
                "hand_medio_m": None if hist[d].get("hand_medio") is None else round(hist[d]["hand_medio"], 2),
                "km_caminos_rurales": caminos[d]["km_rurales"],
                "km_rurales_por_km2": round(dens[d], 3),
                "area_km2": round(area[d]),
                "prop_caminos_rurales": round(caminos[d]["prop_rural"], 3),
                "poblacion": int(round(hist[d]["poblacion"])),
                "noches_tropicales_normal": round(hist[d]["noches_normal"], 1),
                "noches_tropicales_anom_nino": round(hist[d]["noches_anom_nino"], 1),
                "dias_aptos_dengue_normal": round(hist[d]["aptos_normal"], 1),
                "dias_aptos_dengue_anom_nino": round(hist[d]["aptos_anom_nino"], 1),
            },
        }

    return {
        "demo": False,
        "emision": emision,
        "publicada": date.today().isoformat(),
        "proxima_emision": mes_siguiente(emision),
        "trimestre": etiqueta_trimestre(cfg["estacion"]["nombre"], anio_final),
        "trimestre_texto": cfg["estacion"]["texto"],
        "prob_nino": prob_nino,
        "intensidad": intensidad,
        "agua_obs": {
            "fecha_imagen": agua["fecha_ultima_imagen"],
            "sensor": "Sentinel-1 (radar)",
            "umbral_db": agua["umbral_db"],
            "imagenes": agua["imagenes"],
        },
        "pronostico": {k: v for k, v in c3s.items() if k != "departamentos"},
        "veranos_nino": {str(k): v for k, v in sorted(veranos_nino.items())},
        "metodo": {
            "version": "0.1",
            "pesos": w,
            "agregacion": "media geométrica (H·E·V)^(1/3)",
            "normalizacion": f"min-max {str(piso).replace('.', ',')}–1 sobre los departamentos del área",
            "categorias": "quintiles",
        },
        "departamentos": deptos,
    }
