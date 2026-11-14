"""Pronóstico estacional de lluvia ECMWF SEAS5 vía la API de Open-Meteo (sin cuenta).

Método
------
- Consulta diaria con los 51 miembros del ensamble (`precipitation_sum` = control y
  `precipitation_sum_member01..50`), en el punto representativo de cada departamento.
- Consulta mensual con la media del ensamble y su anomalía respecto de la
  climatología del modelo (hindcast del ECMWF): climatología = media − anomalía.
- Para el trimestre objetivo se suma la lluvia de cada miembro y la climatología de
  los mismos días (un mes cubierto en parte aporta su climatología en proporción).
- prob_superior = fracción de miembros por encima de la climatología del modelo.

Son dos categorías (por encima o por debajo de lo normal del modelo), no terciles.
Datos: Open-Meteo.com (CC BY 4.0), basados en ECMWF SEAS5.
"""

import calendar
from collections import defaultdict
from datetime import date, timedelta

import requests

from .comun import anios_estacion, departamentos

URL = "https://seasonal-api.open-meteo.com/v1/seasonal"
MODELO = "ecmwf_seas5"


def _pedir(params: dict) -> list:
    r = requests.get(URL, params=params, timeout=120, headers={"User-Agent": "sig-el-nino-argentina"})
    if r.status_code != 200:
        try:
            motivo = r.json().get("reason")
        except ValueError:
            motivo = r.text[:200]
        raise RuntimeError(f"Open-Meteo respondió {r.status_code}: {motivo}")
    datos = r.json()
    return datos if isinstance(datos, list) else [datos]


def descargar(puntos: list[tuple[float, float]], dias: int = 215) -> tuple[list, list]:
    """Devuelve (respuestas diarias, respuestas mensuales), una por punto y en el mismo orden."""
    base = {
        "latitude": ",".join(f"{lat:.4f}" for lon, lat in puntos),
        "longitude": ",".join(f"{lon:.4f}" for lon, lat in puntos),
        "models": MODELO,
        # Sin zona horaria (UTC): con la de Argentina los meses aparecen corridos un día
        # ("2026-11-30" en lugar de "2026-12-01").
    }
    diaria = _pedir({**base, "daily": "precipitation_sum", "forecast_days": dias})
    mensual = _pedir({**base, "monthly": "precipitation_mean,precipitation_anomaly"})
    if len(diaria) != len(puntos) or len(mensual) != len(puntos):
        raise RuntimeError("Open-Meteo devolvió una cantidad de puntos distinta de la pedida")
    return diaria, mensual


def _mes_de(fecha: str) -> tuple[int, int]:
    """Mes al que pertenece un valor mensual de Open-Meteo.

    En UTC llega como el primer día del mes ("2026-12-01"); con una zona horaria al
    oeste de Greenwich llega como el último día del mes anterior ("2026-11-30").
    """
    d = date.fromisoformat(fecha[:10])
    if d.day != 1:
        d = d + timedelta(days=1)
        if d.day != 1:
            raise RuntimeError(f"Fecha mensual inesperada en Open-Meteo: {fecha}")
    return d.year, d.month


def resumir_punto(diaria: dict, mensual: dict, meses_obj: list[tuple[int, int]], cobertura_minima: float = 0.6) -> dict:
    """Probabilidades y anomalía del trimestre para un punto."""
    d = diaria["daily"]
    miembros = [k for k in d if k == "precipitation_sum" or k.startswith("precipitation_sum_member")]
    if len(miembros) < 20:
        raise RuntimeError(f"Se esperaban 51 miembros y llegaron {len(miembros)}")
    objetivo = {(a, m) for a, m in meses_obj}

    # Días pronosticados por mes objetivo y suma por miembro
    dias_mes = defaultdict(int)
    totales = {k: 0.0 for k in miembros}
    for i, t in enumerate(d["time"]):
        a, m = int(t[:4]), int(t[5:7])
        if (a, m) not in objetivo:
            continue
        valores = [d[k][i] for k in miembros]
        if any(v is None for v in valores):
            continue
        dias_mes[(a, m)] += 1
        for k, v in zip(miembros, valores):
            totales[k] += v

    # Climatología del modelo para esos mismos días
    mm = mensual["monthly"]
    clima, dias_cubiertos, dias_totales = 0.0, 0, 0
    for (a, m) in meses_obj:
        largo = calendar.monthrange(a, m)[1]
        dias_totales += largo
        n = dias_mes.get((a, m), 0)
        if n == 0:
            continue
        meses_api = [_mes_de(x) for x in mm["time"]]
        if (a, m) not in meses_api:
            raise RuntimeError(f"Falta la media mensual de {a}-{m:02d} en Open-Meteo (llegaron: {', '.join(mm['time'])})")
        j = meses_api.index((a, m))
        clima += (mm["precipitation_mean"][j] - mm["precipitation_anomaly"][j]) * n / largo
        dias_cubiertos += n
    if dias_totales == 0 or dias_cubiertos / dias_totales < cobertura_minima:
        raise RuntimeError(f"El pronóstico cubre solo {dias_cubiertos} de {dias_totales} días del trimestre")
    if clima <= 0:
        raise RuntimeError("Climatología del modelo nula o negativa")

    vals = list(totales.values())
    media = sum(vals) / len(vals)
    sup = sum(1 for v in vals if v > clima) / len(vals)
    return {
        "prob_superior": round(sup, 2),
        "prob_normal": None,
        "prob_inferior": round(1 - sup, 2),
        "anom_pronostico_pct": int(round(100 * (media / clima - 1))),
        "clima_modelo_mm": round(clima, 1),
        "media_pronostico_mm": round(media, 1),
        "cobertura": round(dias_cubiertos / dias_totales, 2),
        "miembros": len(vals),
    }


def pronostico(cfg: dict, anio_final: int) -> dict:
    """Probabilidades de lluvia del trimestre objetivo para cada departamento."""
    feats = departamentos(cfg)["features"]
    puntos = [tuple(f["properties"]["centro"]) for f in feats]
    diaria, mensual = descargar(puntos)
    meses = anios_estacion(anio_final, cfg["estacion"]["meses"])
    res = {f["id"]: resumir_punto(dd, mm, meses) for f, dd, mm in zip(feats, diaria, mensual)}
    return {
        "sistema": "ECMWF SEAS5 (51 miembros) vía Open-Meteo",
        "inicio": diaria[0]["daily"]["time"][0],
        "categorias": 2,
        "atribucion": "Datos meteorológicos: Open-Meteo.com (CC BY 4.0), basados en ECMWF SEAS5",
        "departamentos": res,
    }
