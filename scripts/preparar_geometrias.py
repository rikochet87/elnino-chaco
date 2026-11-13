"""Prepara las geometrías del piloto Chaco para la web.

Fuente: departamentos de la República Argentina (IGN, SIG 250, vía CONAE),
convertidos a GeoJSON en github.com/mgaitan/departamentos_argentina.

Uso:
    python scripts/preparar_geometrias.py ruta/departamentos-argentina.json

Genera:
    docs/data/departamentos.geojson  25 departamentos de Chaco, simplificados
    docs/data/contexto.geojson       provincias vecinas, para referencia visual
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "docs" / "data"

# Nombres con mayúsculas y acentos para mostrar (la fuente viene en mayúsculas sin tildes).
NOMBRES = {
    "ALMIRANTE BROWN": ("Almirante Brown", "Pampa del Infierno"),
    "BERMEJO": ("Bermejo", "La Leonesa"),
    "CHACABUCO": ("Chacabuco", "Charata"),
    "COMANDANTE FERNANDEZ": ("Comandante Fernández", "Presidencia Roque Sáenz Peña"),
    "FRAY JUSTO SANTA MARIA DE ORO": ("Fray Justo Santa María de Oro", "Santa Sylvina"),
    "GENERAL BELGRANO": ("General Belgrano", "Corzuela"),
    "GENERAL DONOVAN": ("General Donovan", "Makallé"),
    "GENERAL GUEMES": ("General Güemes", "Juan José Castelli"),
    "INDEPENDENCIA": ("Independencia", "Campo Largo"),
    "LIBERTAD": ("Libertad", "Puerto Tirol"),
    "LIBERTADOR GENERAL SAN MARTIN": ("Libertador General San Martín", "General José de San Martín"),
    "MAIPU": ("Maipú", "Tres Isletas"),
    "MAYOR LUIS J. FONTANA": ("Mayor Luis J. Fontana", "Villa Ángela"),
    "O'HIGGINS": ("O'Higgins", "San Bernardo"),
    "PRESIDENCIA DE LA PLAZA": ("Presidencia de la Plaza", "Presidencia de la Plaza"),
    "QUITILIPI": ("Quitilipi", "Quitilipi"),
    "SAN FERNANDO": ("San Fernando", "Resistencia"),
    "SAN LORENZO": ("San Lorenzo", "Villa Berthet"),
    "SARGENTO CABRAL": ("Sargento Cabral", "Colonia Elisa"),
    "TAPENAGA": ("Tapenagá", "Charadai"),
    "1° DE MAYO": ("1° de Mayo", "Margarita Belén"),
    "12 DE OCTUBRE": ("12 de Octubre", "General Pinedo"),
    "2 DE ABRIL": ("2 de Abril", "Hermoso Campo"),
    "25 DE MAYO": ("25 de Mayo", "Machagai"),
    "9 DE JULIO": ("9 de Julio", "Las Breñas"),
}

VECINAS = ["FORMOSA", "SALTA", "SANTIAGO DEL ESTERO", "SANTA FE", "CORRIENTES"]


def slug(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def redondear(geom: dict, dec: int = 4) -> dict:
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], dec), round(c[1], dec)]
        return [r(x) for x in c]

    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def main(origen: str) -> None:
    fuente = json.loads(Path(origen).read_text(encoding="utf-8"))
    SALIDA.mkdir(parents=True, exist_ok=True)

    deptos = []
    vecinas = {p: [] for p in VECINAS}
    for f in fuente["features"]:
        p = f["properties"]
        if p["provincia"] == "CHACO":
            nombre, cabecera = NOMBRES[p["departamento"]]
            g = shape(f["geometry"]).buffer(0).simplify(0.002, preserve_topology=True)
            c = g.representative_point()
            deptos.append({
                "type": "Feature",
                "id": slug(nombre),
                "properties": {
                    "id": slug(nombre),
                    "nombre": nombre,
                    "cabecera": cabecera,
                    "provincia": "Chaco",
                    "centro": [round(c.x, 4), round(c.y, 4)],
                },
                "geometry": redondear(mapping(g)),
            })
        elif p["provincia"] in vecinas:
            vecinas[p["provincia"]].append(shape(f["geometry"]).buffer(0))

    if len(deptos) != 25:
        raise SystemExit(f"Se esperaban 25 departamentos de Chaco y hay {len(deptos)}")
    deptos.sort(key=lambda f: f["properties"]["nombre"])

    contexto = []
    for prov, geoms in vecinas.items():
        g = unary_union(geoms).simplify(0.01, preserve_topology=True)
        contexto.append({
            "type": "Feature",
            "properties": {"provincia": prov.title().replace(" Del ", " del ")},
            "geometry": redondear(mapping(g), 3),
        })

    (SALIDA / "departamentos.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": deptos}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (SALIDA / "contexto.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": contexto}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{len(deptos)} departamentos y {len(contexto)} provincias vecinas escritos en {SALIDA}")


if __name__ == "__main__":
    main(sys.argv[1])
