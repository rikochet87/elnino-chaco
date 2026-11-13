"""Pronóstico estacional de lluvia de Copernicus C3S (ECMWF SEAS5) en terciles.

Para cada celda de la grilla (1°) se calcula, con el hindcast 1993–2016 del mismo mes
de inicio, los terciles de la lluvia acumulada del trimestre objetivo. La probabilidad
de cada categoría es la fracción de miembros del pronóstico que caen en ella. Cada
departamento toma la celda más cercana a su punto representativo: con una grilla de
1° varios departamentos comparten celda, y así hay que comunicarlo.

Requiere cuenta en el Climate Data Store, el archivo ~/.cdsapirc y haber aceptado la
licencia del conjunto "seasonal-monthly-single-levels".
"""

import calendar
from pathlib import Path

from .comun import anios_estacion, departamentos

DATASET = "seasonal-monthly-single-levels"


def plazos(mes_inicio: int, anio_inicio: int, meses_obj: list[int], anio_final_obj: int) -> list[int]:
    """leadtime_month (1 = mes de inicio) de cada mes del trimestre objetivo."""
    res = []
    for a, m in anios_estacion(anio_final_obj, meses_obj):
        lead = (a - anio_inicio) * 12 + (m - mes_inicio) + 1
        if lead < 1 or lead > 6:
            raise ValueError(f"El trimestre objetivo queda fuera del alcance del pronóstico (plazo {lead})")
        res.append(lead)
    return res


def _pedido(cfg: dict, anios: list[int], mes_inicio: int, leads: list[int]) -> dict:
    o, s, e, n = cfg["area"]["bbox"]
    return {
        "originating_centre": cfg["c3s"]["centro"],
        "system": cfg["c3s"]["sistema"],
        "variable": ["total_precipitation"],
        "product_type": ["monthly_mean"],
        "year": [str(a) for a in anios],
        "month": [f"{mes_inicio:02d}"],
        "leadtime_month": [str(x) for x in leads],
        "data_format": "netcdf",
        "area": [n + 1, o - 1, s - 1, e + 1],
    }


def descargar(cfg: dict, destino: Path, anios: list[int], mes_inicio: int, leads: list[int]) -> Path:
    import cdsapi

    if destino.exists():
        return destino
    destino.parent.mkdir(parents=True, exist_ok=True)
    cdsapi.Client().retrieve(DATASET, _pedido(cfg, anios, mes_inicio, leads), str(destino))
    return destino


def _abrir(ruta: Path):
    import xarray as xr

    ds = xr.open_dataset(ruta)
    var = next(v for v in ("tprate", "tp", "total_precipitation") if v in ds.data_vars)
    da = ds[var]
    # Nombres de dimensiones según versión del CDS
    ren = {}
    for viejo, nuevo in (("forecastMonth", "lead"), ("leadtime_month", "lead"), ("forecast_reference_time", "init"),
                         ("time", "init"), ("number", "miembro"), ("lat", "latitude"), ("lon", "longitude")):
        if viejo in da.dims:
            ren[viejo] = nuevo
    return da.rename(ren)


def acumulado_estacion(da, leads: list[int], mes_inicio: int):
    """Lluvia acumulada del trimestre (mm) por inicio, miembro y celda."""
    partes = []
    for lead in leads:
        sel = da.sel(lead=lead) if "lead" in da.dims else da
        mes = (mes_inicio + lead - 2) % 12 + 1
        segundos = calendar.monthrange(2001, mes)[1] * 86400  # año no bisiesto: ±3 % en febrero bisiesto
        partes.append(sel * segundos * 1000.0)  # tprate en m/s → mm/mes
    return sum(partes)


def probabilidades(hindcast, pronostico) -> tuple:
    """(p_superior, p_normal, p_inferior) por celda."""
    clima = hindcast.stack(m=[d for d in hindcast.dims if d in ("init", "miembro")])
    t1 = clima.quantile(1 / 3, dim="m")
    t2 = clima.quantile(2 / 3, dim="m")
    pron = pronostico.stack(m=[d for d in pronostico.dims if d in ("init", "miembro")])
    n = pron.sizes["m"]
    sup = (pron > t2).sum("m") / n
    inf = (pron < t1).sum("m") / n
    return sup, 1 - sup - inf, inf


def por_departamento(cfg: dict, sup, nor, inf) -> dict:
    res = {}
    for f in departamentos(cfg)["features"]:
        lon, lat = f["properties"]["centro"]
        sel = dict(latitude=lat, longitude=lon, method="nearest")
        res[f["id"]] = {
            "prob_superior": round(float(sup.sel(**sel)), 2),
            "prob_normal": round(float(nor.sel(**sel)), 2),
            "prob_inferior": round(float(inf.sel(**sel)), 2),
        }
    return res


def pronostico(cfg: dict, anio_inicio: int, mes_inicio: int, anio_final_obj: int, carpeta: Path) -> dict:
    """Descarga hindcast y pronóstico y devuelve probabilidades por departamento."""
    meses = cfg["estacion"]["meses"]
    leads = plazos(mes_inicio, anio_inicio, meses, anio_final_obj)
    h0, h1 = cfg["c3s"]["hindcast"]
    sist = cfg["c3s"]["sistema"]
    rh = descargar(cfg, carpeta / f"c3s_hindcast_s{sist}_m{mes_inicio:02d}.nc", list(range(h0, h1 + 1)), mes_inicio, leads)
    rp = descargar(cfg, carpeta / f"c3s_pronostico_{anio_inicio}-{mes_inicio:02d}.nc", [anio_inicio], mes_inicio, leads)
    hind = acumulado_estacion(_abrir(rh), leads, mes_inicio)
    pron = acumulado_estacion(_abrir(rp), leads, mes_inicio)
    sup, nor, inf = probabilidades(hind, pron)
    return {
        "sistema": f"{cfg['c3s']['centro']} SEAS5 sistema {sist}",
        "inicio": f"{anio_inicio}-{mes_inicio:02d}",
        "plazos": leads,
        "departamentos": por_departamento(cfg, sup, nor, inf),
    }
