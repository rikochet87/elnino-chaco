# Pipeline de datos: puesta en marcha

El pipeline reemplaza la emisión de demostración por datos reales. Corre en tu PC con tus cuentas de Google Earth Engine y Copernicus, y escribe el archivo que lee la web (`docs/data/emision-AAAA-MM.json`).

> **Estado:** el código está probado con datos simulados (20 pruebas automáticas y un ensayo completo de la emisión mensual). Todavía no se corrió contra Earth Engine ni Copernicus, porque eso requiere tus cuentas. La primera corrida real puede pedir ajustes menores, por ejemplo si cambió el nombre de un conjunto de datos o el formato de las descargas.

## Qué hace cada paso

| Comando | Frecuencia | Qué calcula | Fuentes |
| --- | --- | --- | --- |
| `historico` | Una vez (y si cambia el método) | Veranos Niño desde 1982; lluvia normal y anomalía Niño; noches tropicales; días aptos para el mosquito; zonas bajas; pérdida de bosque; población | NOAA CPC (ONI), CHIRPS, ERA5-Land, MERIT Hydro (HAND), Hansen GFC, WorldPop |
| `caminos` | Una vez (y cada tanto) | Km de caminos rurales por departamento | OpenStreetMap (Overpass) |
| `mensual` | Cada mes | Probabilidades de lluvia del trimestre, agua observada del mes, índices y categorías; control de calidad; publicación | Copernicus C3S (SEAS5), Sentinel-1, JRC Global Surface Water |

Los archivos de trabajo quedan en `pipeline/datos/` (no se suben a GitHub).

## 1. Instalar (una vez)

En Windows, desde la carpeta del proyecto, con Python 3.11 o superior:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest -q tests      # deberían pasar las 20 pruebas
```

## 2. Cuenta de Google Earth Engine (gratis, uso no comercial)

1. Entrá a https://earthengine.google.com y registrá un proyecto **no comercial** de Google Cloud.
2. Anotá el **ID del proyecto** (por ejemplo `sig-el-nino-472013`).
3. En la terminal: `earthengine authenticate` y seguí los pasos del navegador.
4. En `pipeline/config.yaml`, reemplazá `TU-PROYECTO-GEE` por tu ID.

## 3. Cuenta de Copernicus Climate Data Store (gratis)

1. Registrate en https://cds.climate.copernicus.eu.
2. En tu perfil, copiá tu **API token**.
3. Creá el archivo `C:\Users\<tu usuario>\.cdsapirc` con este contenido:
   ```
   url: https://cds.climate.copernicus.eu/api
   key: TU-TOKEN
   ```
4. Abrí la página del conjunto **Seasonal forecast monthly statistics on single levels** (`seasonal-monthly-single-levels`), pestaña *Download*, y **aceptá la licencia**. Sin ese paso la descarga falla.

## 4. Primera corrida

```powershell
python -m pipeline historico
python -m pipeline caminos
```

- `historico` tarda varios minutos: Earth Engine procesa más de 40 veranos.
- `caminos` descarga los caminos de Chaco desde OpenStreetMap; si Overpass está saturado, reintentá más tarde.

### Opcional: km de caminos con agua

`caminos` deja `pipeline/datos/caminos_rurales_ee.csv`. Para que el pipeline mida qué caminos quedaron con agua:

1. En el editor de código de Earth Engine (https://code.earthengine.google.com), pestaña *Assets* → *New* → *CSV file (.csv)*.
2. Subí el CSV; como columna de geometría indicá `WKT`. Nombre sugerido: `caminos_chaco`.
3. En `config.yaml` completá `gee.asset_caminos: projects/<tu-proyecto>/assets/caminos_chaco`.

Sin este paso, la web muestra "Sin dato aún" en caminos con agua y el resto funciona igual.

## 5. Emisión mensual

1. Buscá la **probabilidad oficial de El Niño** para el trimestre diciembre–febrero en el pronóstico ENSO de IRI/CPC, publicado alrededor del día 10 de cada mes (https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/).
2. Corré primero un borrador:
   ```powershell
   python -m pipeline mensual --emision 2026-12 --prob-nino 0.62 --intensidad moderada --borrador
   ```
3. Revisá los avisos y el archivo `pipeline/datos/emision-2026-12-borrador.json`.
4. Si está bien, publicá (mismo comando sin `--borrador`). Eso escribe `docs/data/emision-2026-12.json` y actualiza `emision-actual.json`.
5. Probá la web localmente (`cd docs` y `python -m http.server 8000`) y subí los cambios:
   ```powershell
   git add docs/data
   git commit -m "Emisión 2026-12"
   git push
   ```

En cuanto la web recibe una emisión con `"demo": false`, oculta sola la franja y las etiquetas de demostración.

### Control de calidad

La publicación se frena (y el resultado queda como `-rechazada.json` en `pipeline/datos/`) si faltan departamentos, si las probabilidades no suman 1, si hay valores fuera de rango o categorías inválidas. Da avisos, sin frenar, cuando un departamento cambia más de dos categorías respecto del mes anterior o cuando faltan los km de caminos con agua.

## Decisiones de método a revisar en la calibración

- **Pesos del índice vial** (`w1`, `w2`, `w3` en `config.yaml`): son una decisión propia; hay que contrastarlos con las inundaciones de 1997-98 y 2015-16.
- **Resolución de C3S:** la grilla es de 1°, así que varios departamentos comparten celda. Cada departamento toma la celda más cercana a su punto representativo.
- **Dengue y calor:** por ahora la vulnerabilidad se reduce a la población (WorldPop 2020). Faltan NBI y población de 65 años o más (INDEC).
- **Agua observada:** se usa el mes anterior a la emisión, con un umbral de Otsu sobre la mediana VV de Sentinel-1. Conviene revisar visualmente en QGIS los primeros meses.
- **Pérdida de bosque:** se usa Hansen (2004–2023) por estar disponible en Earth Engine; MapBiomas Argentina es una alternativa local.
