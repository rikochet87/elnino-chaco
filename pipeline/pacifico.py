"""Temperatura del mar para la página "Cómo llega El Niño a Chaco".

Fuente: NOAA OISST v2.1, análisis diario preliminar (NRT), servido por el ERDDAP de NOAA CoastWatch.
Se guarda la anomalía respecto de 1991–2020 en una grilla de 1° (cada 4 celdas de la original de 0,25°).

Cada imagen es un PNG en escala de grises de 360 × 180 (norte arriba, longitud 0–360 desde Greenwich):
    gris = (anomalía + 5) / 10 · 254, recortado a ±5 °C; 255 = tierra o hielo.
La web lo colorea con su propia paleta. Se guardan:
    - el último día disponible (llega con unos 2 días de atraso);
    - un cuadro por semana de los últimos 6 meses, para animar el movimiento del agua caliente.
Los cuadros semanales caen siempre en lunes, así que cada día solo se descarga lo nuevo.
"""

from datetime import date, timedelta
from io import StringIO

import numpy as np
import requests

RANGO = 5.0
SIN_DATO = 255
PASO = 4  # 0,25° · 4 = 1°
LUNES_BASE = date(2020, 1, 6)
SEMANAS = 26
NINO34 = {"lat": (-5, 5), "lon": (190, 240)}  # 5°N–5°S, 170°O–120°O


def url(base: str, fecha: str | None = None) -> str:
    t = "(last)" if fecha is None else f"({fecha}T12:00:00Z)"
    return (f"{base}.csv?anom[{t}][(0.0)][(-89.875):{PASO}:(89.875)][(0.125):{PASO}:(359.875)]")


def parsear_csv(texto: str) -> tuple[str, np.ndarray]:
    """CSV de ERDDAP → (fecha AAAA-MM-DD, grilla [lat, lon] con lat de sur a norte)."""
    lineas = texto.splitlines()
    if not lineas or not lineas[0].startswith("time"):
        raise ValueError("Respuesta inesperada de ERDDAP: " + texto[:200])
    datos = np.genfromtxt(StringIO("\n".join(lineas[2:])), delimiter=",", usecols=(2, 3, 4))
    fecha = lineas[2].split(",")[0][:10]
    lats, lons = np.unique(datos[:, 0]), np.unique(datos[:, 1])
    grilla = np.full((lats.size, lons.size), np.nan)
    i = np.searchsorted(lats, datos[:, 0])
    j = np.searchsorted(lons, datos[:, 1])
    grilla[i, j] = datos[:, 2]
    return fecha, grilla


def a_gris(grilla: np.ndarray) -> np.ndarray:
    """Grilla de anomalías (sur → norte) → imagen uint8 (norte arriba)."""
    g = np.clip((grilla + RANGO) / (2 * RANGO) * 254, 0, 254)
    img = np.where(np.isnan(grilla), SIN_DATO, np.round(g)).astype(np.uint8)
    return img[::-1]


def nino34(grilla: np.ndarray) -> float:
    """Promedio de la anomalía en la región Niño 3.4 (grilla de 1°, lat −89,5…89,5, lon 0,5…359,5)."""
    lats = np.arange(grilla.shape[0]) * (180 / grilla.shape[0]) - 90 + 90 / grilla.shape[0]
    lons = np.arange(grilla.shape[1]) * (360 / grilla.shape[1]) + 180 / grilla.shape[1]
    fi = (lats >= NINO34["lat"][0]) & (lats <= NINO34["lat"][1])
    co = (lons >= NINO34["lon"][0]) & (lons <= NINO34["lon"][1])
    return round(float(np.nanmean(grilla[np.ix_(fi, co)])), 2)


def fechas_semanales(ultima: date, semanas: int = SEMANAS) -> list[str]:
    """Lunes de las últimas `semanas` semanas hasta `ultima` (inclusive), de más viejo a más nuevo."""
    desfase = (ultima - LUNES_BASE).days % 7
    lunes = ultima - timedelta(days=desfase)
    return [(lunes - timedelta(weeks=k)).isoformat() for k in range(semanas - 1, -1, -1)]


def descargar(base: str, fecha: str | None = None) -> tuple[str, np.ndarray]:
    r = requests.get(url(base, fecha), timeout=180, headers={"User-Agent": "elnino-chaco"})
    r.raise_for_status()
    return parsear_csv(r.text)


def actualizar(cfg: dict, carpeta, base: str) -> dict:
    """Descarga lo que falta, borra cuadros viejos y devuelve el índice para la web."""
    from PIL import Image

    carpeta.mkdir(parents=True, exist_ok=True)
    ultima, grilla = descargar(base)
    Image.fromarray(a_gris(grilla)).save(carpeta / f"{ultima}.png", optimize=True)
    semanales = fechas_semanales(date.fromisoformat(ultima))
    for f in semanales:
        if not (carpeta / f"{f}.png").exists():
            fecha_real, g = descargar(base, f)
            Image.fromarray(a_gris(g)).save(carpeta / f"{f}.png", optimize=True)
            print(f"  cuadro {f} (dato del {fecha_real})")
    vigentes = set(semanales) | {ultima}
    for png in carpeta.glob("*.png"):
        if png.stem not in vigentes:
            png.unlink()
    return {
        "fuente": "NOAA OISST v2.1 (preliminar), anomalía diaria respecto de 1991–2020, vía NOAA CoastWatch ERDDAP",
        "ultimo": ultima,
        "nino34": nino34(grilla),
        "escala": {"min": -RANGO, "max": RANGO, "sin_dato": SIN_DATO, "resolucion_grados": 1},
        "cuadros": sorted(vigentes),
    }
