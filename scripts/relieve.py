"""Relieve de Sudamérica para la página 3D: modelo de elevación ETOPO de NOAA (dominio público).

Grilla de 0,1° (unos 11 km) sobre la caja de Sudamérica. Se guarda como PNG en escala de grises:
    0 = mar · 1–255 = tierra, en escalones de 25 m (255 = 6.375 m o más).
Uso: python scripts/relieve.py   (lo corre GitHub Actions; NOAA no pide cuenta)
"""

import io
import json
import time
from pathlib import Path

import numpy as np
import requests
import urllib3.util.connection as conexion
from PIL import Image

conexion.HAS_IPV6 = False
RAIZ = Path(__file__).resolve().parent.parent
CAJA = {"oeste": -82.0, "este": -34.0, "sur": -56.0, "norte": 13.0}
PASO = 0.1
METROS_POR_NIVEL = 25


def por_erddap():
    # ETOPO1 (1 minuto de arco) en el ERDDAP de NOAA CoastWatch; cada 6 celdas = 0,1°
    url = ("https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.csv?"
           f"altitude[({CAJA['sur']}):6:({CAJA['norte']})][({CAJA['oeste']}):6:({CAJA['este']})]")
    for intento in range(3):
        try:
            r = requests.get(url, timeout=300, headers={"User-Agent": "elnino-chaco"})
            r.raise_for_status()
            datos = np.genfromtxt(io.StringIO(r.text), delimiter=",", skip_header=2)
            lats, lons = np.unique(datos[:, 0]), np.unique(datos[:, 1])
            z = np.full((lats.size, lons.size), np.nan)
            z[np.searchsorted(lats, datos[:, 0]), np.searchsorted(lons, datos[:, 1])] = datos[:, 2]
            return z[::-1], "NOAA ETOPO1 (1 minuto de arco), vía NOAA CoastWatch ERDDAP"  # norte arriba
        except Exception as e:
            print(f"ERDDAP intento {intento + 1}: {e}")
            time.sleep(15)
    return None, None


def por_ncei():
    # ETOPO 2022 (60 segundos de arco) en el THREDDS de NOAA NCEI, por OPeNDAP
    import xarray as xr

    url = "https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/60s/60s_bed_elev_netcdf/ETOPO_2022_v1_60s_N90W180_bed.nc"
    ds = xr.open_dataset(url)
    z = ds["z"].sel(lat=slice(CAJA["sur"], CAJA["norte"]), lon=slice(CAJA["oeste"], CAJA["este"]))
    z = z.isel(lat=slice(0, None, 6), lon=slice(0, None, 6)).load()
    return np.asarray(z.values)[::-1], "NOAA ETOPO 2022 (60 segundos de arco), vía NOAA NCEI"


def main():
    z, fuente = por_erddap()
    if z is None:
        z, fuente = por_ncei()
    tierra = np.nan_to_num(z, nan=-1) > 0
    niveles = np.where(tierra, np.clip(np.round(z / METROS_POR_NIVEL), 1, 255), 0).astype(np.uint8)
    destino = RAIZ / "docs/data"
    Image.fromarray(niveles).save(destino / "relieve_sa.png", optimize=True)
    (destino / "relieve_sa.json").write_text(json.dumps({
        "fuente": fuente + ". Dominio público.",
        "caja": CAJA, "paso_grados": PASO, "ancho": int(niveles.shape[1]), "alto": int(niveles.shape[0]),
        "metros_por_nivel": METROS_POR_NIVEL, "maximo_m": float(np.nanmax(z)),
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{fuente}: {niveles.shape}, máximo {np.nanmax(z):.0f} m, "
          f"{(destino / 'relieve_sa.png').stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
