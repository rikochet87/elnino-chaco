# SIG El Niño Argentina

Aplicación web instalable (PWA) que traduce los pronósticos oficiales de El Niño en información territorial: qué puede pasar con la lluvia, los caminos rurales, el dengue y el calor en cada departamento, y cómo prepararse. Piloto: provincia de Chaco.

> **Estado: demostración.** La web funciona, pero los valores publicados son ilustrativos (`"demo": true` en la emisión). Todavía no provienen de ERA5, Copernicus ni Sentinel. El esquema de datos es el definitivo, así que la emisión real reemplazará a la demo sin cambiar la web.

## Qué incluye

- **Vista ciudadana** (`docs/index.html`): búsqueda por localidad o ubicación, tarjetas en lenguaje simple (lluvia, caminos, dengue, calor), agua observada por satélite, consejos de preparación y mapa por tema.
- **Vista técnica** (`docs/tecnica.html`): capas continuas (R, H, E, V, pérdida de bosque, agua observada), desglose del índice por departamento, tabla ordenable, descargas en JSON, GeoJSON y CSV.
- **Funciona sin conexión**: el service worker guarda la aplicación y la última emisión. No usa teselas externas ni tipografías de terceros.

## Estructura

```
docs/                     sitio publicado (GitHub Pages sirve esta carpeta)
  data/
    emision-actual.json   puntero a la emisión vigente
    emision-AAAA-MM.json  resultados por departamento y módulo
    departamentos.geojson límites de Chaco (IGN SIG 250)
    contexto.geojson      provincias vecinas, solo referencia visual
    localidades.json      nombres para la búsqueda
  js/  css/  vendor/  fonts/  icons/
  sw.js  manifest.webmanifest
pipeline/                 procesamiento de datos reales (ver PIPELINE.md)
tests/                    pruebas automáticas del pipeline
scripts/
  preparar_geometrias.py  departamentos de Chaco desde el GeoJSON del IGN
  generar_demo.py         emisión de demostración (valores ilustrativos)
  generar_iconos.py       íconos de la PWA
```

## Publicar una emisión nueva

El pipeline (`pipeline/`) genera la emisión real con Earth Engine y Copernicus. La puesta en marcha y los comandos están en **[PIPELINE.md](PIPELINE.md)**. En resumen:

```bash
python -m pipeline historico     # una vez
python -m pipeline caminos       # una vez
python -m pipeline mensual --emision 2026-12 --prob-nino 0.62 --intensidad moderada
git add docs/data && git commit -m "Emisión 2026-12" && git push
```

GitHub Pages publica en uno o dos minutos, y los usuarios reciben la emisión nueva la próxima vez que abren la app con conexión.

Si cambian archivos de la aplicación (JS, CSS, HTML), subir el número `VERSION` en `docs/sw.js` para que los celulares descarguen la versión nueva.

## Desarrollo local

```bash
cd docs && python3 -m http.server 8000
# abrir http://localhost:8000
```

Regenerar datos:

```bash
pip install shapely pillow
python scripts/preparar_geometrias.py ruta/departamentos-argentina.json
python scripts/generar_demo.py
python scripts/generar_iconos.py
```

`departamentos-argentina.json` proviene de [mgaitan/departamentos_argentina](https://github.com/mgaitan/departamentos_argentina), conversión a GeoJSON del SIG 250 del IGN.

## Método (resumen)

R = (H · E · V)^(1/3), con H = P(Niño) · (w₁·Â + w₂·C) + w₃·F̂ y pesos iniciales w₁ = 0,4, w₂ = 0,2, w₃ = 0,4 (decisión propia, a calibrar). Normalización min-max 0,01–1 y categorías por quintiles. Marco amenaza–exposición–vulnerabilidad (IPCC, UNDRR) y agregación del INFORM Risk Index. El documento de arquitectura completo detalla fuentes, módulos y referencias.

Es una herramienta de **riesgo relativo**: no es un pronóstico ni una alerta oficial. Para alertas, consultar al Servicio Meteorológico Nacional y a Defensa Civil.

## Licencias

- Código: MIT (`LICENSE`).
- Datos publicados: CC BY 4.0.
- Límites departamentales: Instituto Geográfico Nacional.
- MapLibre GL JS: licencia BSD-3 (`docs/vendor/LICENSE.txt`). IBM Plex: SIL Open Font License (`docs/fonts/OFL.txt`).

Proyecto independiente de Matias Roselló.
