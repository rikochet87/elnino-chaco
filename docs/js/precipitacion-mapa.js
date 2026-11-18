/* Celdas de pronóstico regional: sin interpolar una precisión inexistente. */
(function () {
  'use strict';
  const colores = ['rgba(237,248,251,0)','rgba(179,226,226,0.25)','#66c2a4','#2ca25f','#ffff99','#fdae61','#d73027','#762a83'];
  const cortes = [0,1,5,10,20,30,50,80];
  const umbralesResaltado = {mediana:0, '1':0, '10':0, '20':0, '50':0};
  let mapa, datos, recortes, activo = false, dia = 0, variable = 'mediana', error = false;
  const txt = (es,en) => window.I18N.idioma === 'es' ? es : en;
  function features() {
    const porCentro = new Map(datos.celdas.map(c => [c.centro.join(','), c]));
    return {type:'FeatureCollection',features:recortes.features.map(f => {
      const c = porCentro.get(f.properties.centro.join(','));
      if (!c) throw Error('La geometría no coincide con la grilla');
      const d = c.dias[dia];
      return {...f, properties:{valor:variable === 'mediana' ? d.mediana : d.prob[variable]}};
    })};
  }

  function color() {
    const umbrales = variable === 'mediana' ? cortes : [0,10,25,40,55,70,85,95];
    return ['interpolate',['linear'],['get','valor'], ...umbrales.flatMap((v,i) => [v,colores[i]])];
  }
  function aplicarResaltado() {
    if (!mapa?.getLayer('precipitacion-celdas')) return;
    const umbral = umbralesResaltado[variable];
    mapa.setPaintProperty('precipitacion-celdas', 'fill-opacity',
      umbral > 0 ? ['case', ['<', ['get','valor'], umbral], 0.05, 0.65] : 0.55);
  }
  function controlResaltado() {
    const caja = document.createElement('div'); caja.className = 'filtro-precipitacion';
    const cab = document.createElement('div'); cab.className = 'filtro-precipitacion-cab';
    const label = document.createElement('label'); label.htmlFor = 'precipitacion-umbral';
    label.textContent = txt('Resaltar desde', 'Highlight from');
    const salida = document.createElement('output'); salida.id = 'precipitacion-umbral-valor'; salida.setAttribute('for','precipitacion-umbral');
    const reiniciar = document.createElement('button'); reiniciar.type = 'button'; reiniciar.className = 'reiniciar-umbral';
    reiniciar.textContent = txt('Restablecer', 'Reset');
    cab.append(label, salida, reiniciar); caja.append(cab);
    const input = document.createElement('input'); input.type = 'range'; input.id = 'precipitacion-umbral';
    input.min = '0'; input.max = '100'; input.step = '5'; input.value = String(umbralesResaltado[variable]);
    input.setAttribute('aria-describedby','precipitacion-umbral-ayuda');
    caja.append(input);
    const marcas = document.createElement('div'); marcas.className = 'marcas-umbral'; marcas.setAttribute('aria-hidden','true');
    [0,25,50,75,100].forEach(v=>{const span=document.createElement('span'); span.textContent=String(v);marcas.append(span);});caja.append(marcas);
    const ayuda = document.createElement('p'); ayuda.id = 'precipitacion-umbral-ayuda'; ayuda.className = 'ayuda-umbral'; caja.append(ayuda);
    const actualizar = () => {
      const valor = umbralesResaltado[variable], unidad = variable === 'mediana' ? 'mm' : '%';
      salida.textContent = `${valor} ${unidad}`;
      input.style.setProperty("--porcentaje-umbral", `${valor}%`);
      input.setAttribute('aria-valuetext', `${valor} ${unidad}`);
      reiniciar.disabled = valor === 0;
      const supera = valor === 0 || features().features.some(f=>f.properties.valor >= valor);
      ayuda.textContent = !supera ? txt('Ninguna zona alcanza este umbral en el día elegido. Los datos no cambian.', 'No area reaches this threshold on the selected day. The data is unchanged.') :
        valor > 0 ? txt('Los valores inferiores se atenúan; esto no significa que no vaya a llover.', 'Lower values are faded; this does not mean it will not rain.') :
        txt('Mové el control para resaltar cantidades o probabilidades mayores. No modifica el pronóstico.', 'Move the slider to highlight higher amounts or probabilities. It does not change the forecast.');
    };
    input.addEventListener('input', () => {
      umbralesResaltado[variable] = Number(input.value);
      aplicarResaltado(); actualizar();
    });
    reiniciar.addEventListener('click', () => {
      umbralesResaltado[variable] = 0; input.value = '0'; aplicarResaltado(); actualizar();
      input.focus();
    });
    actualizar(); return caja;
  }
  function pintar() {
    if (!mapa.getLayer('precipitacion-celdas')) return;
    mapa.setLayoutProperty('precipitacion-celdas','visibility',activo ? 'visible':'none');
    mapa.setPaintProperty('deptos-relleno','fill-opacity',activo ? 0 : .85);
    if (activo && datos) {
      mapa.getSource('precipitacion').setData(features());
      mapa.setPaintProperty('precipitacion-celdas','fill-color',color());
      aplicarResaltado();
    }
  }
  function leyenda() {
    if (!activo) return;
    const n=document.getElementById('leyenda'); n.replaceChildren();
    const titulo=document.createElement('h3'); titulo.textContent=txt('Precipitación por zona','Precipitation by area'); n.append(titulo);
    const nota=document.createElement('p');
    if (!datos) {nota.textContent=error ? txt('No se pudo cargar el mapa de precipitación.','Could not load the precipitation map.') : txt('Cargando pronóstico regional…','Loading regional forecast…'); n.append(nota); return;}
    const controles=document.createElement('div');controles.className='controles-precipitacion';
    const labelDia=document.createElement('label'); labelDia.textContent=txt('Día ','Day ');
    const selectDia=document.createElement('select'); selectDia.id='precipitacion-dia';
    datos.fechas.forEach((f,i) => {const o=document.createElement('option');o.value=i;o.textContent=new Date(f+'T12:00:00-03:00').toLocaleDateString(window.I18N.locale(),{weekday:'short',day:'numeric',month:'short',timeZone:'America/Argentina/Buenos_Aires'}); selectDia.append(o);});
    selectDia.value=dia; selectDia.addEventListener('change',()=>{dia=Number(selectDia.value);pintar();leyenda();}); labelDia.append(selectDia);controles.append(labelDia);
    const labelVar=document.createElement('label');labelVar.textContent=txt(' Mostrar ',' Show ');
    const select=document.createElement('select');select.id='precipitacion-variable';
    for (const [v,t] of [['mediana',txt('Lluvia (mm)','Rainfall (mm)')], ...[1,10,20,50].map(u=>[String(u),txt(`Más de ${u} mm (%)`,`Over ${u} mm (%)`)])]) {const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);}
    select.value=variable;select.addEventListener('change',()=>{variable=select.value;pintar();leyenda();});labelVar.append(select);controles.append(labelVar);n.append(controles);
    const barra=document.createElement('div');barra.className='escala-lluvia';barra.style.background=`linear-gradient(90deg,${(variable === 'mediana' ? cortes : [0,10,25,40,55,70,85,95]).map((v,i)=>`${colores[i]} ${v/(variable === 'mediana' ? 80:95)*100}%`).join(',')})`;n.append(barra);
    const escala=document.createElement('p');escala.className='escala-valores';
    const ticks=variable==='mediana' ? [0,10,20,50,80] : [0,25,50,75,95];
    ticks.forEach((v,i)=>{const marca=document.createElement('span');marca.style.left=`${v/ticks[ticks.length-1]*100}%`;marca.style.transform=i===0?'none':i===ticks.length-1?'translateX(-100%)':'translateX(-50%)';marca.textContent=i===ticks.length-1 ? `≥${v} ${variable==='mediana'?'mm':'%'}` : String(v);escala.append(marca);});n.append(escala);
    n.append(controlResaltado());
    const anticuado=Date.now()-Date.parse(datos.consultado)>12*3600000 || datos.fechas[dia]<new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
    nota.textContent=(anticuado ? txt('Datos antiguos; revisá las fechas. ','Older data; check the dates. '):'')+txt('ICON-EPS · 40 escenarios. Muestreo 0,25° (~25 km); no indica diferencias por calle. Caminos OSM requieren conexión. Actualizado: ','ICON-EPS · 40 scenarios. 0.25° sampling (~25 km); no street-level detail. OSM roads require a connection. Updated: ')+new Date(datos.consultado).toLocaleString(window.I18N.locale(),{timeZone:'America/Argentina/Buenos_Aires'})+txt('. Capa recortada a Chaco; el cero es transparente. Tocá el mapa o una localidad para consultar ese punto.','. Layer clipped to Chaco; zero is transparent. Tap the map or a town to query that point.');n.append(nota);
    const detalles=document.createElement('details');detalles.className='detalles-mapa'+(anticuado?' datos-antiguos':'');
    const resumen=document.createElement('summary');resumen.textContent=(anticuado?txt('Datos antiguos · ','Older data · '):'')+txt('Actualizado ','Updated ')+new Date(datos.consultado).toLocaleString(window.I18N.locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'})+txt(' · fuente y alcance',' · source and coverage');detalles.append(resumen,nota);
    const a=document.createElement('a');a.href='https://open-meteo.com/en/docs/ensemble-api';a.textContent='Open-Meteo · DWD · CC BY 4.0';detalles.append(a);n.append(detalles);
  }
  async function iniciar(m) {
    mapa=m;
    mapa.addSource('osm-caminos',{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'});
    mapa.addLayer({id:'osm-caminos',type:'raster',source:'osm-caminos',paint:{'raster-opacity':1}},'deptos-relleno');
    mapa.addSource('precipitacion',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    mapa.addLayer({id:'precipitacion-celdas',type:'fill',source:'precipitacion',layout:{visibility:'none'},paint:{'fill-color':'#66c2a4','fill-opacity':.55,'fill-outline-color':'rgba(0,0,0,0)'}},'deptos-borde');
    if (mapa.getLayer('punto-pronostico')) mapa.moveLayer('punto-pronostico');
    try {
      const [r,g]=await Promise.all([
        fetch('data/precipitacion.json',{cache:'no-cache'}),
        fetch('data/precipitacion-celdas.geojson',{cache:'no-cache'})
      ]);
      if(!r.ok || !g.ok)throw Error('Datos del mapa no disponibles');
      [datos,recortes]=await Promise.all([r.json(),g.json()]);
      if (!recortes.features?.length || recortes.paso !== datos.paso) throw Error('Geometría incompatible');
      if(!datos.celdas?.length || datos.fechas?.length!==7)throw Error('Grilla inválida');
      const hoy=new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
      const i=datos.fechas.indexOf(hoy);if(i>=0)dia=i;
      pintar();leyenda();
    } catch (_) {datos=null;error=true;leyenda();}
  }
  function descripcion(centro) {
    if (!datos) return txt('Pronóstico regional no disponible.','Regional forecast unavailable.');
    const celda=datos.celdas.reduce((a,b)=>Math.hypot(a.centro[0]-centro[0],a.centro[1]-centro[1])<Math.hypot(b.centro[0]-centro[0],b.centro[1]-centro[1]) ? a:b);
    const d=celda.dias[dia];
    return `${datos.fechas[dia]} · ${txt('Mediana de la celda','Cell median')}: ${d.mediana} mm · P(>20 mm): ${d.prob['20']} %`;
  }
  window.PrecipitacionMapa={iniciar, descripcion, activar(si){activo=si;if(mapa)pintar();if(si)leyenda();}, esActivo:()=>activo};
})();
