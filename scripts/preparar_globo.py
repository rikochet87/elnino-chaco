"""Geometría liviana para la página 3D "Cómo llega El Niño a Chaco".

Fuente: Natural Earth (dominio público), https://github.com/nvkelso/natural-earth-vector
Uso:  python scripts/preparar_globo.py <carpeta con los geojson de Natural Earth>
      python scripts/preparar_globo.py <carpeta> detalle   (costas, provincias y departamentos de Sudamérica)
Necesita: ne_110m_land, ne_50m_land, ne_50m_admin_0_countries, ne_10m_rivers_lake_centerlines.
Escribe docs/data/globo.json.
"""

import json
import sys
from pathlib import Path

from shapely.geometry import box, mapping, shape
from shapely.ops import linemerge, unary_union

RAIZ = Path(__file__).resolve().parent.parent
SUDAMERICA = box(-82, -56, -34, 13)
CUENCA = box(-70, -38, -40, -12)
DESEMBOCADURA = (-58.4, -34.0)
CONFLUENCIA = (-58.6, -27.3)  # Paraguay y Paraná  # Río de la Plata: sirve para orientar los ríos aguas abajo
RIOS = {"Paraná", "Paraguay", "Paranaíba", "Grande", "Tietê", "Paranapanema", "Iguaçu", "Iguazú", "Uruguay",
        "Bermejo", "Pilcomayo", "Ivaí", "Salado", "Pardo", "Taquari"}


def r(v, d=2):
    return round(v, d)


def anillos(geom, tol, d=2):
    out = []
    geom = geom.simplify(tol, preserve_topology=True)
    for pol in getattr(geom, "geoms", [geom]):
        if pol.is_empty or pol.geom_type != "Polygon":
            continue
        cs = [[r(x, d), r(y, d)] for x, y in pol.exterior.coords]
        if len(cs) >= 4:
            out.append(cs)
    return out


def lineas(geom, tol, d=2):
    out = []
    geom = geom.simplify(tol)
    for ln in getattr(geom, "geoms", [geom]):
        if ln.is_empty or ln.geom_type != "LineString":
            continue
        out.append([[r(x, d), r(y, d)] for x, y in ln.coords])
    return out


def leer(carpeta, nombre):
    return json.loads((Path(carpeta) / f"{nombre}.geojson").read_text(encoding="utf-8"))["features"]


def main(carpeta):
    tierra = unary_union([shape(f["geometry"]) for f in leer(carpeta, "ne_110m_land")])
    tierra_sa = unary_union([shape(f["geometry"]) for f in leer(carpeta, "ne_50m_land")]).intersection(SUDAMERICA)
    fronteras = []
    for f in leer(carpeta, "ne_50m_admin_0_countries"):
        g = shape(f["geometry"])
        if g.intersects(SUDAMERICA):
            fronteras += [ring for pol in getattr(g.intersection(SUDAMERICA), "geoms", [g.intersection(SUDAMERICA)])
                          if pol.geom_type == "Polygon" for ring in [pol.exterior]]
    bordes = linemerge(unary_union(fronteras)).simplify(0.05)

    rios = []
    for f in leer(carpeta, "ne_10m_rivers_lake_centerlines"):
        p = f["properties"]
        if (p.get("name") or "") not in RIOS:
            continue
        g = shape(f["geometry"]).intersection(CUENCA)
        if g.is_empty:
            continue
        for ln in lineas(linemerge(g) if g.geom_type == "MultiLineString" else g, 0.02):
            # orientar aguas abajo: el extremo más cercano a la desembocadura va al final
            d0 = (ln[0][0] - DESEMBOCADURA[0]) ** 2 + (ln[0][1] - DESEMBOCADURA[1]) ** 2
            d1 = (ln[-1][0] - DESEMBOCADURA[0]) ** 2 + (ln[-1][1] - DESEMBOCADURA[1]) ** 2
            if d0 < d1:
                ln.reverse()
            if len(ln) < 2:
                continue
            rango = int(p.get("scalerank") or 9)
            # En Natural Earth el río Paraguay y el Paraná inferior son una sola línea ("Paraná"):
            # se corta en la confluencia, frente a Corrientes y Resistencia.
            if p["name"] == "Paraná" and rango == 2 and ln[0][1] > -20:
                i = min(range(len(ln)), key=lambda k: (ln[k][0] - CONFLUENCIA[0]) ** 2 + (ln[k][1] - CONFLUENCIA[1]) ** 2)
                rios.append({"nombre": "Paraguay", "rango": rango, "c": ln[: i + 1]})
                ln = ln[i:]
            if len(ln) >= 2:
                rios.append({"nombre": p["name"], "rango": rango, "c": ln})

    deptos = json.loads((RAIZ / "docs/data/departamentos.geojson").read_text(encoding="utf-8"))["features"]
    chaco = unary_union([shape(f["geometry"]) for f in deptos])

    salida = {
        "fuente": "Natural Earth (dominio público); límites de Chaco: IGN",
        "tierra": anillos(tierra, 0.15, 1),
        "tierra_sa": anillos(tierra_sa, 0.04),
        "fronteras_sa": [[[r(x), r(y)] for x, y in ln.coords] for ln in getattr(bordes, "geoms", [bordes]) if ln.geom_type == "LineString"],
        "rios": rios,
        "chaco": anillos(chaco, 0.01),
    }
    destino = RAIZ / "docs/data/globo.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{destino}: {destino.stat().st_size / 1024:.0f} KB, {len(rios)} tramos de río")


if __name__ == "__main__" and len(sys.argv) == 2:
    main(sys.argv[1])


# ---------------------------------------------------------------- detalle de Sudamérica
DETALLE = box(-82, -56, -34, 13)
PAISES_SA = {"ARG", "BRA", "PRY", "BOL", "URY", "CHL", "PER", "ECU", "COL", "VEN", "GUY", "SUR"}


def detalle(carpeta):
    """Costas, fronteras, provincias/estados y departamentos de Chaco con más resolución,
    para dibujar nítido al acercarse con el zoom. Escribe docs/data/detalle_sa.json."""
    def recortar_lineas(features, tol, filtro=lambda p: True):
        geoms = [shape(f["geometry"]) for f in features if filtro(f["properties"])]
        g = unary_union([x.intersection(DETALLE) for x in geoms if x.intersects(DETALLE)])
        return lineas(linemerge(g) if g.geom_type == "MultiLineString" else g, tol, 3)

    costa = recortar_lineas(leer(carpeta, "ne_10m_coastline"), 0.01)
    paises = recortar_lineas(leer(carpeta, "ne_10m_admin_0_boundary_lines_land"), 0.01)
    provincias = recortar_lineas(leer(carpeta, "ne_10m_admin_1_states_provinces_lines"), 0.015,
                                 lambda p: p.get("ADM0_A3") in PAISES_SA)
    deptos = json.loads((RAIZ / "docs/data/departamentos.geojson").read_text(encoding="utf-8"))["features"]
    bordes_deptos = unary_union([shape(f["geometry"]).boundary for f in deptos])
    departamentos = lineas(linemerge(bordes_deptos), 0.003, 3)
    salida = {
        "fuente": "Natural Earth 1:10m (dominio público); departamentos de Chaco: IGN",
        "caja": {"oeste": -82, "este": -34, "sur": -56, "norte": 13},
        "costa": costa, "paises": paises, "provincias": provincias, "departamentos_chaco": departamentos,
    }
    destino = RAIZ / "docs/data/detalle_sa.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{destino}: {destino.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] == "detalle":
    detalle(sys.argv[1])
