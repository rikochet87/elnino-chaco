# El Niño Argentina

**Sitio web:** https://rikochet87.github.io/elnino-chaco/

Este sitio muestra qué puede pasar en cada zona de la provincia de Chaco este verano si se confirma El Niño. Muestra qué esperar de la lluvia, si hay riesgo de que se corten los caminos rurales, si el clima favorece al mosquito del dengue y cuánto calor húmedo puede hacer. También da consejos para prepararse.

La información se actualiza una vez por mes y está escrita para que la entienda cualquier persona. Para quienes trabajan con datos, hay una vista técnica con los números completos y archivos para descargar.

> **Importante:** el sitio muestra **tendencias y probabilidades para toda la temporada** (diciembre a febrero). No es el pronóstico del tiempo de un día ni una alerta oficial. Ante una emergencia, seguí las indicaciones del [Servicio Meteorológico Nacional](https://www.smn.gob.ar/) y de Defensa Civil de tu provincia.

---

## Contenido

1. [Qué es El Niño y por qué importa en Chaco](#qué-es-el-niño-y-por-qué-importa-en-chaco)
2. [Cómo usar el sitio](#cómo-usar-el-sitio)
3. [Qué significa cada parte de la ficha](#qué-significa-cada-parte-de-la-ficha)
4. [De dónde salen los datos](#de-dónde-salen-los-datos)
5. [Cómo se calcula cada resultado](#cómo-se-calcula-cada-resultado)
6. [Qué no hace el sitio](#qué-no-hace-el-sitio)
7. [Para quienes quieran ver o usar el código](#para-quienes-quieran-ver-o-usar-el-código)

---

## Qué es El Niño y por qué importa en Chaco

El Niño es un calentamiento del agua del océano Pacífico, frente a las costas de Perú y Ecuador. Aunque pasa lejos, cambia el clima en buena parte del mundo. En el noreste argentino suele traer **veranos más lluviosos**, y eso se traduce en campos anegados, caminos de tierra intransitables, crecidas de ríos y más mosquitos.

Los Niños de 1997-98 y 2015-16 fueron de los más fuertes registrados y dejaron grandes inundaciones en la región. En noviembre de 2026, el Pacífico ya estaba **+2,5 °C más caliente que lo normal**, más que a la misma altura de esos dos años. El gráfico de la página de inicio muestra esa comparación.

---

## Cómo usar el sitio

### 1. Tocá tu departamento en el mapa

Lo primero que aparece es el mapa de Chaco. Al tocar un departamento se abre una ficha emergente con lo esencial: lluvia esperada, posibilidad de cortes de caminos, condiciones para el dengue, calor húmedo y agua fuera de lo habitual. Con los botones **Lluvia, Caminos, Dengue, Calor y Agua observada** cambiás qué colorea el mapa. El botón **"Ver la ficha completa"** baja a la explicación detallada.

### 1b. O buscá tu zona

En la parte de arriba hay un buscador. Podés:

- **Escribir el nombre de tu localidad o departamento**, por ejemplo *Resistencia*, *Charata* o *Castelli*, y elegirlo de la lista.
- **Tocar "Usar mi ubicación"**: el sitio detecta en qué departamento estás. También consulta el pronóstico para las coordenadas del dispositivo, enviándolas a Open-Meteo. Estas coordenadas no se guardan ni se incluyen en enlaces compartidos. Si el navegador ya tiene permiso, se usa la ubicación automáticamente al abrir; si no, el botón permite solicitarlo.

Arriba a la derecha está el botón **ES / EN** para ver el sitio en español o en inglés. El idioma elegido queda guardado y se incluye en el enlace cuando compartís la ficha.

### Pronóstico de lluvia y tormentas para los próximos 7 días

La ficha muestra el pronóstico diario de Open-Meteo para la localidad elegida o la ubicación del dispositivo: precipitación acumulada (mm), probabilidad máxima diaria de precipitación (%) y estado del tiempo. Los códigos WMO 95, 96 y 99 indican tormentas (96 y 99, con granizo); no representan una probabilidad de tormenta ni una alerta oficial.

El buscador incluye 91 localidades con coordenadas oficiales de [Georef Argentina](https://apis.datos.gob.ar/georef/api/localidades?provincia=chaco&max=1000), guardadas en `docs/data/localidades.json`. Al elegir un departamento en el mapa, se muestra el pronóstico de su cabecera. Al buscar una localidad se usan sus propias coordenadas; al usar el dispositivo, las coordenadas obtenidas por geolocalización. La ubicación del dispositivo funciona también fuera de Chaco, mientras que el mapa y los indicadores estacionales siguen limitados a la provincia. Los días se calculan en hora argentina. Esta información es de corto plazo y tiene su propia fecha de consulta, independiente de la emisión estacional mensual.

La consulta se realiza al elegir la localidad o usar la ubicación, sin clave de API. Se reutiliza durante una hora y el botón **Volver a consultar** permite actualizarla antes. Para localidades, si no hay conexión, se muestra la última copia guardada con una advertencia de posible desactualización; si no existe copia, se informa que no hay datos disponibles. El pronóstico del dispositivo sólo se conserva en memoria durante la sesión. Fuente: [Open-Meteo](https://open-meteo.com/), CC BY 4.0. El servicio gratuito tiene límites y está destinado a uso no comercial.

Pruebas de la integración: `node --test tests/test_pronostico.cjs` (Node.js 18 o superior).

### Mapa de precipitación y probabilidades por cantidad

El mapa inicia con **Pronóstico de lluvia**: celdas de muestreo regional de 0,25° (~25 km), recortadas al contorno provincial de Chaco, sin colorear departamentos completos. El valor cero es transparente y los valores bajos se muestran con menor intensidad, para no teñir todo el mapa base. Elegí un día y mostrá la mediana de precipitación en mm o la probabilidad de superar 1, 10, 20 o 50 mm. Los límites departamentales sirven como referencia. Las demás pestañas conservan los indicadores estacionales.

Las probabilidades salen de **ICON-EPS (DWD), 40 miembros vía Open-Meteo**: proporción de escenarios que dan una cantidad **estrictamente mayor** al umbral en un día de 00 a 24 h de Argentina. No están calibradas localmente. La ficha consulta las coordenadas de la localidad, del dispositivo o del punto tocado dentro de Chaco; muestra mediana, percentiles 10–90 y las cuatro probabilidades. Los percentiles describen la dispersión del conjunto, no garantizan contener la lluvia observada. El pronóstico diario y el detalle de las próximas 72 horas provienen del endpoint general (mejor combinación de modelos) y pueden diferir del conjunto ICON.

El modelo global tiene una resolución aproximada de 26 km; consultar coordenadas precisas no da precisión por calle. El mapa muestrea a una escala comparable (0,25°) y no interpola detalle adicional. **No es radar ni una alerta de tormenta**. El día de hoy incluye las horas ya transcurridas: no es una ventana móvil de próximas 24 horas.

Se muestran localidades seleccionables (con separación de etiquetas para evitar superposición) y el mapa base de **OpenStreetMap**, con caminos y nombres. El mapa base necesita conexión. `scripts/preparar_grilla_precipitacion.py` genera una sola vez `precipitacion-celdas.geojson` con Shapely y los límites IGN; hay que regenerarlo si cambian la grilla o los límites. La grilla y las fichas previamente consultadas pueden reutilizarse sin conexión; se indica la antigüedad de los datos. No se precargan teselas OSM para uso sin conexión.

`python scripts/actualizar_precipitacion.py` genera `docs/data/precipitacion.json` con 396 puntos regionales. La publicación es atómica: si falta un punto, día o miembro, se conserva el archivo anterior. `.github/workflows/precipitacion.yml` actualiza cada seis horas; la interfaz avisa cuando la grilla tiene más de 12 horas. No usa ubicaciones de visitantes. Las consultas por punto se hacen en el dispositivo y respetan la caché de una hora; si falla el conjunto, se informa y se conserva el pronóstico general sin inventar probabilidades.

Pruebas: `node --test tests/test_pronostico.cjs` y `python -m unittest discover -s tests -p 'test_precipitacion.py'`. La prueba de navegador `python -m unittest discover -s tests -p 'test_precipitacion_browser.py'` requiere Playwright para Python y Chromium; cubre controles del mapa, selección de un punto/localidad, idioma, tamaño móvil y geolocalización autorizada con respuestas controladas.

### 2. Leé la ficha de tu zona

Aparecen cuatro tarjetas (lluvia, caminos rurales, dengue y calor) y un recuadro con el agua que se ve desde el satélite este mes. Cada una explica en una frase qué significa. El detalle está en [Qué significa cada parte de la ficha](#qué-significa-cada-parte-de-la-ficha).

### 3. Mirá el mapa

Más abajo hay un mapa de Chaco por departamento. Con las pestañas (**Lluvia, Caminos, Dengue, Calor, Agua observada**) cambiás qué se muestra. Tocando un departamento, se abre su ficha.

### 4. Seguí los consejos

La sección **"Qué podés hacer para prepararte"** tiene recomendaciones concretas para la casa, para quien vive o trabaja en el campo y para antes de viajar.

### 5. Compartí la información

El botón **"Compartir la ficha de mi zona"** genera un mensaje para WhatsApp u otras aplicaciones, con un enlace que abre directamente la ficha de tu departamento.

### 6. Instalalo en el celular (opcional)

El sitio se puede instalar como una aplicación:

- **Android (Chrome):** menú ⋮ → *Instalar aplicación* o *Agregar a la pantalla principal*.
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

Una vez abierto, **funciona sin conexión**: guarda la última información, algo útil en zonas rurales con poca señal.

### 7. Cómo llega El Niño a Chaco (3D)

Desde el gráfico del océano, el botón **"Ver en 3D cómo llega El Niño hasta Chaco"** abre un recorrido sobre un globo en 3D. Bajando con el scroll se ven cinco pasos:

1. El Pacífico se calienta: la temperatura del mar de los últimos seis meses, semana por semana, actualizada todos los días.
2. Sobre el agua caliente hay más evaporación y más tormentas.
3. Esas tormentas generan una onda en la atmósfera que refuerza la corriente en chorro subtropical sobre el centro de Argentina.
4. La humedad que llueve en Chaco llega desde la Amazonía: la cordillera de los Andes, que se ve en 3D, funciona como un muro que la desvía hacia el sur por el chorro de capas bajas.
5. La lluvia carga los ríos de la cuenca del Plata, y la crecida baja por el Paraná y el Paraguay hasta Corrientes y Barranqueras.

Los vientos, la humedad y la lluvia que se muestran son el promedio real de los años con El Niño desde 1983. Las alturas de las capas están exageradas para que se distingan. En celulares viejos o navegadores sin 3D se puede leer el recorrido igual.

El globo se maneja como Google Earth, también durante el recorrido:

| Qué hacer | Mouse | Celular | Teclado |
| --- | --- | --- | --- |
| Mover el globo | Arrastrar | Un dedo | Flechas |
| Acercar o alejar | Rueda (en el recorrido, Ctrl + rueda) | Pellizcar con dos dedos | + y − |
| Girar el rumbo | Clic derecho y arrastrar a los costados (o Shift + arrastrar) | Rotar dos dedos | Shift + ← → |
| Inclinar la vista | Clic derecho y arrastrar arriba o abajo | Deslizar dos dedos arriba o abajo | Shift + ↑ ↓ |
| Acercarse a un lugar | Doble clic | Doble toque | |

Los botones de la derecha también acercan, alejan, vuelven el norte arriba (la brújula), inclinan la vista (**3D**), activan la **imagen satelital** de la NASA y vuelven a la vista inicial.

Con **"Explorar el globo"** se pasa a pantalla completa con un panel de capas: temperatura del mar, tormentas, onda en altura, chorro subtropical, humedad de la Amazonía, lluvia en años con El Niño, ríos de la cuenca del Plata, Chaco y nombres. Al acercarse aparecen los límites de provincias y de los departamentos de Chaco. Con **Esc** o **"Volver al recorrido"** se vuelve al relato.

La imagen satelital tiene unos 10 km por píxel: sirve para ver el continente y la región, no calles ni campos.

### 8. Vista técnica

El botón **"Vista técnica"** abre una página para profesionales: los componentes del índice de riesgo, capas numéricas en el mapa, una tabla ordenable de los 25 departamentos y archivos para descargar (JSON, GeoJSON y CSV).

---

## Qué significa cada parte de la ficha

### El Pacífico este año

Es el gráfico de la franja azul. La línea roja muestra cuánto más caliente que lo normal está el océano este año, y las líneas grises, cómo evolucionaron los Niños de 1997-98 y 2015-16. Por encima de **+0,5 °C** sostenido se considera El Niño, y por encima de **+2 °C**, muy fuerte.

### Lluvia

Indica si el verano va a ser más o menos lluvioso que lo normal en tu zona.

- **Los 51 puntos** son 51 simulaciones del modelo de pronóstico europeo (ECMWF). Cada punto azul es una simulación que da **más lluvia que lo normal**. Si casi todos son azules, hay mucha coincidencia entre las simulaciones y la señal es fuerte.
- **"Lo normal"** son los milímetros que llueven en un verano típico en tu zona (promedio 1991–2020).
- **"El pronóstico espera en promedio X % más"** es cuánto más llueve, en promedio, en las 51 simulaciones.
- **"En los veranos con El Niño de años anteriores"** es cuánto más llovió en tu departamento, en promedio, durante los Niños desde 1982.

### Caminos rurales

Es la **posibilidad de que los caminos de tierra se corten por agua**, comparada con el resto de la provincia, en cinco niveles: muy baja, baja, media, alta y muy alta. Combina tres cosas: cuánta lluvia se espera, cuántos caminos rurales hay en la zona y qué tan baja y desmontada es la zona.

### Dengue

Indica si el **clima** (calor y lluvia) favorece que se reproduzca el mosquito *Aedes aegypti*. **No predice casos de dengue**: los brotes también dependen de otros factores, como el tipo de virus que circula o lo que pasa en las provincias y países vecinos. Para ver casos reales, consultá el [Boletín Epidemiológico Nacional](https://www.argentina.gob.ar/salud/boletin-epidemiologico-nacional).

### Calor

Indica el riesgo de **calor húmedo y noches que no refrescan**. Con El Niño, las temperaturas máximas no suelen subir en Chaco, pero la humedad puede hacer que la sensación térmica sea alta. Es especialmente importante para adultos mayores, bebés y quienes trabajan al aire libre.

### Agua observada este mes

Es la superficie de **campos y caminos con agua fuera de lo habitual** que se ve en las imágenes satelitales del último mes, en km² por departamento, y cuántos km de caminos rurales quedaron con agua. No cuenta ríos, lagunas ni esteros permanentes. A diferencia de las otras tarjetas, **no es un pronóstico: es lo que ya pasó.**

---

## De dónde salen los datos

Todos los datos son **públicos y gratuitos**. El sitio no inventa números: los toma de estas fuentes y los combina.

| Qué se usa | Fuente | Para qué |
| --- | --- | --- |
| Temperatura del océano Pacífico (índice ONI) | [NOAA, Centro de Predicción Climática de EE. UU.](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php) | Saber qué veranos fueron de El Niño desde 1982 y dibujar el gráfico del océano |
| Probabilidad de El Niño para el verano | [IRI, Universidad de Columbia](https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/) y NOAA | Pesar el riesgo según qué tan seguro es que haya El Niño |
| Pronóstico de lluvia (51 simulaciones) | Modelo estacional europeo **ECMWF SEAS5**, a través de [Open-Meteo](https://open-meteo.com/) | Tarjeta de lluvia y amenaza del índice de caminos |
| Lluvia de cada verano desde 1982 | **CHIRPS** (Universidad de California, Santa Bárbara), combina satélite y estaciones, unos 5 km de detalle | Lluvia normal y cuánto llovió en los Niños anteriores |
| Temperatura diaria desde 1982 | **ERA5-Land** (Copernicus, Unión Europea) | Noches tropicales (calor) y días aptos para el mosquito (dengue) |
| Imágenes de radar satelital | **Sentinel-1** (Agencia Espacial Europea) | Agua observada. El radar ve a través de las nubes, algo clave en temporadas lluviosas |
| Ríos, lagunas y esteros permanentes | **JRC Global Surface Water** (Comisión Europea) | Descontarlos del agua observada, para mostrar solo el agua nueva |
| Relieve: altura sobre el arroyo o río más cercano | **MERIT Hydro** (Universidad de Tokio) | Identificar zonas bajas, más propensas a anegarse |
| Pérdida de bosque nativo 2004–2023 | **Global Forest Change** (Universidad de Maryland) | Vulnerabilidad: menos monte, menos absorción de agua |
| Población | **WorldPop 2020** (Universidad de Southampton) | Cuántas personas están expuestas al dengue y al calor |
| Caminos | **OpenStreetMap** | Kilómetros de caminos rurales por departamento y caminos con agua |
| Temperatura diaria del mar (página 3D) | **NOAA OISST v2.1**, a través de NOAA CoastWatch y NOAA PSL | Animación del calentamiento del Pacífico, actualizada todos los días |
| Vientos en altura y humedad (página 3D) | **Reanálisis NCEP/NCAR R1** (NOAA PSL) | Chorro subtropical, onda en altura y chorro de capas bajas en los años con El Niño |
| Lluvia en Sudamérica (página 3D) | **GPCP v2.3** (NOAA PSL), satélite y pluviómetros | Cuánto más llueve en la cuenca del Plata en los años con El Niño |
| Costas, países, provincias y ríos (página 3D) | **Natural Earth** (dominio público) | Mapa del globo, límites al acercarse y ríos de la cuenca del Plata |
| Imagen satelital (página 3D) | **NASA Blue Marble Next Generation**, a través de NASA GIBS (dominio público) | Vista satelital del globo |
| Relieve de Sudamérica (página 3D) | **NOAA ETOPO1** (dominio público), grilla de 0,1° | Cordillera de los Andes en 3D, con la altura exagerada 30 veces |
| Límites de los departamentos | **Instituto Geográfico Nacional** | Mapa y cálculos por departamento |

Las capas satelitales e históricas se procesan en **Google Earth Engine**, una plataforma gratuita para uso no comercial que permite calcular sobre imágenes de satélite sin descargarlas.

---

## Cómo se calcula cada resultado

### En pocas palabras

Cada mes, un programa (el *pipeline*, en la carpeta `pipeline/`) hace estos pasos:

1. **Mira el pasado.** Calcula cuánto llovió y cuánto calor hizo en cada uno de los 45 veranos entre 1982 y 2026, y separa los que fueron de El Niño. Esto se hace una sola vez.
2. **Mira el pronóstico.** Pide al modelo europeo las 51 simulaciones de lluvia para diciembre a febrero y cuenta cuántas dan más lluvia que lo normal.
3. **Mira el satélite.** Busca en las imágenes de radar del último mes las zonas con agua fuera de lo habitual.
4. **Combina todo** en índices de riesgo por departamento.
5. **Controla la calidad.** Si falta un departamento o hay valores imposibles, no publica nada.
6. **Publica** los resultados en la web.

Los datos de la página 3D se actualizan solos en GitHub, sin necesidad de una computadora encendida. La temperatura del mar se descarga todos los días. Los vientos y la lluvia de los años con El Niño se calculan una vez, y se vuelven a calcular cuando hay un Niño nuevo.

### Riesgo de cortes de caminos

Sigue el esquema que usan Naciones Unidas y el IPCC para medir riesgo: **riesgo = amenaza × exposición × vulnerabilidad**.

| Componente | Qué mide | Cómo |
| --- | --- | --- |
| **Amenaza (H)** | Cuánta lluvia extra se espera | Combina la probabilidad de El Niño, cuánto llovió en los Niños anteriores, qué tan seguido pasó y el pronóstico de las 51 simulaciones |
| **Exposición (E)** | Cuántos caminos rurales hay | Kilómetros de caminos rurales por km² de departamento (OpenStreetMap) |
| **Vulnerabilidad (V)** | Qué tan fácil se anega la zona | Promedio de dos cosas: zonas bajas (MERIT Hydro) y pérdida de bosque nativo (Global Forest Change) |

Las tres se combinan con una **media geométrica**, como el índice internacional INFORM de la Comisión Europea. Así, si un componente es bajo, baja el riesgo total. Después se ordenan los 25 departamentos y se agrupan en cinco niveles de cinco departamentos cada uno, de "muy baja" a "muy alta". **El nivel es relativo**: compara cada departamento con el resto de Chaco.

Detalle técnico:

```
R = (H · E · V)^(1/3)
H = P(Niño) · (0,4 · mín(A / 30 %, 1) + 0,2 · C) + 0,4 · F
```

- **P(Niño):** probabilidad oficial de El Niño (IRI/NOAA).
- **A:** cuánto más llovió en promedio en los Niños anteriores (en %).
- **C:** proporción de esos Niños en que llovió más que lo normal.
- **F:** proporción de las 51 simulaciones que dan más lluvia que lo normal.
- E y V se reescalan entre 0,01 y 1 entre los 25 departamentos. H no se reescala: si el pronóstico es húmedo en toda la provincia, la amenaza es alta en toda la provincia.
- Los pesos 0,4, 0,2 y 0,4 son una decisión propia del proyecto y se van a revisar comparando con las inundaciones de 1997-98 y 2015-16.

### Lluvia

Para cada departamento se toma el pronóstico en su punto central (el modelo tiene unos 36 km de detalle). "Más que lo normal" significa por encima del promedio que el mismo modelo da para esa época del año en sus pronósticos de años anteriores. Por eso la probabilidad tiene dos categorías (más o menos de lo normal) y no tres.

### Dengue

Combina tres cosas: cuántos días del verano tienen temperaturas aptas para el mosquito (entre 20 y 32 °C de promedio diario, según ERA5-Land), qué tan húmeda se espera la temporada (pronóstico y Niños anteriores) y cuánta población hay (WorldPop). El resultado se agrupa en cinco niveles, de "poco favorables" a "muy favorables".

### Calor

Cuenta las **noches tropicales**, las noches en que la temperatura no baja de 25 °C, en un verano normal y en los Niños anteriores (ERA5-Land), y las combina con la población. Se agrupa en cinco niveles.

### Agua observada

El radar del satélite Sentinel-1 ve el agua como zonas muy oscuras. Se consideran **agua nueva** los lugares que cumplen tres condiciones:

1. Están más oscuros que −18 dB, un valor típico del agua en radar.
2. Están al menos 3 dB más oscuros que lo habitual para ese mes, según la mediana de 2017 a 2025. Así se descartan suelos que siempre se ven oscuros.
3. No son ríos, lagunas ni esteros permanentes.

Después se suman los km² por departamento y se cruzan con los caminos rurales de OpenStreetMap.

---

## Qué no hace el sitio

- **No es un pronóstico del tiempo diario** ni reemplaza las alertas oficiales del SMN o de Defensa Civil.
- **No da certezas:** son probabilidades. Ningún Niño es igual a otro.
- **No predice casos de dengue**, solo si el clima favorece al mosquito.
- **No pronostica la altura de los ríos** (Paraná, Paraguay, Bermejo), que depende de lluvias en otras provincias y países. La página 3D explica cómo se cargan los ríos, pero las alturas oficiales las pronostica el [INA](https://www.ina.gob.ar/). Calcular la crecida está planificado para una etapa siguiente.
- **Cubre solo la provincia de Chaco.** La idea es extenderlo al resto del noreste y después al país.

---

## Para quienes quieran ver o usar el código

### Estructura

```
docs/        el sitio web (lo que publica GitHub Pages)
  data/      resultados que lee la web: emisión del mes, límites, ONI, datos de la página 3D
pipeline/    programa que descarga, procesa y calcula los datos
tests/       pruebas automáticas del pipeline
scripts/     herramientas auxiliares (geometrías, íconos, datos de demostración)
emision.ps1  publica la emisión del mes en un solo paso (Windows)
.github/     procesos automáticos de GitHub: temperatura del mar diaria y vientos de los años Niño
```

El sitio es una aplicación web instalable (PWA) hecha con HTML, CSS, JavaScript, [MapLibre GL JS](https://maplibre.org/) y, en la página 3D, [three.js](https://threejs.org/). No requiere servidor propio. El mapa base de caminos usa teselas de OpenStreetMap con conexión; las capas y los datos guardados permiten uso parcial sin conexión. El pipeline está en Python.

### Actualizar los datos cada mes

La guía completa, con la instalación, las cuentas necesarias (solo Google Earth Engine) y los comandos, está en **[PIPELINE.md](PIPELINE.md)**. En resumen, después de que IRI/NOAA publica su pronóstico mensual (alrededor del día 19):

```powershell
.\emision.ps1 -ProbNino 1.0 -Intensidad "muy fuerte"
```

### Ver el sitio en tu computadora

```bash
cd docs
python -m http.server 8000
# abrir http://localhost:8000
```

### Licencias y créditos

- **Código:** licencia MIT (archivo `LICENSE`).
- **Resultados publicados:** CC BY 4.0. Podés usarlos citando la fuente.
- **Datos de terceros:** pertenecen a sus autores, listados en [De dónde salen los datos](#de-dónde-salen-los-datos). El pronóstico de lluvia se cita como *Open-Meteo.com (CC BY 4.0), basado en ECMWF SEAS5*.
- **Componentes:** MapLibre GL JS (licencia BSD-3), three.js (licencia MIT) y tipografía IBM Plex (SIL Open Font License).

---

Proyecto independiente de **[Matias Roselló](https://github.com/rikochet87)**, especialista SIG en Chaco, Argentina. No está asociado a ningún organismo público.
