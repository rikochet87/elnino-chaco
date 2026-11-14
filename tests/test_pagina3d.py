"""Pruebas de los datos de la página 3D (sin red)."""

from datetime import date

import numpy as np
import pandas as pd
import xarray as xr

from pipeline import atmosfera, pacifico


def _csv(lats, lons, valor):
    filas = ["time,zlev,latitude,longitude,anom", "UTC,m,degrees_north,degrees_east,degree_C"]
    for la in lats:
        for lo in lons:
            v = valor(la, lo)
            filas.append(f"2026-11-12T12:00:00Z,0.0,{la},{lo},{'NaN' if v is None else v}")
    return "\n".join(filas)


def test_parsear_csv_y_gris():
    lats, lons = [-1.0, 1.0], [10.0, 20.0, 30.0]
    fecha, g = pacifico.parsear_csv(_csv(lats, lons, lambda la, lo: None if lo == 30 else la * 2))
    assert fecha == "2026-11-12"
    assert g.shape == (2, 3) and g[0, 0] == -2 and g[1, 1] == 2 and np.isnan(g[0, 2])
    img = pacifico.a_gris(g)
    assert img[0, 0] == round((2 + 5) / 10 * 254)  # norte arriba
    assert img[1, 0] == round((-2 + 5) / 10 * 254)
    assert img[0, 2] == pacifico.SIN_DATO
    assert pacifico.a_gris(np.array([[9.0, -9.0]])).tolist() == [[254, 0]]  # recorte a ±5 °C


def test_nino34():
    g = np.zeros((180, 360))
    g[85:95, 190:240] = 2.5  # banda ecuatorial del Pacífico central
    assert pacifico.nino34(g) == 2.5


def test_fechas_semanales_estables():
    a = pacifico.fechas_semanales(date(2026, 11, 12))
    b = pacifico.fechas_semanales(date(2026, 11, 13))
    assert a == b and len(a) == pacifico.SEMANAS
    assert all(date.fromisoformat(f).weekday() == 0 for f in a)
    assert a[-1] == "2026-11-09"


def test_medias_djf_y_compuesto():
    t = pd.date_range("1989-12-01", "2021-02-01", freq="MS")
    vals = np.array([float(d.year if d.month <= 2 else d.year + 1) for d in t])  # todo el verano vale el año del enero
    da = xr.DataArray(vals[:, None, None] * np.ones((1, 2, 2)), dims=("time", "lat", "lon"),
                      coords={"time": t, "lat": [0.0, -2.5], "lon": [0.0, 2.5]})
    djf = atmosfera.medias_djf(da, list(range(1990, 2022)))
    assert djf["anio"].values.tolist() == list(range(1990, 2022))  # 2022 no está completo y no se pide
    assert float(djf.sel(anio=1998)[0, 0]) == 1998
    media, anom, nino = atmosfera.compuesto(djf, [1998, 2016, 2030], (1991, 2020))
    assert nino == [1998, 2016]
    assert float(media[0, 0]) == 2007
    assert abs(float(anom[0, 0]) - (2007 - 2005.5)) < 1e-9


def test_recortar_y_grilla():
    da = xr.DataArray(np.arange(5 * 3, dtype=float).reshape(5, 3), dims=("lat", "lon"),
                      coords={"lat": [-80.0, -40.0, 0.0, 40.0, 80.0], "lon": [5.0, 0.0, 10.0]})
    r = atmosfera.recortar(da)
    assert r["lat"].values.tolist() == [0.0, -40.0] and r["lon"].values.tolist() == [0.0, 5.0, 10.0]
    assert atmosfera.grilla(r) == {"lat0": 0.0, "dlat": -40.0, "nlat": 2, "lon0": 0.0, "dlon": 5.0, "nlon": 3}


def test_decodificar_tiempo_con_sufijo():
    ds = xr.Dataset(coords={"time": ("time", [0.0, 31.0], {"units": "days since 1800-01-01 00:00:00 0:00"})})
    t = atmosfera.decodificar_tiempo(ds)["time"].values
    assert str(t[0])[:10] == "1800-01-01" and str(t[1])[:10] == "1800-02-01"
