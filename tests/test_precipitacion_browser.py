"""Flujos de navegador, con respuestas controladas y sin depender de servicios externos.

Requiere Playwright para Python y Chromium del entorno.
"""
import json
import subprocess
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class NavegadorTest(unittest.TestCase):
    def test_mapa_probabilidades_localidad_y_dispositivo(self):
        servidor = subprocess.Popen(['python', '-m', 'http.server', '8765', '--directory', str(ROOT / 'docs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        hoy = datetime.now(ZoneInfo('America/Argentina/Buenos_Aires')).replace(hour=0, minute=0, second=0, microsecond=0)
        fechas = [(hoy + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
        forecast = {'daily': {'time': fechas, 'precipitation_sum': [12]*7, 'precipitation_probability_max': [70]*7, 'weather_code': [95]*7},
            'hourly': {'time': [(hoy + timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(168)], 'precipitation':[1]*168, 'precipitation_probability':[60]*168, 'weather_code':[61]*168}}
        ensemble = {'daily': {'time': fechas, **{('precipitation_sum' if i == 0 else f'precipitation_sum_member{i:02d}'): [i]*7 for i in range(40)}}}
        requests = []
        try:
            with sync_playwright() as p:
                b = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
                context = b.new_context(viewport={'width':1280,'height':900}, service_workers='block')
                context.route('https://tile.openstreetmap.org/**', lambda r: r.abort())
                def api(route):
                    requests.append(route.request.url)
                    route.fulfill(json=ensemble if 'ensemble-api' in route.request.url else forecast)
                context.route('https://api.open-meteo.com/**', api)
                context.route('https://ensemble-api.open-meteo.com/**', api)
                page = context.new_page(); errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto('http://127.0.0.1:8765')
                page.wait_for_selector('#pronostico-dias tr')
                self.assertEqual(page.locator('#pronostico-horas tr').count(),72)
                self.assertEqual(page.locator('#pronostico-dias tr').first.locator('th,td').count(),9)
                detalle = page.locator('#pronostico-dias tr').first.locator('td').nth(3)
                self.assertFalse(detalle.is_visible())
                page.locator('#alternar-escenarios').click()
                self.assertTrue(detalle.is_visible())
                page.locator('#alternar-escenarios').click()
                page.locator('[data-horizonte-btn="verano"]').click()
                self.assertFalse(page.locator('.pronostico').is_visible())
                self.assertTrue(page.locator('#linea-nino').is_visible())
                self.assertTrue(page.locator('#tabs [data-tab="lluvia"]').is_visible())
                self.assertIn('vista=verano',page.url)
                page.locator('[data-horizonte-btn="dias"]').click()
                self.assertTrue(page.locator('.pronostico').is_visible())
                self.assertFalse(page.locator('#linea-nino').is_visible())
                self.assertFalse(page.locator('#tabs').is_visible())
                page.wait_for_selector('#precipitacion-variable')
                slider = page.locator('#precipitacion-umbral')
                self.assertEqual(slider.get_attribute('step'),'5')
                slider.press('ArrowRight')
                self.assertEqual(slider.input_value(),'5')
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'5 mm')
                slider.press('End')
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'100 mm')
                page.locator('.reiniciar-umbral').click()
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'0 mm')
                page.select_option('#precipitacion-variable','20')
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'0 %')
                page.locator('#precipitacion-umbral').press('ArrowRight')
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'5 %')
                page.select_option('#precipitacion-variable','mediana')
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'0 mm')
                page.select_option('#precipitacion-variable','20')
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'5 %')
                page.select_option('#precipitacion-dia','1')
                self.assertIn('≥95 %',page.locator('#leyenda').inner_text())
                self.assertEqual(page.locator('#precipitacion-umbral-valor').inner_text(),'5 %')
                page.locator('#mapa-contenedor canvas').click(position={'x':420,'y':300})
                page.wait_for_function("document.querySelector('#pronostico-zona').textContent.includes('Punto elegido')")
                self.assertIn('P(>20 mm)',page.locator('.pop').inner_text())
                page.fill('#buscar','Miraflores')
                page.locator('#buscador').evaluate('(f)=>f.requestSubmit()')
                page.wait_for_function("document.querySelector('#pronostico-zona').textContent.includes('Miraflores')")
                page.locator('[data-idioma="en"]').click()
                self.assertEqual(page.locator('#leyenda h3').inner_text(),'Precipitation by area')
                page.set_viewport_size({'width':390,'height':844})
                self.assertFalse(page.evaluate('document.documentElement.scrollWidth > innerWidth'))
                self.assertEqual(errors,[])
                # Automatic use only with an already granted permission; no persistent device coordinates.
                context.grant_permissions(['geolocation'],origin='http://127.0.0.1:8765')
                context.set_geolocation({'latitude':-27.451076,'longitude':-58.986484})
                page.reload()
                page.wait_for_function("document.querySelector('#pronostico-zona').textContent.includes('Your current location')")
                page.wait_for_selector('#pronostico-dias tr')
                self.assertFalse(page.evaluate("Object.keys(localStorage).some(k=>k.includes('dispositivo:'))"))
                self.assertNotIn('latitude',page.url)
                self.assertTrue(any('latitude=-27.451076' in r for r in requests))
                # Technical provenance follows the selected department and remains readable on a phone.
                technical = context.new_page()
                technical.set_viewport_size({'width':390,'height':844})
                technical.goto('http://127.0.0.1:8765/tecnica.html')
                technical.wait_for_selector('#metodologia-detalle details')
                self.assertEqual(technical.locator('#metodologia-detalle details').count(),6)
                self.assertEqual(technical.locator('#trazabilidad-filas tr').count(),31)
                technical.select_option('#sel-depto','general-guemes')
                self.assertIn('General Güemes',technical.locator('#trazabilidad-titulo').inner_text())
                technical.locator('#trazabilidad summary').click()
                self.assertFalse(technical.evaluate('document.documentElement.scrollWidth > innerWidth'))
                technical.screenshot(path='/workspace/work/tecnica-mobile.png')
                page.screenshot(path='/workspace/work/inicio-mobile.png')
                page.locator('#resumen').scroll_into_view_if_needed()
                page.screenshot(path='/workspace/work/pronostico-tarjetas-mobile.png')
                page.set_viewport_size({'width':320,'height':720})
                self.assertFalse(page.evaluate('document.documentElement.scrollWidth > innerWidth'))
                technical.set_viewport_size({'width':320,'height':720})
                self.assertFalse(technical.evaluate('document.documentElement.scrollWidth > innerWidth'))
                b.close()
        finally:
            servidor.terminate(); servidor.wait()
