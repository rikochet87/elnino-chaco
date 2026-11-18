"""Recorta las celdas del mapa a Chaco. Ejecutar si cambian grilla o límites.

Requiere shapely (incluido en requirements.txt); no consulta servicios externos.
"""
import json
from pathlib import Path
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def generar():
    carpeta = ROOT / 'docs/data'
    departamentos = json.loads((carpeta / 'departamentos.geojson').read_text())
    provincia = unary_union([shape(f['geometry']) for f in departamentos['features']])
    grilla = json.loads((carpeta / 'precipitacion.json').read_text())
    a = grilla['paso'] / 2
    features = []
    for c in grilla['celdas']:
        x, y = c['centro']
        recorte = box(x-a, y-a, x+a, y+a).intersection(provincia)
        if recorte.is_empty or recorte.area == 0:
            continue
        features.append({'type': 'Feature', 'properties': {'centro': [x, y]}, 'geometry': mapping(recorte)})
    datos = {'type': 'FeatureCollection', 'paso': grilla['paso'],
             'fuente': 'Límites departamentales IGN, unión provincial de Chaco', 'features': features}
    (carpeta / 'precipitacion-celdas.geojson').write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(f'{len(features)} celdas recortadas a Chaco')


if __name__ == '__main__':
    generar()
