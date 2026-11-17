"""Grilla regional ICON-EPS (Open-Meteo), 7 días en hora argentina.

Muestreo de 0,25 grados: las celdas muestran escenarios del modelo, no radar.
Sólo biblioteca estándar. No usa coordenadas de usuarios.
"""
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://ensemble-api.open-meteo.com/v1/ensemble'


def resumen(valores):
    if not valores or any(not isinstance(x, (float, int)) or not math.isfinite(x) or x < 0 for x in valores):
        raise ValueError('Ensamble incompleto o inválido')
    orden = sorted(valores)
    def q(p):
        i = (len(orden) - 1) * p
        a = int(i)
        return round(orden[a] + (orden[min(a + 1, len(orden) - 1)] - orden[a]) * (i - a), 1)
    return {'p10': q(.1), 'mediana': q(.5), 'p90': q(.9), 'miembros': len(orden),
            'prob': {str(u): round(100 * sum(x > u for x in orden) / len(orden)) for u in (1, 10, 20, 50)}}


def generar():
    puntos = [(round(-63.375 + i * .25, 3), round(-28.375 + j * .25, 3)) for j in range(18) for i in range(22)]
    celdas, fechas = [], None
    for inicio in range(0, len(puntos), 10):
        lote = puntos[inicio:inicio + 10]
        params = urllib.parse.urlencode({'latitude': ','.join(str(y) for x, y in lote),
            'longitude': ','.join(str(x) for x, y in lote), 'daily': 'precipitation_sum',
            'models': 'icon_seamless', 'forecast_days': 7, 'timezone': 'America/Argentina/Buenos_Aires'})
        for intento in range(6):
            try:
                with urllib.request.urlopen(URL + '?' + params, timeout=90) as r:
                    respuestas = json.load(r)
                break
            except urllib.error.HTTPError as exc:
                if intento == 5: raise
                if exc.code == 429:
                    print('Límite temporal de Open-Meteo; reintento en 60 segundos', flush=True)
                    time.sleep(60)
                else:
                    time.sleep(3 * (intento + 1))
            except (OSError, TimeoutError):
                if intento == 5: raise
                time.sleep(3 * (intento + 1))
        if not isinstance(respuestas, list): respuestas = [respuestas]
        if len(respuestas) != len(lote): raise ValueError('Faltan puntos')
        for (lon, lat), respuesta in zip(lote, respuestas):
            d = respuesta['daily']
            if fechas is None: fechas = d['time']
            if d['time'] != fechas or len(fechas) != 7: raise ValueError('Fechas incompatibles')
            miembros = [v for k, v in d.items() if k == 'precipitation_sum' or k.startswith('precipitation_sum_member')]
            if len(miembros) != 40 or any(len(m) != 7 for m in miembros): raise ValueError('Faltan miembros')
            celdas.append({'centro': [lon, lat], 'dias': [resumen([m[i] for m in miembros]) for i in range(7)]})
        print(f'{len(celdas)}/{len(puntos)} puntos', flush=True)
        time.sleep(4)
    datos = {'consultado': datetime.now(timezone.utc).isoformat(), 'modelo': 'ICON-EPS (icon_seamless), DWD vía Open-Meteo',
        'fuente': 'https://open-meteo.com/en/docs/ensemble-api', 'paso': .25, 'fechas': fechas, 'celdas': celdas,
        'nota': 'Muestreo regional 0,25° (~25 km). Días 00–24 h Argentina. Probabilidades sin calibración local.'}
    destino = ROOT / 'docs/data/precipitacion.json'
    temporal = destino.with_suffix('.tmp')
    temporal.write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporal.replace(destino)


if __name__ == '__main__': generar()
