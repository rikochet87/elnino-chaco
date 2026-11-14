"""Vientos, humedad y lluvia promedio de los veranos con El Niño, para la página 3D.

Se calcula una vez (y cuando haya un verano Niño nuevo). Fuentes, de NOAA PSL, sin cuenta:
  - Reanálisis NCEP/NCAR R1, medias mensuales en niveles de presión (2,5°):
      viento a 200 hPa (corriente en chorro subtropical) y altura geopotencial a 200 hPa
      (el tren de ondas que cruza el Pacífico Sur);
      viento y humedad específica a 850 hPa (chorro de capas bajas que trae humedad de la Amazonía).
  - GPCP v2.3, lluvia mensual combinada de satélite y pluviómetros (2,5°).

Para cada verano (diciembre a febrero) se promedian los tres meses. El compuesto Niño es el promedio de
los veranos Niño según el ONI; la anomalía es la diferencia con el promedio 1991–2020.
El flujo de humedad se aproxima con el producto de las medias mensuales de humedad y viento.
"""

import numpy as np

LAT_N, LAT_S = 30.0, -70.0  # dominio: trópico norte a la Antártida (el Pacífico Sur y Sudamérica)


DJF = [(-1, 12), (0, 1), (0, 2)]
SEP_FEB = [(-1, 9), (-1, 10), (-1, 11), (-1, 12), (0, 1), (0, 2)]  # primavera y verano: lo que carga la cuenca


def medias_meses(da, anios: list[int], meses=DJF):
    """Media de los meses pedidos para cada año, con meses dados como (desfase de año, mes):
    (-1, 12) es diciembre del año anterior. Devuelve un DataArray con dim 'anio' (el año del enero)."""
    import xarray as xr

    t = da["time"].dt
    salidas = []
    for a in anios:
        sel = np.zeros(t.year.size, dtype=bool)
        for desfase, mes in meses:
            sel |= ((t.year == a + desfase) & (t.month == mes)).values
        trozo = da.isel(time=np.flatnonzero(sel))
        if trozo.sizes["time"] != len(meses):
            continue
        salidas.append(trozo.mean("time").expand_dims(anio=[a]))
    if not salidas:
        raise ValueError("No hay temporadas completas en los datos pedidos")
    return xr.concat(salidas, dim="anio")


def medias_djf(da, anios: list[int]):
    """Media diciembre (año anterior)–enero–febrero de cada año pedido."""
    return medias_meses(da, anios, DJF)


def compuesto(da, anios_nino: list[int], clima: tuple[int, int]):
    """(media en años Niño, anomalía respecto de la climatología)."""
    disponibles = [int(a) for a in da["anio"].values]
    nino = [a for a in anios_nino if a in disponibles]
    ref = [a for a in disponibles if clima[0] <= a <= clima[1]]
    media_nino = da.sel(anio=nino).mean("anio")
    return media_nino, media_nino - da.sel(anio=ref).mean("anio"), nino


def recortar(da):
    lat = da["lat"]
    if float(lat[0]) < float(lat[-1]):  # ordenar de norte a sur
        da = da.sortby("lat", ascending=False)
    return da.sel(lat=slice(LAT_N, LAT_S)).sortby("lon")


def plano(da, decimales: int = 1) -> list:
    v = np.round(np.asarray(da.values, dtype=float), decimales)
    return [None if np.isnan(x) else float(x) for x in v.ravel()]


def grilla(da) -> dict:
    lat, lon = da["lat"].values, da["lon"].values
    return {"lat0": float(lat[0]), "dlat": float(lat[1] - lat[0]), "nlat": int(lat.size),
            "lon0": float(lon[0]), "dlon": float(lon[1] - lon[0]), "nlon": int(lon.size)}


def decodificar_tiempo(ds):
    """Fechas 'days/hours since AAAA-MM-DD ...' sin depender de cftime (algunos archivos de PSL traen
    un sufijo de zona horaria, como '0:00', que xarray no entiende)."""
    import pandas as pd

    t = ds["time"]
    unidad, _, origen = t.attrs["units"].partition(" since ")
    base = pd.Timestamp(origen.strip().split(" ")[0])
    paso = {"days": "D", "hours": "h"}[unidad.strip()]
    return ds.assign_coords(time=base + pd.to_timedelta(t.values, unit=paso))


def abrir_opendap(url: str):
    import xarray as xr

    return decodificar_tiempo(xr.open_dataset(url, decode_times=False))


def _abrir(url: str, var: str, nivel: float | None):
    ds = abrir_opendap(url)
    da = ds[var]
    if nivel is not None:
        da = da.sel(level=nivel)
    return recortar(da).load()


def calcular(cfg: dict, anios_nino: list[int]) -> dict:
    fu = cfg["fuentes"]
    clima = tuple(cfg["clima"]["referencia"])
    ncep = fu["ncep_mensual"]
    from datetime import date

    anios = list(range(1980, date.today().year + 1))

    def djf(url, var, nivel=None):
        print(f"  {var}{'' if nivel is None else f' {nivel:g} hPa'}…")
        return medias_djf(_abrir(url, var, nivel), anios)

    u200 = djf(ncep.format(var="uwnd"), "uwnd", 200)
    v200 = djf(ncep.format(var="vwnd"), "vwnd", 200)
    z200 = djf(ncep.format(var="hgt"), "hgt", 200)
    u850 = djf(ncep.format(var="uwnd"), "uwnd", 850)
    v850 = djf(ncep.format(var="vwnd"), "vwnd", 850)
    q850 = djf(ncep.format(var="shum"), "shum", 850)
    if float(q850.max()) < 0.5:  # kg/kg → g/kg
        q850 = q850 * 1000
    print("  precip (GPCP)…")
    precip = _abrir(fu["gpcp_mensual"], "precip", None)  # mm/día
    lluvia = medias_djf(precip, anios)
    lluvia_sf = medias_meses(precip, anios, SEP_FEB)

    u200n, _, nino = compuesto(u200, anios_nino, clima)
    v200n, _, _ = compuesto(v200, anios_nino, clima)
    vel = np.hypot(u200, v200)
    _, vel_anom, _ = compuesto(vel, anios_nino, clima)
    _, z_anom, _ = compuesto(z200, anios_nino, clima)
    qu, qv = q850 * u850, q850 * v850  # g/kg · m/s
    qun, qu_anom, _ = compuesto(qu, anios_nino, clima)
    qvn, qv_anom, _ = compuesto(qv, anios_nino, clima)
    _, ll_anom, _ = compuesto(lluvia, anios_nino, clima)
    ll_clima = lluvia.sel(anio=[a for a in lluvia["anio"].values if clima[0] <= a <= clima[1]]).mean("anio")
    ll_pct = (ll_anom / ll_clima.where(ll_clima > 0.3)) * 100
    _, sf_anom, _ = compuesto(lluvia_sf, anios_nino, clima)
    sf_clima = lluvia_sf.sel(anio=[a for a in lluvia_sf["anio"].values if clima[0] <= a <= clima[1]]).mean("anio")
    sf_pct = (sf_anom / sf_clima.where(sf_clima > 0.3)) * 100

    return {
        "fuente": "NOAA PSL: reanálisis NCEP/NCAR R1 (medias mensuales) y GPCP v2.3",
        "estacion": "diciembre a febrero",
        "anios_nino": nino,
        "clima": list(clima),
        "grilla": grilla(u200n),
        "u200": plano(u200n), "v200": plano(v200n),
        "vel200_anom": plano(vel_anom), "z200_anom": plano(z_anom, 0),
        "qu850": plano(qun), "qv850": plano(qvn),
        "qu850_anom": plano(qu_anom), "qv850_anom": plano(qv_anom),
        "lluvia": {"grilla": grilla(ll_anom), "anom_mm_dia": plano(ll_anom, 2), "anom_pct": plano(ll_pct, 0)},
        "lluvia_sep_feb": {"grilla": grilla(sf_anom), "anom_mm_dia": plano(sf_anom, 2), "anom_pct": plano(sf_pct, 0)},
    }
