/* Idioma del sitio: español (por defecto) e inglés.
 *
 * Textos fijos: el HTML trae el español y se marca con
 *   data-i18n="clave"        → reemplaza el texto
 *   data-i18n-html="clave"   → reemplaza el HTML interno
 *   data-i18n-attr="atributo:clave,atributo:clave"
 * El español se toma del propio HTML al cargar; el diccionario solo necesita el inglés.
 * Textos que arma JavaScript: I18N.T("clave", ...valores), con español e inglés en DICC.
 * Al cambiar de idioma se dispara el evento "idioma" en document y cada vista se vuelve a dibujar.
 */
(function () {
  "use strict";

  const IDIOMAS = ["es", "en"];
  const MESES = {
    es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };
  const INICIALES = { es: "EFMAMJJASOND", en: "JFMAMJJASOND" };
  const ABREV_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const ABREV_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---------- Textos fijos del HTML (solo inglés; el español sale del HTML) ----------
  const FIJOS_EN = {
    // Comunes
    "saltar": "Skip to content",
    "idioma.grupo": "Language",
    // Vista ciudadana
    "c.titulo": "El Niño Argentina · What could happen in your area",
    "c.descripcion": "What could happen with rain, rural roads, dengue and heat in your department of Chaco if El Niño arrives. Plain-language information, updated every month.",
    "c.demo": "<strong>Demo version.</strong> Values are illustrative and do not come from real forecasts or observations. Do not use them to make decisions.",
    "c.franja-proyecto": "Independent project · Does not replace official alerts",
    "c.marca-sub": "What could happen in your area this summer",
    "c.nav": "Main",
    "c.nav-zona": "My area",
    "c.nav-mapa": "Map",
    "c.nav-prep": "How to prepare",
    "c.nav-faq": "FAQ",
    "c.vista-tecnica": "Technical view",
    "c.h1": "How could El Niño affect your area this summer?",
    "c.hero": "Type your town and we'll tell you, in plain words, what to expect from rain, roads, dengue and heat this summer (<span class=\"js-trimestre\"></span>), and what you can do to prepare. For now it covers Chaco province.",
    "c.buscar-label": "Search your town or department",
    "c.buscar-ph": "E.g.: Resistencia, Charata, Castelli",
    "c.ver-zona": "See my area",
    "c.ubicacion": "Use my location",
    "c.oceano-titulo": "The Pacific is <span id=\"oni-valor\"></span> warmer than normal",
    "c.oceano-link": "See in 3D how El Niño reaches Chaco",
    "c.oceano-fuente": "Temperature of the equatorial Pacific Ocean (NOAA ONI index), three-month average. Above +0.5 °C sustained means El Niño.",
    "c.verano": "Summer: <span class=\"js-trimestre\"></span>",
    "c.lluvia": "Rain",
    "c.caminos": "Rural roads",
    "c.dengue": "Dengue",
    "c.calor": "Heat",
    "c.ver-mapa": "See on the map",
    "c.dengue-texto": "Heat and rain help the mosquito breed. This doesn't mean there will be an outbreak, but it's worth taking precautions now.",
    "c.dengue-link": "Current cases in the National Epidemiological Bulletin (in Spanish)",
    "c.calor-texto": "With El Niño, maximum temperatures don't usually rise, but humidity can make it feel very hot and keep nights from cooling down.",
    "c.calor-link": "Tips for very hot days",
    "c.agua-sobre": "Seen from satellite",
    "c.agua-titulo": "Water observed this month",
    "c.agua-nota": "Does not include permanent rivers, lagoons or marshes. The satellite uses radar, so it can see through clouds.",
    "c.agua-link": "See observed water on the map",
    "c.agua-sup": "Area with water",
    "c.agua-caminos": "Roads with water",
    "c.agua-comp": "Compared with last month",
    "c.prep-titulo": "What you can do to prepare",
    "c.prep-casa": "At home",
    "c.prep-casa-1": "Empty and cover anything that collects water: buckets, tires, flower pots, bottles.",
    "c.prep-casa-2": "Clean gutters and drains before December.",
    "c.prep-casa-3": "Use repellent and mosquito nets, especially at dawn and dusk.",
    "c.prep-casa-4": "On very hot days, drink water often and look after older adults and babies.",
    "c.prep-campo": "If you live or work in the countryside",
    "c.prep-campo-1": "Keep a supply of food, water and medicine in case the road is cut off.",
    "c.prep-campo-2": "Plan ahead for moving the harvest and the livestock.",
    "c.prep-campo-3": "Tell the road consortium or the municipality if you see blocked culverts.",
    "c.prep-viaje": "Before travelling",
    "c.prep-viaje-1": "Check the state of roads before you leave.",
    "c.prep-viaje-2": "Follow the warnings of the <a href=\"https://www.smn.gob.ar/\" rel=\"noopener\">National Meteorological Service</a>.",
    "c.prep-viaje-3": "Do not cross roads or dips with running water.",
    "c.compartir": "Share my area's summary",
    "c.mapa-titulo": "Map of Chaco",
    "c.tabs": "What to show on the map",
    "c.mapa-region": "Map of Chaco departments. Tap a department to see its summary.",
    "c.faq": "Frequently asked questions",
    "c.faq-1q": "What is El Niño?",
    "c.faq-1a": "It is a warming of the Pacific Ocean that changes the climate in many parts of the world. In northeastern Argentina it usually brings rainier summers.",
    "c.faq-2q": "Is this a weather forecast?",
    "c.faq-2a": "No. It shows trends for the whole season. To know whether it will rain tomorrow or whether there is an alert, check the National Meteorological Service.",
    "c.faq-3q": "How certain is it?",
    "c.faq-3a": "These are probabilities, not certainties. No two El Niños are the same. That's why the information is updated every month.",
    "c.faq-4q": "Why does it say “demo”?",
    "c.faq-4a": "The site already works, but the real climate data are still being processed. Until then, the values are examples.",
    "c.faq-5q": "Does it work without signal?",
    "c.faq-5a": "Yes. If you have opened the site once, you can install it on your phone and see the latest information even without a connection.",
    "c.pie-aviso": "This information does not replace official alerts.",
    "c.pie-emergencia": "In an emergency, follow the instructions of the <a href=\"https://www.smn.gob.ar/\" rel=\"noopener\">National Meteorological Service</a> and your province's Civil Defense.",
    "c.pie-fuentes": "Rain forecast: <a href=\"https://open-meteo.com/\" rel=\"noopener\">Open-Meteo.com</a> (CC BY 4.0), based on ECMWF SEAS5. Other sources: CHIRPS, ERA5-Land, Sentinel-1, NOAA, IGN, WorldPop and OpenStreetMap. Department boundaries: IGN. Data under CC BY 4.0 license.",
    "c.pie-proyecto": "Independent project",
    "c.pie-links": "<a href=\"como-llega.html\">How El Niño reaches Chaco</a> · <a href=\"tecnica.html\">Technical view and data</a> · <a href=\"https://github.com/rikochet87/elnino-chaco\" rel=\"noopener\">Code</a>",
    // Cómo llega El Niño a Chaco (página 3D)
    "g.titulo": "How El Niño reaches Chaco · El Niño Argentina",
    "g.descripcion": "A 3D journey with real data: Pacific warming, storms, jet streams, Amazon moisture and the river floods that reach Chaco.",
    "g.marca-sub": "How El Niño reaches Chaco",
    "g.volver": "Back to my area",
    "g.sin-3d": "Your browser can't display the 3D globe. You can still read the journey: each card explains one step.",
    "g.leyenda": "Legend",
    "g.h1": "How El Niño reaches Chaco",
    "g.inicio-1": "El Niño begins almost 10,000 km away, in the central Pacific Ocean. This journey uses real data to show how that heat ends up as more rain in Chaco and higher rivers.",
    "g.bajar": "Scroll down to follow the journey",
    "g.paso-1": "Step 1 of 5",
    "g.paso-2": "Step 2 of 5",
    "g.paso-3": "Step 3 of 5",
    "g.paso-4": "Step 4 of 5",
    "g.paso-5": "Step 5 of 5",
    "g.pac-titulo": "The Pacific warms up",
    "g.pac-1": "In a normal year, the trade winds push warm water toward Indonesia and Australia. During El Niño those winds weaken and the warm water shifts east, all the way to the coasts of Peru and Ecuador.",
    "g.pac-2": "Red shows water warmer than normal; blue, colder. These are the last six months, week by week.",
    "g.semana": "Week",
    "g.pac-fuente": "Data: NOAA OISST v2.1, sea temperature compared with the 1991–2020 average. Updated every day.",
    "g.tor-titulo": "More evaporation, more storms",
    "g.tor-1": "Much more water evaporates over the warm ocean and the moist air rises strongly. Huge storm clouds form over the central and eastern Pacific, where it normally rains little.",
    "g.tor-2": "That vapor <strong>does not cross the Andes</strong>: Chaco's rain comes from somewhere else. What reaches us is the effect of those storms on the atmosphere.",
    "g.tor-fuente": "The animated clouds are an illustration: there is no cloud data. What is real is where they appear, only over ocean that is currently more than 1 °C above normal (NOAA OISST).",
    "g.onda-titulo": "A wave across the South Pacific",
    "g.onda-1": "The heat released by those storms pushes the upper atmosphere and creates a wave: areas of higher and lower pressure than normal that alternate from the Pacific to South America.",
    "g.onda-2": "That wave strengthens the <strong>subtropical jet stream</strong>, a river of wind about 12 km up. In El Niño summers it blows stronger than normal over central Argentina, Uruguay and southern Brazil, just south of Chaco (orange lines). A stronger jet helps air rise and storms organize across the whole region.",
    "g.hum-titulo": "The moisture comes from the Amazon",
    "g.hum-1": "The water that falls as rain in Chaco arrives from the north. The <strong>low-level jet</strong> is a moist wind that flows down from the Amazon along the eastern side of the Andes, carrying water vapor toward Chaco, Paraguay and southern Brazil.",
    "g.hum-2": "During El Niño more moisture flows from the Amazon toward the La Plata basin, and the low-level jet shows up more often. When that moist air meets the strengthened jet above, storms become more frequent. That is how El Niño turns into rain in our region.",
    "g.hum-fuente": "Moisture carried by the wind about 1,500 m up (850 hPa), average of El Niño summers.",
    "g.rios-titulo": "Rain in the basin and rising rivers",
    "g.rios-1": "In El Niño years it rains more than normal over the middle and southern La Plata basin: southern Brazil, Paraguay, northeastern Argentina and the Litoral. That water fills the rivers, including the Iguazú and the tributaries coming down from Brazil, and reaches Corrientes and Barranqueras via the Paraná and the Paraguay.",
    "g.rios-2": "The flood arrives weeks after the rain. The Paraguay River takes longer, because the Pantanal wetland holds the water and releases it slowly. In strong El Niños the rain can also continue into autumn. That's why the river can stay high into winter: in 1983, Pilar (Paraguay) flooded in May, and in July the Paraná was still covering Santa Fe's waterfront.",
    "g.rios-nota": "This explains the mechanism; it is not a river forecast. Official forecasts of Paraná and Paraguay river levels are issued by Argentina's <a href=\"https://www.ina.gob.ar/\" rel=\"noopener\">National Water Institute (INA)</a>.",
    "g.fin-titulo": "What it means for your area",
    "g.fin-boton": "See what to expect in my area",
    "g.globo-aria": "3D globe: drag to move, use the wheel or pinch to zoom, Shift and the arrow keys to rotate and tilt",
    "g.ctl": "Globe controls",
    "g.acercar": "Zoom in",
    "g.alejar": "Zoom out",
    "g.norte": "North up",
    "g.inclinar": "Tilt the view",
    "g.inicio-vista": "Back to the initial view",
    "g.explorar-btn": "Explore the globe",
    "g.panel-titulo": "Explore the globe",
    "g.capas": "Layers",
    "g.volver-relato": "Back to the journey",
    "g.ayuda": "<strong>Mouse:</strong> drag to move, use the wheel to zoom, right-click or Shift + drag to rotate and tilt, double-click to zoom into a point. <strong>Phone:</strong> one finger moves, two fingers zoom, rotate and tilt. <strong>Keyboard:</strong> arrows, + and −, Shift + arrows.",
    "g.inicio-explorar": "Or explore the globe freely",
    "g.fin-explorar": "Explore the globe freely",
    "g.fuente-4": "Satellite image: NASA Blue Marble Next Generation (December 2004). Coastlines, countries, provinces and rivers: Natural Earth.",
    "g.fuente-1": "Sea temperature: NOAA OISST v2.1.",
    "g.fuente-2": "Winds, moisture and rain in El Niño summers: NCEP/NCAR R1 reanalysis and GPCP v2.3 (NOAA PSL). Layer heights are exaggerated so they can be seen.",
    "g.fuente-3": "El Niño summers: NOAA CPC ONI index. Map: Natural Earth. Forecast: ECMWF SEAS5 via Open-Meteo.",
    // Vista técnica
    "t.titulo": "El Niño Argentina · Technical view",
    "t.descripcion": "Indices, components, observed water and downloads from El Niño Argentina, Chaco pilot.",
    "t.demo": "<strong>Demo issue.</strong> Values follow a simple geographic gradient to test the system; they do not come from ERA5, CHIRPS, ECMWF SEAS5 or Sentinel-1. The data schema is final.",
    "t.marca-sub": "Technical view · Chaco pilot",
    "t.vista-ciudadana": "Citizen view",
    "t.parametros": "Parameters",
    "t.modulo": "Module",
    "t.op-anegamiento": "Flooding and roads",
    "t.op-lluvia": "Rain",
    "t.op-dengue": "Dengue",
    "t.op-calor": "Heat",
    "t.departamento": "Department",
    "t.trimestre": "Target season",
    "t.capa": "Layer",
    "t.capa-grupo": "Map layer",
    "t.modulos": "Hazard modules",
    "t.mapa-meta": "EPSG:4326 · IGN SIG 250 boundaries",
    "t.mapa-region": "Technical map of Chaco departments",
    "t.agua": "Observed water",
    "t.agua-nota": "Unusual flooding: permanent rivers, lagoons and marshes are excluded (JRC Global Surface Water). Water is detected on Sentinel-1 VV backscatter with an adaptive Otsu threshold and a change test against the same month in 2017–2025.",
    "t.ranking": "All departments",
    "t.bajar-csv": "Download CSV",
    "t.caption": "Indicators by department. Columns can be sorted.",
    "t.th-depto": "Department",
    "t.th-R": "R index",
    "t.th-caminos": "Roads",
    "t.th-sup": "P(rain above)",
    "t.th-dengue": "Dengue",
    "t.th-calor": "Heat",
    "t.th-agua": "Obs. water (km²)",
    "t.th-bosque": "Forest loss",
    "t.datos": "Issue data",
    "t.licencia": "CC BY 4.0 license",
    "t.th-producto": "Product",
    "t.th-formato": "Format",
    "t.th-descarga": "Download",
    "t.metodo": "Method",
    "t.metodo-version": "v0.1 · pilot",
    "t.metodo-1": "Hazard–exposure–vulnerability framework (IPCC, UNDRR) and geometric aggregation from the INFORM Risk Index. The weights w₁, w₂, w₃ are the project's own choice, to be calibrated against the 1997-98 and 2015-16 floods.",
    "t.metodo-2": "Relative risk across departments: not a forecast or an official alert.",
    "t.pie": "Relative risk, not an official forecast · Data under CC BY 4.0 license · Forecast: <a href=\"https://open-meteo.com/\" rel=\"noopener\">Open-Meteo.com</a> (CC BY 4.0), ECMWF SEAS5 · Department boundaries: IGN",
    "t.pie-links": "<a href=\"./\">Citizen view</a> · <a href=\"https://github.com/rikochet87/elnino-chaco\" rel=\"noopener\">Code and methodology</a>",
  };

  // ---------- Textos que arma JavaScript ----------
  const DICC = {
    es: {
      "cargando": "Cargando…",
      "error.titulo": "No se pudieron cargar los datos.",
      "error.texto": "Revisá tu conexión y volvé a intentar.",
      "mapa.limites": "Límites: IGN (SIG 250)",
      "depto": (n) => "Departamento " + n,
      "demo.dato": "dato de ejemplo",
      "demo.datos": "Datos de ejemplo",

      // Módulos (comun.js)
      "mod.lluvia": "Lluvia",
      "mod.anegamiento": "Caminos",
      "mod.dengue": "Dengue",
      "mod.calor": "Calor",
      "mod.agua": "Agua observada",
      "ley.lluvia": "Lluvia del verano respecto de lo normal",
      "ley.anegamiento": "Posibilidad de cortes de caminos por agua",
      "ley.dengue": "Condiciones climáticas para el mosquito del dengue",
      "ley.calor": "Calor húmedo y noches que no refrescan",
      "ley.agua": "Superficie con agua fuera de lo habitual",
      "cl.lluvia": ["Tendencia a menos lluvia", "Sin tendencia clara", "Leve tendencia a más lluvia", "Probabilidad alta de más lluvia", "Probabilidad muy alta de más lluvia"],
      "cl.anegamiento": ["Muy baja", "Baja", "Media", "Alta", "Muy alta"],
      "cl.dengue": ["Poco favorables", "Algo favorables", "Favorables", "Bastante favorables", "Muy favorables"],
      "cl.calor": ["Bajo", "Moderado bajo", "Moderado", "Alto", "Muy alto"],
      "cl.agua": ["Menos de 2 km²", "2 a 10 km²", "10 a 30 km²", "30 a 60 km²", "Más de 60 km²"],

      // Vista ciudadana
      "franja": (m, p) => `Información de ${m} · Próxima actualización: ${p}`,
      "zona.titulo": (cab, dep) => `${cab} y alrededores (${dep}, Chaco)`,
      "zona.nino": (p, demo) => `Hay <strong>${p} de probabilidad</strong> de que este verano haya El Niño${demo}. En esta zona, eso suele significar más lluvia de lo normal.`,
      "lluvia.mas": "Más de lo normal",
      "lluvia.normal": "Normal",
      "lluvia.menos": "Menos de lo normal",
      "lluvia.puntos-aria": (si, t) => `${si} de ${t} simulaciones dan más lluvia que lo normal`,
      "lluvia.puntos": (si, t) => `Cada punto es una simulación del modelo europeo: <strong>${si} de ${t}</strong> dan más lluvia que lo normal.`,
      "lluvia.masmenos": (v) => (v >= 0 ? `${v} % más` : `${-v} % menos`),
      "lluvia.pron": (x) => ` El pronóstico espera en promedio <strong>${x}</strong> de lo normal.`,
      "lluvia.texto": (mm, trim, pron, x) => `Lo normal en esta zona son unos <strong>${mm} mm</strong> de ${trim}.${pron} En los veranos con El Niño de años anteriores llovió en promedio <strong>${x}</strong>.`,
      "caminos.alta": "Los caminos de tierra en zonas bajas suelen quedar intransitables después de lluvias fuertes. Es una de las zonas más expuestas de la provincia.",
      "caminos.media": "Algunos caminos de tierra pueden cortarse después de lluvias fuertes, sobre todo en zonas bajas.",
      "caminos.baja": "La posibilidad de cortes es menor que en otras zonas de la provincia, aunque una lluvia fuerte siempre puede afectar los caminos de tierra.",
      "rot.caminos": "Posibilidad de cortes por agua",
      "rot.dengue": "Condiciones para el mosquito",
      "rot.calor": "Calor húmedo y noches pesadas",
      "agua.parecido": ", parecido al mes pasado",
      "agua.mas": ", más que el mes pasado",
      "agua.menos": ", menos que el mes pasado",
      "agua.texto": (f, dep, km, comp) => `Según la imagen satelital del <strong>${f}</strong>, en el departamento ${dep} hay unos <strong>${km} km²</strong> de campos y caminos con agua fuera de lo habitual${comp}.`,
      "agua.sin-dato": "Sin dato aún",
      "agua.sin-previo": "Sin dato del mes pasado",
      "agua.similar": "Parecido",
      "agua.cambio": (mas, v) => `${mas ? "Más" : "Menos"} agua (${mas ? "+" : "−"}${v} km²)`,
      "mapa.ayuda": "Tocá un departamento para ver su ficha. Es una tendencia para toda la temporada, no el pronóstico de un día.",
      "buscar.no-encontrado": "No encontramos esa localidad en Chaco. Probá con el nombre del departamento o usá tu ubicación.",
      "buscar.vacio": "Escribí el nombre de tu localidad.",
      "ubic.no-soportada": "Tu navegador no permite usar la ubicación.",
      "ubic.buscando": "Buscando tu ubicación…",
      "ubic.encontrada": (dep) => `Estás en el departamento ${dep}.`,
      "ubic.fuera": "Tu ubicación está fuera de Chaco. Por ahora el sitio cubre solo esta provincia; buscá una localidad.",
      "ubic.error": "No pudimos obtener tu ubicación. Podés buscar tu localidad por nombre.",
      "compartir.texto": (cab, dep, trim, lluvia, cortes) => `El Niño en ${cab} (${dep}, Chaco), ${trim}: ${lluvia}; posibilidad de cortes de caminos ${cortes}.`,
      "compartir.demo": "(Versión de demostración, datos de ejemplo)",
      "compartir.real": "(Riesgo relativo, no es una alerta oficial)",

      // Océano
      "oni.umbral": "umbral El Niño",
      "oni.hoy": "Hoy",
      "oni.promedio": (m1, m2, a) => `Es el promedio de ${m1} a ${m2} de ${a}.`,
      "oni.supera-todos": (lista) => `A esta altura del año, el calentamiento ya supera al de ${lista.join(" y al de ")}, los dos Niños más fuertes de las últimas décadas.`,
      "oni.supera-algunos": (lista) => `A esta altura del año, ya supera al de ${lista.join(" y ")} y se acerca a los Niños más fuertes de las últimas décadas.`,
      "oni.comparable": "Es un calentamiento comparable al de los Niños más fuertes de las últimas décadas.",
      "oni.desc": (n, v, refs) => `Gráfico de la temperatura del Pacífico ecuatorial: El Niño ${n} llega a ${v}, comparado con los Niños de ${refs.join(" y ")}.`,

      // Vista técnica
      "capa.cat-R": "Categoría (quintiles de R)",
      "capa.R": "Índice R",
      "capa.H": "Amenaza H",
      "capa.E": "Exposición E",
      "capa.V": "Vulnerabilidad V",
      "capa.bosque": "Pérdida de bosque nativo (%)",
      "capa.agua": "Agua observada (km²)",
      "capa.sup": "P(lluvia superior a lo normal)",
      "capa.anompron": "Anomalía pronosticada (%)",
      "capa.anom": "Anomalía histórica en años Niño (%)",
      "capa.mm": "Lluvia normal del trimestre (mm)",
      "capa.cat": "Categoría (quintiles)",
      "capa.ind-dengue": "Índice de condiciones",
      "capa.ind-calor": "Índice de estrés térmico",
      "tmod.anegamiento": "Anegamiento y caminos",
      "tmod.lluvia": "Lluvia",
      "tmod.dengue": "Dengue",
      "tmod.calor": "Calor",
      "tmod.crecidas": "Crecidas de ríos",
      "tmod.incendios": "Incendios",
      "nota.alta": "Confianza alta · Piloto",
      "nota.media": "Confianza media · Piloto",
      "nota.verificar": "Señal a verificar · Piloto",
      "nota.nea": "Próximamente · Fase NEA",
      "nota.nina": "Próximamente · Fase La Niña",
      "ley.quintiles": "Clases por quintiles: 5 departamentos por clase.",
      "ley.intervalos": "Cinco intervalos iguales entre el mínimo y el máximo del área.",
      "des.titulo": (dep) => `Desglose · ${dep}, Chaco`,
      "des.id": (id, cab) => `id_depto ${id} · cabecera ${cab}`,
      "des.variable": "Variable",
      "des.fuente": "Fuente",
      "des.valor": "Valor",
      "des.H": "H amenaza",
      "des.E": "E exposición",
      "des.E-fuente": "Densidad de caminos rurales (OSM)",
      "des.V": "V vulnerabilidad",
      "des.V-fuente": "Relieve HAND, pérdida de bosque",
      "des.bosque": "incl. pérdida de bosque",
      "des.R": "R índice",
      "des.quintil": (q) => `Quintil ${q}`,
      "des.media": "media geométrica",
      "des.otros": "Otros módulos",
      "des.p2": "P(lluvia sup. / inf.)",
      "des.p3": "P(lluvia sup. / normal / inf.)",
      "des.anompron": "Anomalía pronosticada (media)",
      "des.miembros": "ECMWF SEAS5, 51 miembros",
      "des.normal": "Lluvia normal del trimestre",
      "des.anom": "Anomalía media en años Niño",
      "des.dengue": "Dengue, índice",
      "des.calor": "Calor, índice",
      "agua.meta": (s, f, u) => `${s} · ${f} · umbral ${u} dB`,
      "met.anegado": "Anegado fuera de lo habitual",
      "met.variacion": "Variación vs. mes anterior",
      "met.caminos": "Caminos en zona anegada",
      "met.sin-dato": "Sin dato",
      "met.riesgo": "Riesgo pronosticado",
      "meta": (em, tri, p) => `Emisión ${em} · ${tri} · P(Niño) ${p}`,
      "metodo": (e) => `Normalización ${e.metodo.normalizacion}; categorías por ${e.metodo.categorias}.`,
      "desc.emision": "Emisión completa (todos los módulos)",
      "desc.limites": "Límites departamentales de Chaco",
      "desc.localidades": "Localidades para búsqueda",
      "desc.indicadores": "Indicadores por departamento",
      // Página 3D
      "g.dato-nino34": (v, caliente, f) => `Hoy el Pacífico central está ${v} ${caliente ? "más caliente" : "más frío"} que lo normal (región Niño 3.4, dato del ${f}). Es el valor de un solo día; el gráfico de la página principal promedia tres meses.`,
      "g.dato-anios": (n, a0, a1) => `Promedio de los ${n} veranos con El Niño entre ${a0} y ${a1}, comparado con 1991–2020 (reanálisis NCEP/NCAR de NOAA).`,
      "g.dato-lluvia": (v, n, amaz) => (v >= 0
        ? `Entre septiembre y febrero de los ${n} años con El Niño desde 1980 llovió en promedio un ${v} % más que lo normal en el noreste argentino, el sur de Paraguay y el sur de Brasil (GPCP).`
        : `Entre septiembre y febrero de los ${n} años con El Niño desde 1980 llovió en promedio un ${-v} % menos que lo normal en el noreste argentino, el sur de Paraguay y el sur de Brasil (GPCP).`)
        + (amaz < -3 ? ` En cambio, en la Amazonía llovió un ${-amaz} % menos.` : ""),
      "g.dato-pronostico": (trim, min, max, p) => `Para este verano (${trim}), el pronóstico espera entre ${min} y ${max} de lluvia respecto de lo normal en los departamentos de Chaco. La probabilidad de El Niño es de ${p}.`,
      "g.sat": "Satélite",
      "g.mapa": "Mapa",
      "g.sat-titulo": "Ver la imagen satelital de la NASA",
      "g.mapa-titulo": "Volver al mapa simple",
      "g.sat-no": "La imagen satelital todavía no está disponible.",
      "g.capa.sst": "Temperatura del mar",
      "g.capa.tormentas": "Tormentas sobre el Pacífico",
      "g.capa.onda": "Onda en altura (presión)",
      "g.capa.chorro": "Chorro subtropical",
      "g.capa.humedad": "Humedad desde la Amazonía",
      "g.capa.lluvia": "Lluvia en años con El Niño",
      "g.capa.rios": "Ríos de la cuenca del Plata",
      "g.capa.chaco": "Chaco",
      "g.capa.nombres": "Nombres",
      "g.pausar-globo": "Pausar la animación del globo",
      "g.animar": "Reanudar la animación del globo",
      "g.pausar": "Pausar",
      "g.reproducir": "Reproducir",
      "g.semana-de": (f) => `Semana del ${f}`,
      "g.ultimo-dato": (f) => `Último dato: ${f}`,
      "g.ley.sst": "Temperatura del mar respecto de lo normal",
      "g.ley.tormentas": "Tormentas sobre el agua más caliente (ilustración)",
      "g.ley.chorro": "Viento a 12 km de altura en veranos con El Niño",
      "g.ley.chorro-mas": "Más fuerte que lo normal",
      "g.ley.chorro-igual": "Parecido a lo normal",
      "g.ley.chorro-menos": "Más débil que lo normal",
      "g.ley.onda": "Presión en altura",
      "g.ley.alta": "Más alta que lo normal",
      "g.ley.baja": "Más baja que lo normal",
      "g.ley.humedad": "Viento a 1.500 m de altura",
      "g.ley.humedad-flujo": "Humedad que transporta",
      "g.ley.chorro-alto": "Chorro de altura",
      "g.ley.chaco": "Chaco",
      "g.ley.lluvia": "Lluvia de septiembre a febrero en años con El Niño, respecto de lo normal",
      "g.ley.rios": "Agua que baja por los ríos",
      "g.et.pacifico": "Pacífico ecuatorial",
      "g.et.peru": "Perú y Ecuador",
      "g.et.indonesia": "Indonesia",
      "g.et.tormentas": "Más tormentas",
      "g.et.andes": "Cordillera de los Andes",
      "g.et.onda": "Onda en altura",
      "g.et.chorro": "Chorro subtropical",
      "g.et.amazonia": "Amazonía",
      "g.et.capas-bajas": "Chorro de capas bajas",
      "g.et.chaco": "Chaco",
      "g.et.pantanal": "Pantanal",
      "g.et.cuenca-alta": "Cuenca alta del Paraná",
      "g.et.paraguay": "Río Paraguay",
      "g.et.parana": "Río Paraná",
      "g.et.corrientes": "Resistencia y Corrientes",
    },
    en: {
      "cargando": "Loading…",
      "error.titulo": "The data could not be loaded.",
      "error.texto": "Check your connection and try again.",
      "mapa.limites": "Boundaries: IGN (SIG 250)",
      "depto": (n) => n + " Department",
      "demo.dato": "sample data",
      "demo.datos": "Sample data",

      "mod.lluvia": "Rain",
      "mod.anegamiento": "Roads",
      "mod.dengue": "Dengue",
      "mod.calor": "Heat",
      "mod.agua": "Observed water",
      "ley.lluvia": "Summer rain compared with normal",
      "ley.anegamiento": "Chance of roads being cut by water",
      "ley.dengue": "Climate conditions for the dengue mosquito",
      "ley.calor": "Humid heat and nights that don't cool down",
      "ley.agua": "Area with unusual water",
      "cl.lluvia": ["Tendency toward less rain", "No clear trend", "Slight tendency toward more rain", "High chance of more rain", "Very high chance of more rain"],
      "cl.anegamiento": ["Very low", "Low", "Medium", "High", "Very high"],
      "cl.dengue": ["Not very favorable", "Somewhat favorable", "Favorable", "Quite favorable", "Very favorable"],
      "cl.calor": ["Low", "Moderately low", "Moderate", "High", "Very high"],
      "cl.agua": ["Less than 2 km²", "2 to 10 km²", "10 to 30 km²", "30 to 60 km²", "More than 60 km²"],

      "franja": (m, p) => `Information for ${m} · Next update: ${p}`,
      "zona.titulo": (cab, dep) => `${cab} and surroundings (${dep}, Chaco)`,
      "zona.nino": (p, demo) => `There is a <strong>${p} probability</strong> of El Niño this summer${demo}. In this area, that usually means more rain than normal.`,
      "lluvia.mas": "Above normal",
      "lluvia.normal": "Normal",
      "lluvia.menos": "Below normal",
      "lluvia.puntos-aria": (si, t) => `${si} of ${t} simulations give more rain than normal`,
      "lluvia.puntos": (si, t) => `Each dot is one simulation of the European model: <strong>${si} of ${t}</strong> give more rain than normal.`,
      "lluvia.masmenos": (v) => (v >= 0 ? `${v}% more` : `${-v}% less`),
      "lluvia.pron": (x) => ` On average, the forecast expects <strong>${x}</strong> than normal.`,
      "lluvia.texto": (mm, trim, pron, x) => `Normal rainfall in this area is about <strong>${mm} mm</strong> from ${trim}.${pron} In past El Niño summers it rained <strong>${x}</strong> on average.`,
      "caminos.alta": "Dirt roads in low-lying areas often become impassable after heavy rain. This is one of the most exposed areas in the province.",
      "caminos.media": "Some dirt roads may be cut off after heavy rain, especially in low-lying areas.",
      "caminos.baja": "The chance of road closures is lower than in other parts of the province, although heavy rain can always affect dirt roads.",
      "rot.caminos": "Chance of roads cut by water",
      "rot.dengue": "Conditions for the mosquito",
      "rot.calor": "Humid heat and warm nights",
      "agua.parecido": ", similar to last month",
      "agua.mas": ", more than last month",
      "agua.menos": ", less than last month",
      "agua.texto": (f, dep, km, comp) => `According to the satellite image of <strong>${f}</strong>, ${dep} department has about <strong>${km} km²</strong> of fields and roads with unusual water${comp}.`,
      "agua.sin-dato": "No data yet",
      "agua.sin-previo": "No data for last month",
      "agua.similar": "Similar",
      "agua.cambio": (mas, v) => `${mas ? "More" : "Less"} water (${mas ? "+" : "−"}${v} km²)`,
      "mapa.ayuda": "Tap a department to see its summary. This is a trend for the whole season, not a daily forecast.",
      "buscar.no-encontrado": "We couldn't find that town in Chaco. Try the department name or use your location.",
      "buscar.vacio": "Type the name of your town.",
      "ubic.no-soportada": "Your browser does not allow using your location.",
      "ubic.buscando": "Finding your location…",
      "ubic.encontrada": (dep) => `You are in ${dep} department.`,
      "ubic.fuera": "Your location is outside Chaco. For now the site only covers this province; search for a town.",
      "ubic.error": "We couldn't get your location. You can search for your town by name.",
      "compartir.texto": (cab, dep, trim, lluvia, cortes) => `El Niño in ${cab} (${dep}, Chaco), ${trim}: ${lluvia}; chance of road closures: ${cortes}.`,
      "compartir.demo": "(Demo version, sample data)",
      "compartir.real": "(Relative risk, not an official alert)",

      "oni.umbral": "El Niño threshold",
      "oni.hoy": "Now",
      "oni.promedio": (m1, m2, a) => `This is the average from ${m1} to ${m2} ${a}.`,
      "oni.supera-todos": (lista) => `At this point in the year, the warming already exceeds that of ${lista.join(" and ")}, the two strongest El Niños of recent decades.`,
      "oni.supera-algunos": (lista) => `At this point in the year, it already exceeds ${lista.join(" and ")} and is approaching the strongest El Niños of recent decades.`,
      "oni.comparable": "This warming is comparable to the strongest El Niños of recent decades.",
      "oni.desc": (n, v, refs) => `Chart of equatorial Pacific temperature: El Niño ${n} reaches ${v}, compared with the El Niños of ${refs.join(" and ")}.`,

      "capa.cat-R": "Category (R quintiles)",
      "capa.R": "R index",
      "capa.H": "Hazard H",
      "capa.E": "Exposure E",
      "capa.V": "Vulnerability V",
      "capa.bosque": "Native forest loss (%)",
      "capa.agua": "Observed water (km²)",
      "capa.sup": "P(above-normal rain)",
      "capa.anompron": "Forecast anomaly (%)",
      "capa.anom": "Historical anomaly in Niño years (%)",
      "capa.mm": "Normal seasonal rainfall (mm)",
      "capa.cat": "Category (quintiles)",
      "capa.ind-dengue": "Conditions index",
      "capa.ind-calor": "Heat stress index",
      "tmod.anegamiento": "Flooding and roads",
      "tmod.lluvia": "Rain",
      "tmod.dengue": "Dengue",
      "tmod.calor": "Heat",
      "tmod.crecidas": "River floods",
      "tmod.incendios": "Fires",
      "nota.alta": "High confidence · Pilot",
      "nota.media": "Medium confidence · Pilot",
      "nota.verificar": "Signal to be verified · Pilot",
      "nota.nea": "Coming soon · NEA phase",
      "nota.nina": "Coming soon · La Niña phase",
      "ley.quintiles": "Quintile classes: 5 departments per class.",
      "ley.intervalos": "Five equal intervals between the area's minimum and maximum.",
      "des.titulo": (dep) => `Breakdown · ${dep}, Chaco`,
      "des.id": (id, cab) => `id_depto ${id} · seat ${cab}`,
      "des.variable": "Variable",
      "des.fuente": "Source",
      "des.valor": "Value",
      "des.H": "H hazard",
      "des.E": "E exposure",
      "des.E-fuente": "Rural road density (OSM)",
      "des.V": "V vulnerability",
      "des.V-fuente": "HAND terrain, forest loss",
      "des.bosque": "incl. forest loss",
      "des.R": "R index",
      "des.quintil": (q) => `Quintile ${q}`,
      "des.media": "geometric mean",
      "des.otros": "Other modules",
      "des.p2": "P(rain above / below)",
      "des.p3": "P(rain above / normal / below)",
      "des.anompron": "Forecast anomaly (mean)",
      "des.miembros": "ECMWF SEAS5, 51 members",
      "des.normal": "Normal seasonal rainfall",
      "des.anom": "Mean anomaly in Niño years",
      "des.dengue": "Dengue, index",
      "des.calor": "Heat, index",
      "agua.meta": (s, f, u) => `${s} · ${f} · threshold ${u} dB`,
      "met.anegado": "Unusual flooding",
      "met.variacion": "Change vs. previous month",
      "met.caminos": "Roads in flooded area",
      "met.sin-dato": "No data",
      "met.riesgo": "Forecast risk",
      "meta": (em, tri, p) => `Issue ${em} · ${tri} · P(Niño) ${p}`,
      "metodo": () => "Min-max normalization 0.01–1 across the area's departments; categories by quintiles.",
      "desc.emision": "Full issue (all modules)",
      "desc.limites": "Chaco department boundaries",
      "desc.localidades": "Towns for search",
      "desc.indicadores": "Indicators by department",
      "g.dato-nino34": (v, caliente, f) => `Today the central Pacific is ${v} ${caliente ? "warmer" : "colder"} than normal (Niño 3.4 region, data from ${f}). This is a single day; the chart on the main page averages three months.`,
      "g.dato-anios": (n, a0, a1) => `Average of the ${n} El Niño summers between ${a0} and ${a1}, compared with 1991–2020 (NOAA NCEP/NCAR reanalysis).`,
      "g.dato-lluvia": (v, n, amaz) => (v >= 0
        ? `From September to February of the ${n} El Niño years since 1980, rainfall was on average ${v}% above normal in northeastern Argentina, southern Paraguay and southern Brazil (GPCP).`
        : `From September to February of the ${n} El Niño years since 1980, rainfall was on average ${-v}% below normal in northeastern Argentina, southern Paraguay and southern Brazil (GPCP).`)
        + (amaz < -3 ? ` The Amazon, by contrast, got ${-amaz}% less rain.` : ""),
      "g.dato-pronostico": (trim, min, max, p) => `For this summer (${trim}), the forecast expects between ${min} and ${max} rain compared with normal in Chaco's departments. The probability of El Niño is ${p}.`,
      "g.sat": "Satellite",
      "g.mapa": "Map",
      "g.sat-titulo": "Show NASA satellite imagery",
      "g.mapa-titulo": "Back to the simple map",
      "g.sat-no": "The satellite image is not available yet.",
      "g.capa.sst": "Sea temperature",
      "g.capa.tormentas": "Storms over the Pacific",
      "g.capa.onda": "Upper-level wave (pressure)",
      "g.capa.chorro": "Subtropical jet",
      "g.capa.humedad": "Moisture from the Amazon",
      "g.capa.lluvia": "Rain in El Niño years",
      "g.capa.rios": "La Plata basin rivers",
      "g.capa.chaco": "Chaco",
      "g.capa.nombres": "Names",
      "g.pausar-globo": "Pause the globe animation",
      "g.animar": "Resume the globe animation",
      "g.pausar": "Pause",
      "g.reproducir": "Play",
      "g.semana-de": (f) => `Week of ${f}`,
      "g.ultimo-dato": (f) => `Latest data: ${f}`,
      "g.ley.sst": "Sea temperature compared with normal",
      "g.ley.tormentas": "Storms over the warmer water (illustration)",
      "g.ley.chorro": "Wind 12 km up in El Niño summers",
      "g.ley.chorro-mas": "Stronger than normal",
      "g.ley.chorro-igual": "Close to normal",
      "g.ley.chorro-menos": "Weaker than normal",
      "g.ley.onda": "Upper-level pressure",
      "g.ley.alta": "Higher than normal",
      "g.ley.baja": "Lower than normal",
      "g.ley.humedad": "Wind 1,500 m up",
      "g.ley.humedad-flujo": "Moisture it carries",
      "g.ley.chorro-alto": "Upper-level jet",
      "g.ley.chaco": "Chaco",
      "g.ley.lluvia": "September–February rain in El Niño years, compared with normal",
      "g.ley.rios": "Water flowing down the rivers",
      "g.et.pacifico": "Equatorial Pacific",
      "g.et.peru": "Peru and Ecuador",
      "g.et.indonesia": "Indonesia",
      "g.et.tormentas": "More storms",
      "g.et.andes": "Andes mountains",
      "g.et.onda": "Upper-level wave",
      "g.et.chorro": "Subtropical jet",
      "g.et.amazonia": "Amazon",
      "g.et.capas-bajas": "Low-level jet",
      "g.et.chaco": "Chaco",
      "g.et.pantanal": "Pantanal",
      "g.et.cuenca-alta": "Upper Paraná basin",
      "g.et.paraguay": "Paraguay River",
      "g.et.parana": "Paraná River",
      "g.et.corrientes": "Resistencia and Corrientes",
    },
  };

  // ---------- Estado ----------
  function inicial() {
    const pedido = new URLSearchParams(location.search).get("lang");
    if (IDIOMAS.includes(pedido)) return pedido;
    try { const g = localStorage.getItem("idioma"); if (IDIOMAS.includes(g)) return g; } catch (e) { /* sin almacenamiento */ }
    return "es"; // el sitio es para Chaco: español salvo que se elija inglés
  }
  let idioma = inicial();

  function T(clave, ...args) {
    const v = clave in DICC[idioma] ? DICC[idioma][clave] : DICC.es[clave];
    if (v === undefined) return clave;
    return typeof v === "function" ? v(...args) : v;
  }

  // ---------- Textos fijos ----------
  const ORIGINAL = new Map(); // elemento → { modo: valor en español }
  const lista = () => document.querySelectorAll("[data-i18n],[data-i18n-html],[data-i18n-attr]");
  function pares(el) {
    return el.dataset.i18nAttr.split(",").map((p) => p.trim().split(":"));
  }
  function guardarOriginal() {
    lista().forEach((el) => {
      const o = {};
      if (el.dataset.i18n) o.texto = el.textContent;
      if (el.dataset.i18nHtml) o.html = el.innerHTML;
      if (el.dataset.i18nAttr) o.attr = Object.fromEntries(pares(el).map(([a]) => [a, el.getAttribute(a)]));
      ORIGINAL.set(el, o);
    });
  }
  function aplicarFijos() {
    const en = idioma === "en";
    lista().forEach((el) => {
      const o = ORIGINAL.get(el) || {};
      if (el.dataset.i18n) el.textContent = en ? FIJOS_EN[el.dataset.i18n] ?? o.texto : o.texto;
      if (el.dataset.i18nHtml) el.innerHTML = en ? FIJOS_EN[el.dataset.i18nHtml] ?? o.html : o.html;
      if (el.dataset.i18nAttr) pares(el).forEach(([a, k]) => el.setAttribute(a, en ? FIJOS_EN[k] ?? o.attr[a] : o.attr[a]));
    });
    document.documentElement.lang = en ? "en" : "es";
    document.querySelectorAll("[data-idioma]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.idioma === idioma)));
  }

  function cambiar(nuevo) {
    if (!IDIOMAS.includes(nuevo) || nuevo === idioma) return;
    idioma = nuevo;
    try { localStorage.setItem("idioma", nuevo); } catch (e) { /* sin almacenamiento */ }
    const url = new URL(location.href);
    if (nuevo === "es") url.searchParams.delete("lang"); else url.searchParams.set("lang", nuevo);
    history.replaceState(null, "", url);
    aplicarFijos();
    document.dispatchEvent(new CustomEvent("idioma", { detail: nuevo }));
  }

  // ---------- Fechas, números y temporadas ----------
  const locale = () => (idioma === "en" ? "en-US" : "es-AR");
  const mesNombre = (m) => MESES[idioma][m - 1];
  const fechaLarga = (iso) => {
    const [a, m, d] = iso.split("-").map(Number);
    return idioma === "en" ? `${mesNombre(m)} ${d}, ${a}` : `${d} de ${mesNombre(m)} de ${a}`;
  };
  const mesLargo = (iso) => {
    const [a, m] = iso.split("-").map(Number);
    return idioma === "en" ? `${mesNombre(m)} ${a}` : `${mesNombre(m)} de ${a}`;
  };
  const pct = (v) => Math.round(v * 100) + (idioma === "en" ? "%" : " %");

  // "DEF 2026-27" (siglas en español, como en los datos) → mes inicial
  function mesInicial(codigo) {
    const ini = INICIALES.es;
    for (let m = 0; m < 12; m++) {
      if (ini[m] + ini[(m + 1) % 12] + ini[(m + 2) % 12] === codigo) return m;
    }
    return -1;
  }
  function trimestre(e) {
    const [cod, anios] = e.trimestre.split(" ");
    const m = mesInicial(cod);
    if (idioma === "es" || m < 0) return e.trimestre;
    const ini = INICIALES.en;
    return ini[m] + ini[(m + 1) % 12] + ini[(m + 2) % 12] + (anios ? " " + anios : "");
  }
  function trimestreTexto(e) {
    const m = mesInicial(e.trimestre.split(" ")[0]);
    if (idioma === "es" || m < 0) return e.trimestre_texto;
    return `${MESES.en[m]} to ${MESES.en[(m + 2) % 12]}`;
  }
  // "ago–oct" → "Aug–Oct"
  const abrev = (txt) => (idioma === "es" ? txt : txt.replace(/[a-z]{3}/g, (a) => ABREV_EN[ABREV_ES.indexOf(a)] || a));
  const mesDeAbrev = (a) => MESES[idioma][ABREV_ES.indexOf(a)] || a;

  function armarSelector() {
    document.querySelectorAll("[data-idioma]").forEach((b) => b.addEventListener("click", () => cambiar(b.dataset.idioma)));
  }

  guardarOriginal();
  armarSelector();
  aplicarFijos();

  window.I18N = {
    get idioma() { return idioma; },
    T, cambiar, locale, fechaLarga, mesLargo, pct, trimestre, trimestreTexto, abrev, mesDeAbrev,
  };
})();
