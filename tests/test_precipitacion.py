"""Validación de estadísticas y de la grilla que se publica."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('actualizar', ROOT / 'scripts/actualizar_precipitacion.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class PrecipitacionTest(unittest.TestCase):
    def test_umbrales_estrictos_y_percentiles(self):
        r = mod.resumen([0, 10, 20, 30, 50])
        self.assertEqual(r['mediana'], 20)
        self.assertEqual(r['p10'], 4)
        self.assertEqual(r['p90'], 42)
        self.assertEqual(r['prob']['20'], 40)
        self.assertEqual(r['prob']['50'], 0)
        for valores in ([], [1, None], [1, float('nan')], [-1, 2]):
            with self.assertRaises(ValueError): mod.resumen(valores)

    def test_grilla_completa_y_probabilidades_monotonicas(self):
        d = json.loads((ROOT / 'docs/data/precipitacion.json').read_text())
        self.assertEqual(len(d['celdas']), 396)
        self.assertEqual(len(d['fechas']), 7)
        self.assertEqual(d['fechas'], sorted(set(d['fechas'])))
        for c in d['celdas']:
            self.assertEqual(len(c['dias']), 7)
            for r in c['dias']:
                self.assertEqual(r['miembros'], 40)
                self.assertLessEqual(r['p10'], r['mediana'])
                self.assertLessEqual(r['mediana'], r['p90'])
                ps = [r['prob'][str(x)] for x in (1, 10, 20, 50)]
                self.assertEqual(ps, sorted(ps, reverse=True))
                self.assertTrue(all(0 <= v <= 100 for v in ps))

    def test_recorte_no_pinta_fuera_de_chaco(self):
        try:
            from shapely.geometry import shape
            from shapely.ops import unary_union
        except ImportError:
            self.skipTest('Requiere Shapely para verificar el recorte geométrico')
        a = json.loads((ROOT / 'docs/data/departamentos.geojson').read_text())
        b = json.loads((ROOT / 'docs/data/precipitacion-celdas.geojson').read_text())
        provincia = unary_union([shape(f['geometry']) for f in a['features']])
        geometrias = [shape(f['geometry']) for f in b['features']]
        self.assertTrue(all(g.is_valid for g in geometrias))
        self.assertLess(unary_union(geometrias).symmetric_difference(provincia).area, 1e-10)
