/* Pronóstico diario por punto representativo. Open-Meteo, CC BY 4.0. */
(function () {
  "use strict";
  const DIAS = 7, TTL = 60 * 60 * 1000;
  const memoria = new Map(), pendientes = new Map();
  let seleccion = 0;
  const es = () => window.I18N.idioma === "es";
  const texto = (a, b) => es() ? a : b;
  const clave = (id) => `pronostico-7-v3-${id}`;

  function validar(datos) {
    const d = datos && datos.daily;
    if (!d || !Array.isArray(d.time) || d.time.length !== DIAS ||
        !["precipitation_sum", "precipitation_probability_max", "weather_code"].every(
          (k) => Array.isArray(d[k]) && d[k].length === DIAS)) throw new Error("Pronóstico incompleto");
    d.time.forEach((fecha, i) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || (i && fecha <= d.time[i - 1])) throw new Error("Fecha inválida");
      for (const [k, max] of [["precipitation_sum", Infinity], ["precipitation_probability_max", 100], ["weather_code", 99]]) {
        const v = d[k][i];
        if (v !== null && (!Number.isFinite(v) || v < 0 || v > max)) throw new Error("Valor inválido");
      }
    });
    return datos;
  }

  function leer(id) {
    if (memoria.has(id)) return memoria.get(id);
    try {
      const copia = JSON.parse(localStorage.getItem(clave(id)));
      if (copia && Number.isFinite(copia.consultado)) {
        validar(copia.datos);
        memoria.set(id, copia);
        return copia;
      }
    } catch (_) { /* caché ausente o inválida */ }
    return null;
  }

  async function descargar(id, centro, privada = false) {
    if (pendientes.has(id)) return pendientes.get(id);
    const tarea = (async () => {
      const params = new URLSearchParams({ latitude: centro[1], longitude: centro[0],
        daily: "precipitation_sum,precipitation_probability_max,weather_code",
        hourly: "precipitation,precipitation_probability,weather_code",
        timezone: "America/Argentina/Buenos_Aires", forecast_days: DIAS });
      const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: AbortSignal.timeout(15000), cache: "no-store"
      });
      if (!respuesta.ok) throw new Error(`Open-Meteo: ${respuesta.status}`);
      const datos = validar(await respuesta.json());
      let ensamble = null;
      try {
        const ep = new URLSearchParams({latitude: centro[1], longitude: centro[0], daily: "precipitation_sum", models: "icon_seamless", forecast_days: DIAS, timezone: "America/Argentina/Buenos_Aires"});
        const er = await fetch(`https://ensemble-api.open-meteo.com/v1/ensemble?${ep}`, {signal: AbortSignal.timeout(20000), cache: "no-store"});
        if (!er.ok) throw Error("Ensamble no disponible");
        ensamble = window.Ensamble.diario(await er.json());
        if (ensamble.some((d,i) => d.fecha !== datos.daily.time[i])) throw Error("Fechas distintas");
      } catch (_) { ensamble = null; }
      const copia = { consultado: Date.now(), datos, ensamble };
      memoria.set(id, copia);
      try { if (!privada) localStorage.setItem(clave(id), JSON.stringify(copia)); } catch (_) { /* almacenamiento no disponible */ }
      return copia;
    })();
    pendientes.set(id, tarea);
    try { return await tarea; } finally { pendientes.delete(id); }
  }

  function condicion(codigo) {
    if (codigo === null) return texto("Sin dato", "No data");
    if ([95, 96, 99].includes(codigo)) return texto(codigo === 95 ? "Tormentas" : "Tormentas con granizo", codigo === 95 ? "Thunderstorms" : "Thunderstorms with hail");
    if ([80, 81, 82].includes(codigo)) return texto("Chaparrones", "Rain showers");
    if ([56, 57, 66, 67].includes(codigo)) return texto("Precipitación helada", "Freezing precipitation");
    if ([61, 63, 65].includes(codigo)) return texto("Lluvia", "Rain");
    if ([51, 53, 55].includes(codigo)) return texto("Llovizna", "Drizzle");
    if ([71, 73, 75, 77, 85, 86].includes(codigo)) return texto("Nieve", "Snow");
    if ([45, 48].includes(codigo)) return texto("Niebla", "Fog");
    if ([0, 1].includes(codigo)) return texto("Despejado", "Clear");
    if ([2, 3].includes(codigo)) return texto("Nublado", "Cloudy");
    return texto("Sin clasificación", "Unclassified");
  }

  function dibujar(copia, guardado) {
    const d = copia.datos.daily, locale = window.I18N.locale();
    const tabla = document.getElementById("pronostico-dias");
    tabla.replaceChildren();
    for (let i = 0; i < d.time.length; i++) {
      const fila = document.createElement("tr");
      if ([95, 96, 99].includes(d.weather_code[i])) fila.className = "dia-tormenta";
      const valores = [new Date(d.time[i] + "T12:00:00-03:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" }),
        condicion(d.weather_code[i]),
        d.precipitation_sum[i] === null ? "—" : `${d.precipitation_sum[i].toLocaleString(locale, { maximumFractionDigits: 1 })} mm`,
        d.precipitation_probability_max[i] === null ? "—" : `${d.precipitation_probability_max[i]} %`];
      valores.forEach((valor, j) => {
        const celda = document.createElement(j ? "td" : "th");
        if (!j) celda.scope = "row";
        celda.textContent = valor;
        fila.append(celda);
      });
      const e = copia.ensamble?.[i];
      for (const valor of [e ? `${e.mediana.toFixed(1)} (${e.p10.toFixed(1)}–${e.p90.toFixed(1)}) mm` : "—", ...[1,10,20,50].map(u => e ? `${e.prob[u]} %` : "—")]) {
        const celda = document.createElement("td"); celda.textContent = valor; fila.append(celda);
      }
      tabla.append(fila);
    }
    document.getElementById("pronostico-tabla").hidden = false;
    document.getElementById("ensamble-estado").textContent = copia.ensamble ? texto(
      `ICON-EPS · ${copia.ensamble[0].miembros} simulaciones. Mediana y rango P10–P90; proporción que supera cada umbral, sin calibración local. Días de 00 a 24 h (Argentina).`,
      `ICON-EPS · ${copia.ensamble[0].miembros} simulations. Median and P10–P90 range; fraction exceeding each threshold, without local calibration. Days run 00–24 h (Argentina).`) : texto("Ensamble no disponible; las probabilidades por umbral no se pudieron calcular.", "Ensemble unavailable; threshold probabilities could not be computed.");
    const horas = document.getElementById("pronostico-horas"); horas.replaceChildren();
    const h = copia.datos.hourly;
    if (h && Array.isArray(h.time)) {
      const inicio = new Date(); inicio.setMinutes(0,0,0);
      const indices = h.time.map((t,i) => i).filter(i => new Date(h.time[i]+"-03:00") >= inicio).slice(0,72);
      for (const i of indices) {
        const fila = document.createElement("tr");
        const fecha = new Date(h.time[i]+"-03:00").toLocaleString(locale, {day:"numeric",month:"short",hour:"2-digit",timeZone:"America/Argentina/Buenos_Aires"});
        for (const v of [fecha, condicion(h.weather_code?.[i] ?? null), Number.isFinite(h.precipitation?.[i]) ? `${h.precipitation[i]} mm` : "—", Number.isFinite(h.precipitation_probability?.[i]) ? `${h.precipitation_probability[i]} %` : "—"]) {
          const td = document.createElement("td"); td.textContent = v; fila.append(td);
        }
        horas.append(fila);
      }
      document.getElementById("horas-detalle").hidden = !indices.length;
    } else document.getElementById("horas-detalle").hidden = true;
    document.getElementById("pronostico-estado").textContent =
      (guardado ? texto("Copia guardada; no se pudo actualizar. Puede estar desactualizada. ", "Saved copy; update failed. It may be outdated. ") : "") +
      texto("Consultado: ", "Retrieved: ") + new Date(copia.consultado).toLocaleString(locale, { timeZone: "America/Argentina/Buenos_Aires" }) + texto(" (hora argentina).", " (Argentina time).");
  }

  async function mostrar(id, propiedades, { forzar = false } = {}) {
    const turno = ++seleccion;
    id = `${propiedades.centro[0].toFixed(4)},${propiedades.centro[1].toFixed(4)}`;
    if (propiedades.dispositivo) id = "dispositivo:" + id;
    document.getElementById("pronostico-titulo").textContent = texto("Lluvia y tormentas · próximos 7 días", "Rain and thunderstorms · next 7 days");
    document.getElementById("pronostico-zona").textContent = (propiedades.dispositivo ? texto("Tu ubicación actual", "Your current location") : texto("Localidad: ", "Town: ") + propiedades.cabecera) + (propiedades.nombre ? " · " + propiedades.nombre : "");
    document.getElementById("pronostico-nota").textContent = texto(
      "Estimación para las coordenadas de la localidad o del dispositivo; puede variar en los alrededores. La probabilidad corresponde a precipitación, no a tormentas. Las tormentas se indican según el código meteorológico del modelo. No es una alerta oficial; consultá al SMN.",
      "Estimate for the town or device coordinates; conditions may vary nearby. Probability refers to precipitation, not thunderstorms. Thunderstorms follow the model’s weather code. This is not an official warning; consult SMN.");
    document.querySelectorAll("[data-pron-es]").forEach((n) => { n.textContent = es() ? n.dataset.pronEs : n.dataset.pronEn; });
    document.getElementById("pronostico-tabla").hidden = true;
    document.getElementById("horas-detalle").hidden = true;
    document.getElementById("ensamble-estado").textContent = "";
    document.getElementById("pronostico-estado").textContent = texto("Consultando Open-Meteo…", "Loading Open-Meteo…");
    const copia = propiedades.dispositivo ? memoria.get(id) : leer(id);
    if (!forzar && copia && Date.now() - copia.consultado >= 0 && Date.now() - copia.consultado < TTL) { dibujar(copia, false); return; }
    try {
      const nueva = await descargar(id, propiedades.centro, propiedades.dispositivo);
      if (turno === seleccion) dibujar(nueva, false);
    } catch (_) {
      if (turno !== seleccion) return;
      if (copia) dibujar(copia, true);
      else document.getElementById("pronostico-estado").textContent = texto("No se pudo obtener el pronóstico. Revisá tu conexión y volvé a intentar.", "Could not load the forecast. Check your connection and retry.");
    }
  }
  window.Pronostico = { mostrar, validar, condicion };
})();
