# Pipeline de datos: puesta en marcha

El pipeline reemplaza la emisión de demostración por datos reales. Corre en tu PC con tu cuenta de Google Earth Engine (proyecto `chaco-2727`, ya configurado) y escribe el archivo que lee la web (`docs/data/emision-AAAA-MM.json`).

> **Estado:** el código está probado con datos simulados (26 pruebas automáticas y un ensayo completo de la emisión mensual). El formato de la API de Open-Meteo se verificó con una consulta real. Todavía no se corrió contra Earth Engine: la primera corrida puede pedir ajustes menores, por ejemplo si cambió el nombre de un conjunto de datos.

## Qué hace cada paso

| Comando | Frecuencia | Qué calcula | Fuentes |
| --- | --- | --- | --- |
| `historico` | Una vez (y si cambia el método) | Veranos Niño desde 1982; lluvia normal y anomalía Niño; noches tropicales; días aptos para el mosquito; zonas bajas; pérdida de bosque; población | NOAA CPC (ONI), CHIRPS, ERA5-Land, MERIT Hydro (HAND), Hansen GFC, WorldPop |
| `caminos` | Una vez (y cada tanto) | Km de caminos rurales por departamento | OpenStreetMap (Overpass) |
| `mensual` | Cada mes | Probabilidad de lluvia por encima de lo normal en el trimestre, agua observada del mes, índices y categorías; control de calidad; publicación | ECMWF SEAS5 vía Open-Meteo (sin cuenta), Sentinel-1, JRC Global Surface Water |

Los archivos de trabajo quedan en `pipeline/datos/` (no se suben a GitHub).

## 1. Instalar (una vez)

En Windows, desde la carpeta del proyecto, con Python 3.11 o superior:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest -q tests      # deberían pasar las 26 pruebas
```

## 2. Cuenta de Google Earth Engine (gratis, uso no comercial)

1. Entrá a https://earthengine.google.com y registrá un proyecto **no comercial** de Google Cloud.
2. Anotá el **ID del proyecto** (por ejemplo `sig-el-nino-472013`).
3. En la terminal: `earthengine authenticate` y seguí los pasos del navegador.
4. El ID ya está cargado en `pipeline/config.yaml` (`chaco-2727`).

## 3. Pronóstico de lluvia: Open-Meteo (sin cuenta)

El pronóstico estacional sale del modelo ECMWF SEAS5 (51 miembros) a través de la API de Open-Meteo, que no pide registro. Para cada departamento se calcula la **probabilidad de que llueva más que lo normal** del modelo en el trimestre: la fracción de miembros por encima de su climatología. Son dos categorías (más o menos de lo normal), no terciles.

La web cita la fuente como exige la licencia (Open-Meteo.com, CC BY 4.0). El uso gratuito es para fines no comerciales.

**Alternativa con terciles (opcional):** si más adelante querés las tres categorías oficiales (más, normal, menos), creá una cuenta en el Climate Data Store (cds.climate.copernicus.eu, distinta de Copernicus Browser), guardá tu token en `C:\Users\<usuario>\.cdsapirc`, aceptá la licencia de *seasonal-monthly-single-levels* y cambiá `pronostico.fuente` a `c3s` en `config.yaml`. La web admite los dos formatos.

## 4. Primera corrida

```powershell
python -m pipeline historico
python -m pipeline caminos
```

Si cambiás un umbral de relieve, bosque o población, no hace falta repetir `historico`: alcanza con `python -m pipeline capas`.

```powershell
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

Todo el ciclo (actualizar, correr el pipeline, guardar y subir) lo hace el script `emision.ps1`, desde la carpeta del proyecto:

```powershell
.\emision.ps1 -ProbNino 1.0 -Intensidad "muy fuerte"
```

- `-ProbNino` es la probabilidad oficial de El Niño para diciembre–febrero, del pronóstico ENSO de IRI/CPC, que se publica alrededor del día 19 de cada mes: https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/
- `-UsarAnterior` repite la probabilidad y la intensidad de la última emisión.
- `-Borrador` genera la emisión para revisar, sin publicar ni subir nada.
- `-Emision 2026-12` fuerza un mes; por defecto se usa el mes actual.
- Si el control de calidad falla, el script se detiene y no sube nada. Todo queda registrado en `pipeline/datos/emision.log`.

Si Windows no deja ejecutar el script por la política de ejecución, usá:

```powershell
powershell -ExecutionPolicy Bypass -File .\emision.ps1 -ProbNino 1.0 -Intensidad "muy fuerte"
```

### Programarlo todos los meses

```powershell
.\emision.ps1 -Programar
```

Crea una tarea de Windows que corre el **día 21 de cada mes a las 9:30** con `-UsarAnterior`: la PC tiene que estar encendida y con tu sesión iniciada. Como reutiliza la probabilidad anterior, cuando IRI/CPC cambie su pronóstico conviene correr el script a mano con el valor nuevo. Para quitar la tarea: `schtasks /Delete /TN "SIG El Nino - emision mensual" /F`.

### Paso a paso, sin el script

```powershell
git pull
python -m pipeline mensual --emision 2026-12 --prob-nino 1.0 --intensidad "muy fuerte"
git add docs/data
git commit -m "Emisión 2026-12"
git push
```

### Control de calidad

La publicación se frena (y el resultado queda como `-rechazada.json` en `pipeline/datos/`) si faltan departamentos, si las probabilidades no suman 1, si hay valores fuera de rango o categorías inválidas. Da avisos, sin frenar, cuando un departamento cambia más de dos categorías respecto del mes anterior o cuando faltan los km de caminos con agua.

## Decisiones de método a revisar en la calibración

- **Amenaza en escala fija:** la amenaza vial no se reescala entre departamentos. La anomalía histórica se divide por `anom_lluvia_max_pct` (30 %) y la probabilidad del pronóstico se usa tal cual. Así, si el pronóstico es húmedo en toda la provincia, la amenaza es alta en toda la provincia.
- **Exposición por densidad:** km de camino rural por km² del departamento, para que los departamentos grandes no salgan primeros solo por su tamaño.
- **Agua observada:** el umbral de Otsu se calcula cerca de agua conocida (JRC), donde el histograma tiene agua y tierra. Si sale fuera de −24 a −15 dB, se usa −18 dB. Además se exige un cambio: el píxel debe estar al menos 3 dB más oscuro que la mediana del mismo mes en 2017–2025, para descartar suelos y cauces que siempre se ven oscuros.

- **Pesos del índice vial** (`w1`, `w2`, `w3` en `config.yaml`): son una decisión propia; hay que contrastarlos con las inundaciones de 1997-98 y 2015-16.
- **Pronóstico en dos categorías:** la probabilidad se mide contra la climatología del propio modelo (hindcast del ECMWF), en el punto representativo de cada departamento (grilla de unos 36 km).
- **Dengue y calor:** por ahora la vulnerabilidad se reduce a la población (WorldPop 2020). Faltan NBI y población de 65 años o más (INDEC).
- **Agua observada:** se usa el mes anterior a la emisión, con un umbral de Otsu sobre la mediana VV de Sentinel-1. Conviene revisar visualmente en QGIS los primeros meses.
- **Pérdida de bosque:** se usa Hansen (2004–2023) por estar disponible en Earth Engine; MapBiomas Argentina es una alternativa local.

## Datos de la página 3D (automáticos, en GitHub)

La página "Cómo llega El Niño a Chaco" usa datos que se generan solos en GitHub Actions, sin la PC:

| Proceso | Cuándo corre | Qué hace | Archivo |
| --- | --- | --- | --- |
| **Temperatura del Pacífico (diaria)** | Todos los días a las 11:17 (hora argentina) | Descarga la anomalía diaria de temperatura del mar de NOAA OISST v2.1 (CoastWatch ERDDAP; si no responde, NOAA PSL) y guarda un cuadro por semana de los últimos seis meses | `docs/data/pacifico.json` y `docs/data/pacifico/*.png` |
| **Vientos y lluvia de los veranos Niño** | A mano | Promedia los años con El Niño (según el ONI) del reanálisis NCEP/NCAR y de la lluvia GPCP: viento y altura a 200 hPa, humedad y viento a 850 hPa, lluvia de diciembre a febrero y de septiembre a febrero | `docs/data/atmosfera.json` |

Para correr a mano cualquiera de los dos: en GitHub, pestaña **Actions** → elegir el proceso → **Run workflow**. El de vientos conviene correrlo de nuevo después de cada verano con El Niño (por ejemplo, en marzo de 2027).

Los mismos comandos se pueden correr en la PC: `python -m pipeline pacifico` y `python -m pipeline atmosfera`. No necesitan cuenta.

Como GitHub sube estos datos al repositorio todos los días, antes de trabajar en la PC hay que hacer `git pull` (el script `emision.ps1` ya lo hace).

La geometría del globo (costas, fronteras, ríos de la cuenca del Plata y contorno de Chaco) sale de Natural Earth y se arma una sola vez con `python scripts/preparar_globo.py <carpeta con los geojson>`.
