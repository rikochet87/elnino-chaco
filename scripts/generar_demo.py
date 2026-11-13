"""Genera una emisión de DEMOSTRACIÓN con valores ilustrativos.

Los valores NO provienen de datos climáticos: siguen un gradiente geográfico
simple (este más húmedo, oeste más caluroso) para poder probar la web.
El archivo resultante tiene el mismo esquema que producirá el pipeline real,
así que reemplazarlo no requiere cambiar la web.

Uso:
    python scripts/generar_demo.py
"""

import hashlib
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "docs" / "data"

EMISION = "2026-11"
W1, W2, W3 = 0.4, 0.2, 0.4  # pesos iniciales del documento de arquitectura
PROB_NINO = 0.62            # valor ilustrativo


def ruido(clave: str, escala: float) -> float:
    """Ruido determinístico en [-escala, escala] a partir de un texto."""
    h = int(hashlib.sha256(clave.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return (h * 2 - 1) * escala


def minmax(valores: dict, piso: float = 0.01) -> dict:
    lo, hi = min(valores.values()), max(valores.values())
    return {k: round(piso + (v - lo) / (hi - lo) * (1 - piso), 3) for k, v in valores.items()}


def quintiles(valores: dict) -> dict:
    orden = sorted(valores, key=valores.get)
    n = len(orden)
    return {k: min(5, i * 5 // n + 1) for i, k in enumerate(orden)}


def main() -> None:
    deptos = json.loads((DATA / "departamentos.geojson").read_text(encoding="utf-8"))["features"]
    lons = [f["properties"]["centro"][0] for f in deptos]
    lats = [f["properties"]["centro"][1] for f in deptos]
    lo_x, hi_x, lo_y, hi_y = min(lons), max(lons), min(lats), max(lats)

    base, A, C, F, E, V, dengue, calor = {}, {}, {}, {}, {}, {}, {}, {}
    for f in deptos:
        i = f["id"]
        x = (f["properties"]["centro"][0] - lo_x) / (hi_x - lo_x)  # 0 oeste, 1 este
        y = (f["properties"]["centro"][1] - lo_y) / (hi_y - lo_y)  # 0 sur, 1 norte
        base[i] = (x, y)
        A[i] = 10 + 25 * x + ruido(i + "a", 4)            # anomalía Niño histórica, %
        C[i] = 0.55 + 0.3 * x + ruido(i + "c", 0.05)      # consistencia de signo
        F[i] = 0.40 + 0.20 * x + ruido(i + "f", 0.03)     # prob. lluvia superior (C3S)
        E[i] = 0.5 + ruido(i + "e", 0.35)                 # exposición
        V[i] = 0.35 + 0.4 * x + ruido(i + "v", 0.12)      # vulnerabilidad
        dengue[i] = 0.5 * x + 0.3 * y + ruido(i + "d", 0.1) + (0.25 if i == "san-fernando" else 0)
        calor[i] = 0.6 * (1 - x) + 0.3 * y + ruido(i + "t", 0.08)

    An, Fn = minmax(A), minmax(F)
    H = {i: PROB_NINO * (W1 * An[i] + W2 * C[i]) + W3 * Fn[i] for i in A}
    Hn, En, Vn = minmax(H), minmax(E), minmax(V)
    R = {i: round((Hn[i] * En[i] * Vn[i]) ** (1 / 3), 3) for i in A}
    cat_r, cat_d, cat_c = quintiles(R), quintiles(dengue), quintiles(calor)
    Dn, Cn = minmax(dengue), minmax(calor)

    salida = {}
    for f in deptos:
        i = f["id"]
        x, y = base[i]
        sup = round(F[i], 2)
        inf = round(0.20 - 0.08 * x, 2)
        km2 = round(4 + 110 * x * x * R[i] + ruido(i + "w", 3), 1)
        salida[i] = {
            "lluvia": {
                "prob_superior": sup,
                "prob_normal": round(1 - sup - inf, 2),
                "prob_inferior": inf,
                "normal_mm": int(round((330 + 150 * x + ruido(i + "mm", 15)) / 10) * 10),
                "anom_nino_pct": int(round(A[i])),
            },
            "anegamiento": {
                "H": Hn[i], "E": En[i], "V": Vn[i], "R": R[i],
                "categoria": cat_r[i],
                "perdida_bosque_pct": round(4 + 22 * (1 - x) * (0.5 + y) + ruido(i + "b", 3), 1),
            },
            "dengue": {"indice": Dn[i], "categoria": cat_d[i]},
            "calor": {"indice": Cn[i], "categoria": cat_c[i]},
            "agua_obs": {
                "km2": max(km2, 0.5),
                "km2_mes_anterior": max(round(km2 * (0.8 + ruido(i + "p", 0.15)), 1), 0.3),
                "km_caminos": round(max(km2, 0.5) * 0.45, 1),
            },
        }

    emision = {
        "demo": True,
        "aviso": "Datos de demostración: los valores son ilustrativos y no provienen de pronósticos ni observaciones reales.",
        "emision": EMISION,
        "publicada": "2026-11-13",
        "proxima_emision": "2026-12",
        "trimestre": "DEF 2026-27",
        "trimestre_texto": "diciembre a febrero",
        "prob_nino": PROB_NINO,
        "intensidad": "moderada",
        "agua_obs": {"fecha_imagen": "2026-11-08", "sensor": "Sentinel-1 (radar)", "umbral_db": -17.5},
        "metodo": {
            "pesos": {"w1": W1, "w2": W2, "w3": W3},
            "agregacion": "media geométrica (H·E·V)^(1/3)",
            "normalizacion": "min-max 0,01–1 sobre los departamentos del área",
            "categorias": "quintiles",
        },
        "departamentos": salida,
    }
    (DATA / f"emision-{EMISION}.json").write_text(
        json.dumps(emision, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    (DATA / "emision-actual.json").write_text(
        json.dumps({"emision": EMISION, "archivo": f"emision-{EMISION}.json", "demo": True}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Emisión demo {EMISION} escrita para {len(salida)} departamentos")


if __name__ == "__main__":
    main()
