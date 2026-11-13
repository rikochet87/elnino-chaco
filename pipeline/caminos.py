"""Red de caminos de OpenStreetMap por departamento (exposición del módulo vial).

Descarga los caminos del área con la API Overpass, calcula kilómetros por
departamento y tipo, y guarda un GeoJSON de caminos rurales que se puede subir a
Earth Engine como asset para medir caminos con agua.
"""

import requests
from pyproj import Geod
from shapely.geometry import LineString, mapping, shape
from shapely.strtree import STRtree

from .comun import departamentos

GEOD = Geod(ellps="WGS84")


def consulta(cfg: dict) -> str:
    o, s, e, n = cfg["area"]["bbox"]
    tipos = "|".join(cfg["caminos"]["todos"])
    return f'[out:json][timeout:600];way["highway"~"^({tipos})$"]({s},{o},{n},{e});out geom;'


def descargar(cfg: dict) -> dict:
    r = requests.post(cfg["fuentes"]["overpass"], data={"data": consulta(cfg)}, timeout=900,
                      headers={"User-Agent": "sig-el-nino-argentina"})
    r.raise_for_status()
    return r.json()


def km(linea) -> float:
    return GEOD.geometry_length(linea) / 1000.0


def resumir(cfg: dict, osm: dict) -> tuple[dict, dict]:
    """Devuelve ({id_depto: {km_total, km_rurales, prop_rural}}, GeoJSON de caminos rurales)."""
    deptos = departamentos(cfg)["features"]
    geoms = [shape(f["geometry"]) for f in deptos]
    arbol = STRtree(geoms)
    rurales = set(cfg["caminos"]["rurales"])
    tot = {f["id"]: {"km_total": 0.0, "km_rurales": 0.0} for f in deptos}
    salida = []

    for el in osm.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        linea = LineString([(p["lon"], p["lat"]) for p in el["geometry"]])
        tipo = el.get("tags", {}).get("highway")
        es_rural = tipo in rurales
        for i in arbol.query(linea):
            parte = linea.intersection(geoms[i])
            if parte.is_empty:
                continue
            largo = km(parte)
            d = deptos[i]["id"]
            tot[d]["km_total"] += largo
            if es_rural:
                tot[d]["km_rurales"] += largo
        if es_rural:
            salida.append({"type": "Feature", "properties": {"tipo": tipo}, "geometry": mapping(linea)})

    for v in tot.values():
        v["prop_rural"] = v["km_rurales"] / v["km_total"] if v["km_total"] else 0.0
        v["km_total"] = round(v["km_total"], 1)
        v["km_rurales"] = round(v["km_rurales"], 1)
    return tot, {"type": "FeatureCollection", "features": salida}


def a_csv_wkt(geojson: dict, destino) -> None:
    """CSV con geometría WKT: el formato que acepta la carga de tablas de Earth Engine."""
    import csv

    with open(destino, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["tipo", "WKT"])
        for f in geojson["features"]:
            w.writerow([f["properties"]["tipo"], shape(f["geometry"]).wkt])
