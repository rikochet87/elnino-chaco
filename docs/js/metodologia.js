/* Método y trazabilidad de la emisión seleccionada, junto a sus valores publicados. */
(function () {
  'use strict';
  const codigo='https://github.com/rikochet87/elnino-chaco/blob/main/';
  const fuentes={
    chirps:['CHIRPS · UCSB','https://www.chc.ucsb.edu/data/chirps'],
    era:['ERA5-Land · Copernicus','https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR'],
    hand:['MERIT Hydro · HAND','https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1'],
    bosque:['Hansen GFC 2023 v1.11','https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2023_v1_11'],
    osm:['OpenStreetMap / Overpass','https://www.openstreetmap.org/copyright'],
    pob:['WorldPop 2020','https://developers.google.com/earth-engine/datasets/catalog/WorldPop_GP_100m_pop'],
    pron:['ECMWF SEAS5 · Open-Meteo','https://open-meteo.com/en/docs/seasonal-forecast-api'],
    s1:['Sentinel-1 + JRC Global Surface Water','https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD'],
    indice:['Cálculo del proyecto · pipeline/indice.py',codigo+'pipeline/indice.py'],
    oni:['NOAA CPC · ONI','https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php']
  };
  // Clave, significado ES/EN, fuente, unidad. Los valores nunca se sustituyen por cero.
  const campos=[
    ['lluvia.prob_superior','Probabilidad estacional de superar la normal del modelo','Seasonal probability above the model normal','pron','0–1'],
    ['lluvia.prob_normal','Probabilidad del tercil normal; nulo en la versión de dos categorías','Normal-tercile probability; null with two categories','pron','0–1'],
    ['lluvia.prob_inferior','Probabilidad estacional por debajo de la normal del modelo','Seasonal probability below the model normal','pron','0–1'],
    ['lluvia.anom_pronostico_pct','Diferencia del promedio del ensamble respecto de la climatología del modelo','Ensemble mean difference from model climatology','pron','%'],
    ['lluvia.normal_mm','Lluvia media de verano 1991–2020; publicada redondeada a decenas','Mean summer rainfall 1991–2020; rounded to tens','chirps','mm'],
    ['lluvia.anom_nino_pct','Promedio de anomalías de lluvia de los veranos Niño frente a 1991–2020','Mean Niño summer rainfall anomaly relative to 1991–2020','chirps','%'],
    ['anegamiento.H','Amenaza de exceso de lluvia, fórmula H indicada debajo','Excess-rainfall hazard, formula H below','indice','0–1'],
    ['anegamiento.E','Densidad de caminos rurales normalizada entre departamentos','Rural road density normalized across departments','indice','0–1'],
    ['anegamiento.V','Combinación normalizada de relieve bajo y pérdida de bosque','Normalized combination of low terrain and forest loss','indice','0–1'],
    ['anegamiento.R','Media geométrica de H, E y V','Geometric mean of H, E and V','indice','0–1'],
    ['anegamiento.categoria','Posición de R en los quintiles provinciales','Position of R in provincial quintiles','indice','1–5'],
    ['anegamiento.perdida_bosque_pct','Área perdida 2004–2023 / bosque con cobertura ≥30 % en 2000 × 100','Area lost 2004–2023 / forest with ≥30% cover in 2000 × 100','bosque','%'],
    ['dengue.indice','Índice relativo de condiciones para el mosquito, no probabilidad de casos','Relative mosquito suitability index, not case probability','indice','0–1'],
    ['dengue.categoria','Quintil del índice de dengue','Quintile of dengue suitability index','indice','1–5'],
    ['calor.indice','Índice relativo de noches tropicales y población, no sensación térmica','Relative tropical-night and population index, not apparent temperature','indice','0–1'],
    ['calor.categoria','Quintil del índice de calor','Quintile of heat index','indice','1–5'],
    ['agua_obs.km2','Superficie de agua fuera de lo habitual detectada el mes observado','Unusual surface water detected in the observed month','s1','km²'],
    ['agua_obs.km2_mes_anterior','Misma medición del mes previo; nulo si no hay comparación','Same measurement in the prior month; null if unavailable','s1','km²'],
    ['agua_obs.km_caminos','Cruce de agua y caminos rasterizados a 30 m; estimación de longitud','Intersection of water and roads rasterized at 30 m; estimated length','s1','km'],
    ['componentes.consistencia','Fracción de veranos Niño con lluvia mayor que la normal histórica','Fraction of Niño summers with rainfall above historical normal','chirps','0–1'],
    ['componentes.frac_zona_baja','Fracción del departamento con HAND menor a 1 m (configuración v0.1)','Department fraction with HAND below 1 m (v0.1 configuration)','hand','0–1'],
    ['componentes.hand_medio_m','Altura media sobre el drenaje más cercano, no sobre el nivel del mar','Mean height above nearest drainage, not above sea level','hand','m'],
    ['componentes.km_caminos_rurales','Suma de caminos track, unclassified y tertiary por departamento','Sum of track, unclassified and tertiary roads by department','osm','km'],
    ['componentes.km_rurales_por_km2','Kilómetros rurales / superficie geodésica del departamento','Rural road kilometres / geodesic department area','osm','km/km²'],
    ['componentes.area_km2','Área geodésica de los límites IGN con el elipsoide WGS84','Geodesic IGN boundary area on the WGS84 ellipsoid','indice','km²'],
    ['componentes.prop_caminos_rurales','Longitud rural / longitud total de caminos considerados','Rural length / total included road length','osm','0–1'],
    ['componentes.poblacion','Suma de población estimada en 2020, no censo actual','Sum of estimated population in 2020, not a current census','pob','personas / people'],
    ['componentes.noches_tropicales_normal','Promedio 1991–2020 de noches de verano con mínima >25 °C','1991–2020 mean summer nights with minimum >25 °C','era','noches / nights'],
    ['componentes.noches_tropicales_anom_nino','Cambio medio en noches tropicales de los veranos Niño','Mean change in tropical nights in Niño summers','era','noches / nights'],
    ['componentes.dias_aptos_dengue_normal','Promedio 1991–2020 de días con temperatura media entre 20 y 32 °C','1991–2020 mean days with average temperature between 20 and 32 °C','era','días / days'],
    ['componentes.dias_aptos_dengue_anom_nino','Cambio medio en días aptos durante los veranos Niño','Mean change in suitable days during Niño summers','era','días / days']
  ];
  function render(datos,id) {
    const I=window.I18N, es=I.idioma==='es', t=(a,b)=>es?a:b;
    const e=datos.emision,d=e.departamentos[id], w=e.metodo.pesos;
    const f=v=>v===null || v===undefined ? t('No disponible / no aplica','Unavailable / not applicable') : Number(v).toLocaleString(I.locale(),{maximumFractionDigits:3});
    const panel=(titulo,contenido,abierto=false)=>`<details class="explicacion" ${abierto?'open':''}><summary>${titulo}</summary><div>${contenido}</div></details>`;
    document.getElementById('metodologia-detalle').innerHTML=
      `<h2>${t('Cómo se obtiene cada resultado','How each result is calculated')}</h2><p>${t('Dos horizontes distintos: el pronóstico diario usa modelos de corto plazo; estos índices describen el verano completo y comparan los 25 departamentos.','Two different horizons: daily forecasts use short-term models; these indices describe the whole summer and compare all 25 departments.')}</p>`+
      panel(t('1. Lluvia estacional: qué significa la probabilidad','1. Seasonal rain: what probability means'),t(
        '<p>F es la fracción de los 51 miembros ECMWF SEAS5 que supera su climatología para diciembre–febrero, en el punto representativo del departamento. La normal del modelo se obtiene de media menos anomalía mensual. No es la probabilidad de que llueva mañana. La lluvia normal en mm es otra referencia: CHIRPS 1991–2020.</p><p>Los veranos Niño se identifican con ONI ≥0,5 °C durante al menos cinco trimestres móviles consecutivos. La lista usada está dentro de la emisión.</p>',
        '<p>F is the fraction of the 51 ECMWF SEAS5 members above their December–February climatology at the department representative point. Model normal is derived from monthly mean minus anomaly. It is not the probability of rain tomorrow. Normal rainfall in mm uses a separate reference: CHIRPS 1991–2020.</p><p>Niño summers are identified by ONI ≥0.5 °C over at least five consecutive overlapping seasons. The emission contains the list used.</p>'))+
      panel(t('2. Caminos: amenaza, exposición y vulnerabilidad','2. Roads: hazard, exposure and vulnerability'),
        `<p class="formula">R = (H × E × V)^(1/3)<br>H = max(0,01; P × (${w.w1} × Â + ${w.w2} × C) + ${w.w3} × F)<br>Â = min(1; max(0; A) / 30)</p>`+t(
        '<p>P: probabilidad de Niño ingresada en la emisión a partir de IRI/CPC. A: anomalía histórica Niño en %. C: consistencia histórica (fracción de veranos Niño más lluviosos). F: probabilidad estacional superior a la normal. El tope de 30 % y los pesos son decisiones del proyecto, pendientes de calibración.</p><p>E = N(km rurales / km²). B = N(−HAND medio), o N(fracción de zona baja) si falta HAND en algún departamento. V = N((B + N(pérdida de bosque))/2). H conserva escala fija; E y V comparan departamentos.</p>',
        '<p>P: Niño probability entered in the emission from IRI/CPC. A: historical Niño rainfall anomaly in %. C: historical consistency (fraction of wetter Niño summers). F: seasonal probability above normal. The 30% cap and weights are project choices awaiting calibration.</p><p>E = N(rural km / km²). B = N(−mean HAND), or N(low-terrain fraction) if any department lacks HAND. V = N((B + N(forest loss))/2). H uses a fixed scale; E and V compare departments.</p>'))+
      panel(t('3. Dengue y calor: índices relativos, no probabilidades','3. Dengue and heat: relative indices, not probabilities'),
        '<p class="formula">U = N(P × N(A) + N(F))<br>T = N(días aptos normales + P × anomalía Niño)<br>D = N(√(√(T × U) × N(población)))<br>Q = N(noches normales + P × anomalía Niño)<br>Calor = N(√(Q × N(población)))</p>'+t(
        '<p>Días aptos: temperatura media diaria entre 20 y 32 °C. Noches tropicales: mínima diaria mayor a 25 °C. Se calculan con ERA5-Land por verano, con normal 1991–2020. Población: WorldPop 2020. Las anomalías son diferencias medias de los veranos Niño respecto de la normal, en días/noches.</p><p>Dengue mide condiciones favorables para el vector, no casos. Calor mide noches cálidas y población, no grados ni sensación térmica. La humedad del índice de dengue es un indicador construido con lluvia, no humedad relativa medida.</p>',
        '<p>Suitable days: daily mean temperature between 20 and 32 °C. Tropical nights: daily minimum above 25 °C. Computed from ERA5-Land per summer, with a 1991–2020 baseline. Population: WorldPop 2020. Anomalies are mean Niño summer differences from normal in days/nights.</p><p>Dengue describes vector suitability, not cases. Heat combines warm nights and population, not degrees or apparent temperature. The dengue moisture term is a rainfall-based proxy, not measured relative humidity.</p>'))+
      panel(t('4. Escalas y categorías: cómo leer un valor de 0 a 1','4. Scales and categories: reading values from 0 to 1'),t(
        '<p>N(x) = 0,01 + 0,99 × (x − mínimo)/(máximo − mínimo), sobre los 25 departamentos. Si todos tienen el mismo valor, N = 0,5. Un índice 0,8 no significa 80 % de riesgo.</p><p>Las categorías de caminos, dengue y calor se asignan por quintiles: se ordenan los 25 departamentos y se forman cinco grupos de cinco, de 1 (menor) a 5 (mayor). Los empates se ordenan por identificador. Son posiciones relativas, no umbrales físicos. Las clases de lluvia usan umbrales de probabilidad, no quintiles.</p>',
        '<p>N(x) = 0.01 + 0.99 × (x − minimum)/(maximum − minimum), across all 25 departments. If all values match, N = 0.5. An index of 0.8 does not mean 80% risk.</p><p>Road, dengue and heat categories use quintiles: rank all 25 departments into five groups of five, from 1 (lower) to 5 (higher). Ties use department identifiers. These are relative positions, not physical thresholds. Rain classes use probability thresholds, not quintiles.</p>'))+
      panel(t('5. Agua observada: una medición del pasado','5. Observed water: a measurement of the past'),t(
        `<p>Sentinel-1 VV: mediana del mes y filtro de 30 m. Se exige VV menor al umbral Otsu (respaldo −18 dB si sale de −24 a −15 dB) y una caída de más de 3 dB respecto del mismo mes en 2017–2025, excluyendo el año medido. Se descarta agua habitual con ocurrencia JRC ≥50 %. Se suman píxeles de agua en km² por departamento.</p><p>Los caminos con agua se aproximan rasterizando a 30 m y sumando 0,03 km por píxel coincidente; no es una verificación de transitabilidad. Fecha observada de esta emisión: ${e.agua_obs.fecha_imagen}; umbral publicado: ${f(e.agua_obs.umbral_db)} dB. No es pronóstico.</p>`,
        `<p>Sentinel-1 VV: monthly median and a 30 m filter. VV must be below the Otsu threshold (−18 dB fallback if outside −24 to −15 dB) and more than 3 dB below the same month in 2017–2025, excluding the measured year. JRC occurrence ≥50% masks habitual water. Water pixels are summed in km² per department.</p><p>Water-covered roads are approximated by 30 m rasterization, adding 0.03 km per intersecting pixel; this does not verify passability. Observation date: ${e.agua_obs.fecha_imagen}; published threshold: ${f(e.agua_obs.umbral_db)} dB. This is not a forecast.</p>`))+
      panel(t('6. Próximos días: milímetros, probabilidades y escenarios','6. Next few days: millimetres, probabilities and scenarios'),t(
        '<p>Pronóstico general y detalle de 72 horas: API Forecast de Open-Meteo, combinación de modelos disponible para las coordenadas consultadas. Cantidad prevista y probabilidad de precipitación son variables distintas.</p><p>Probabilidades por cantidad: 40 miembros ICON-EPS (DWD), vía Ensemble API. P(&gt;u mm) = 100 × miembros con acumulado diario estrictamente mayor a u / miembros completos. Se muestran u = 1, 10, 20 y 50 mm. Mediana = percentil 50; rango = percentiles 10–90 por interpolación lineal. No están calibradas con observaciones locales ni son intervalos garantizados.</p><p>Días de 00–24 h de Argentina; hoy incluye horas ya transcurridas. El mapa muestrea a 0,25° (~25 km), recortado a Chaco, sin detalle por calle. Las fichas consultan el punto de la localidad o dispositivo. La grilla se actualiza cada seis horas; las consultas por punto se reutilizan una hora. Si falla el conjunto, se muestran guiones, nunca probabilidades inventadas.</p><p>Fuente: <a href="https://open-meteo.com/en/docs/ensemble-api">Open-Meteo Ensemble API</a> · <a href="https://open-meteo.com/en/docs">Forecast API</a>. Grilla descargable: <a href="data/precipitacion.json">precipitacion.json</a>.</p>',
        '<p>General forecast and 72-hour detail: Open-Meteo Forecast API, using the model combination available for the queried coordinates. Expected amount and precipitation probability are distinct variables.</p><p>Amount probabilities: 40 ICON-EPS members (DWD) via Ensemble API. P(&gt;u mm) = 100 × members strictly exceeding u in a day / complete members. Thresholds are 1, 10, 20 and 50 mm. Median = percentile 50; range = percentiles 10–90 using linear interpolation. These are not locally calibrated probabilities or guaranteed intervals.</p><p>Days run 00–24 h Argentina time; today includes elapsed hours. The map samples at 0.25° (~25 km), clipped to Chaco, without street-level detail. Point forecasts use town or device coordinates. The grid updates every six hours; point queries are cached for one hour. Missing ensemble results display dashes, never invented probabilities.</p><p>Sources: <a href="https://open-meteo.com/en/docs/ensemble-api">Open-Meteo Ensemble API</a> · <a href="https://open-meteo.com/en/docs">Forecast API</a>. Download: <a href="data/precipitacion.json">precipitacion.json</a>.</p>'));
    document.getElementById('trazabilidad-titulo').textContent=t('De dónde sale cada valor · ','Where each value comes from · ')+datos.porId[id].nombre;
    document.getElementById('trazabilidad-meta').textContent=t('Emisión ','Emission ')+e.emision+' · '+I.trimestre(e)+t('. Valores del archivo publicado; pueden estar redondeados. Los intermedios normalizados no se guardan todos en la emisión.','. Values from the published file; rounding may apply. Not all normalized intermediate values are stored in the emission.');
    const filas=campos.map(([ruta,a,b,fuente,unidad])=>{
      const valor=ruta.split('.').reduce((o,k)=>o?.[k],d), [nombre,url]=fuentes[fuente];
      return `<tr><th scope="row"><code>${ruta}</code><span>${es?a:b}</span></th><td data-label="${t('Valor','Value')}">${f(valor)} <small>${valor == null ? '' : unidad === '0–1' ? t('(escala 0–1)','(scale 0–1)') : unidad === '1–5' ? t('(categoría 1–5)','(category 1–5)') : unidad}</small></td><td data-label="${t('Fuente','Source')}"><a href="${url}">${nombre}</a></td></tr>`;
    });
    document.getElementById('trazabilidad-filas').innerHTML=filas.join('');
    document.getElementById('trazabilidad-global').innerHTML=t(
      `<p>P(Niño) publicado: <strong>${f(e.prob_nino)}</strong> (0–1), intensidad: ${e.intensidad}. Es un parámetro ingresado por el operador con referencia IRI/CPC; la web no consulta IRI en tiempo real. Veranos Niño usados: ${Object.keys(e.veranos_nino).join(', ')}. Método: ${e.metodo.version}.</p>`,
      `<p>Published P(Niño): <strong>${f(e.prob_nino)}</strong> (0–1), intensity: ${e.intensidad}. This is an operator-entered parameter referencing IRI/CPC; the website does not query IRI live. Niño summers used: ${Object.keys(e.veranos_nino).join(', ')}. Method: ${e.metodo.version}.</p>`)+
      `<p><a href="data/emision-${e.emision}.json">${t('Archivo completo de esta emisión','Full emission file')}</a> · <a href="${codigo}pipeline/indice.py">${t('Fórmulas en Python','Python formulas')}</a> · <a href="${codigo}pipeline/gee.py">${t('Procesamiento satelital','Satellite processing')}</a> · <a href="${codigo}pipeline/config.yaml">${t('Umbrales y configuración','Thresholds and configuration')}</a></p>`;
  }
  window.Metodologia={render};
})();
