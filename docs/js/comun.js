/* Funciones compartidas por la vista ciudadana y la técnica. */
(function () {
  "use strict";

  const RIESGO = ["#E3EAF0", "#B3C7D8", "#E9C48A", "#D4793A", "#9E3A1A"];
  const AZULES = ["#EEF2F6", "#C7D7E6", "#8FB0CF", "#4F7FAD", "#1F4E79"];

  // Cada módulo define cómo se clasifica un departamento para la vista ciudadana.
  const MODULOS = {
    lluvia: {
      nombre: "Lluvia",
      leyendaTitulo: "Lluvia esperada respecto de lo normal",
      clases: [
        { color: "#C9A15E", texto: "Más probable menos lluvia" },
        { color: "#EDEAE3", texto: "Sin tendencia clara" },
        { color: "#A9C3DA", texto: "Algo más probable más lluvia" },
        { color: "#5C8AB5", texto: "Probablemente más lluvia" },
        { color: "#1F4E79", texto: "Muy probablemente más lluvia" },
      ],
      clase(d) {
        const l = d.lluvia;
        if (l.prob_normal === null || l.prob_normal === undefined) {
          // Dos categorías (por encima o por debajo de lo normal): 50 % es "sin señal".
          if (l.prob_superior >= 0.8) return 4;
          if (l.prob_superior >= 0.65) return 3;
          if (l.prob_superior > 0.55) return 2;
          if (l.prob_superior >= 0.45) return 1;
          return 0;
        }
        // Terciles: 33 % es "sin señal".
        if (l.prob_inferior > l.prob_superior) return 0;
        if (l.prob_superior >= 0.55) return 4;
        if (l.prob_superior >= 0.47) return 3;
        if (l.prob_superior >= 0.40) return 2;
        return 1;
      },
    },
    anegamiento: {
      nombre: "Caminos",
      leyendaTitulo: "Posibilidad de cortes de caminos por agua",
      clases: ["Muy baja", "Baja", "Media", "Alta", "Muy alta"].map((t, i) => ({ color: RIESGO[i], texto: t })),
      clase: (d) => d.anegamiento.categoria - 1,
    },
    dengue: {
      nombre: "Dengue",
      leyendaTitulo: "Condiciones climáticas para el mosquito del dengue",
      clases: ["Poco favorables", "Algo favorables", "Favorables", "Bastante favorables", "Muy favorables"].map((t, i) => ({ color: RIESGO[i], texto: t })),
      clase: (d) => d.dengue.categoria - 1,
    },
    calor: {
      nombre: "Calor",
      leyendaTitulo: "Calor húmedo y noches que no refrescan",
      clases: ["Bajo", "Moderado bajo", "Moderado", "Alto", "Muy alto"].map((t, i) => ({ color: RIESGO[i], texto: t })),
      clase: (d) => d.calor.categoria - 1,
    },
    agua: {
      nombre: "Agua observada",
      leyendaTitulo: "Superficie con agua fuera de lo habitual",
      clases: [
        { color: AZULES[0], texto: "Menos de 2 km²" },
        { color: AZULES[1], texto: "2 a 10 km²" },
        { color: AZULES[2], texto: "10 a 30 km²" },
        { color: AZULES[3], texto: "30 a 60 km²" },
        { color: AZULES[4], texto: "Más de 60 km²" },
      ],
      clase(d) {
        const k = d.agua_obs.km2;
        return k < 2 ? 0 : k < 10 ? 1 : k < 30 ? 2 : k < 60 ? 3 : 4;
      },
    },
  };

  async function obtenerJSON(ruta) {
    const r = await fetch(ruta, { cache: "no-cache" });
    if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
    return r.json();
  }

  async function cargarDatos() {
    const actual = await obtenerJSON("data/emision-actual.json");
    const [emision, deptos, contexto, localidades] = await Promise.all([
      obtenerJSON("data/" + actual.archivo),
      obtenerJSON("data/departamentos.geojson"),
      obtenerJSON("data/contexto.geojson"),
      obtenerJSON("data/localidades.json"),
    ]);
    const porId = {};
    deptos.features.forEach((f) => { porId[f.id] = f.properties; });
    // Con datos reales se ocultan la franja y las etiquetas de demostración (ver app.css).
    document.documentElement.classList.toggle("es-real", !emision.demo);
    return { emision, deptos, contexto, localidades, porId };
  }

  function limites(fc) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const recorrer = (c) => {
      if (typeof c[0] === "number") {
        x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]);
        y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
      } else c.forEach(recorrer);
    };
    fc.features.forEach((f) => recorrer(f.geometry.coordinates));
    return [[x0, y0], [x1, y1]];
  }

  // Mapa base sin teselas externas: funciona sin conexión.
  function crearMapa(contenedor, datos, alSeleccionar) {
    const caja = limites(datos.deptos);
    const mapa = new maplibregl.Map({
      container: contenedor,
      style: {
        version: 8,
        sources: {
          contexto: { type: "geojson", data: datos.contexto },
          deptos: { type: "geojson", data: datos.deptos, promoteId: "id" },
        },
        layers: [
          { id: "fondo", type: "background", paint: { "background-color": "#EEF1F4" } },
          { id: "contexto-relleno", type: "fill", source: "contexto", paint: { "fill-color": "#E2E6EA" } },
          { id: "contexto-borde", type: "line", source: "contexto", paint: { "line-color": "#B7C0C9", "line-width": 0.8 } },
          { id: "deptos-relleno", type: "fill", source: "deptos", paint: { "fill-color": ["coalesce", ["feature-state", "color"], "#DDE3E9"], "fill-opacity": 0.95 } },
          { id: "deptos-borde", type: "line", source: "deptos", paint: { "line-color": "#1B232C", "line-width": 0.6, "line-opacity": 0.55 } },
          { id: "deptos-sel", type: "line", source: "deptos", paint: { "line-color": "#0B1A2A", "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, 0] } },
        ],
      },
      bounds: caja,
      fitBoundsOptions: { padding: 24 },
      maxBounds: [[caja[0][0] - 4, caja[0][1] - 3], [caja[1][0] + 4, caja[1][1] + 3]],
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
      cooperativeGestures: matchMedia("(pointer: coarse)").matches,
    });
    mapa.touchZoomRotate.disableRotation();
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapa.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Límites: IGN (SIG 250)" }));

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    mapa.on("mousemove", "deptos-relleno", (e) => {
      mapa.getCanvas().style.cursor = "pointer";
      const p = e.features[0].properties;
      popup.setLngLat(e.lngLat).setHTML(`<strong>${p.nombre}</strong>${p.cabecera}`).addTo(mapa);
    });
    mapa.on("mouseleave", "deptos-relleno", () => { mapa.getCanvas().style.cursor = ""; popup.remove(); });
    mapa.on("click", "deptos-relleno", (e) => alSeleccionar(e.features[0].id));

    let seleccionado = null;
    return {
      mapa,
      listo: new Promise((ok) => mapa.on("load", ok)),
      colorear(colorPorId) {
        Object.entries(colorPorId).forEach(([id, color]) => mapa.setFeatureState({ source: "deptos", id }, { color }));
      },
      seleccionar(id) {
        if (seleccionado) mapa.setFeatureState({ source: "deptos", id: seleccionado }, { sel: false });
        seleccionado = id;
        if (id) mapa.setFeatureState({ source: "deptos", id }, { sel: true });
      },
      ajustar() { mapa.resize(); mapa.fitBounds(caja, { padding: 24, animate: false }); },
    };
  }

  function normalizar(t) {
    return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  // Lista de búsqueda: localidades y departamentos.
  function indiceBusqueda(datos) {
    const items = datos.localidades.map((l) => ({ texto: l.nombre, sub: datos.porId[l.depto].nombre, depto: l.depto }));
    datos.deptos.features.forEach((f) => items.push({ texto: "Departamento " + f.properties.nombre, sub: "Chaco", depto: f.id }));
    items.forEach((i) => { i.clave = normalizar(i.texto); });
    return items;
  }

  function buscar(indice, consulta, max = 8) {
    const q = normalizar(consulta);
    if (!q) return [];
    const empiezan = indice.filter((i) => i.clave.startsWith(q) || i.clave.replace("departamento ", "").startsWith(q));
    const contienen = indice.filter((i) => !empiezan.includes(i) && i.clave.includes(q));
    return empiezan.concat(contienen).slice(0, max);
  }

  function puntoEnAnillo(p, anillo) {
    let dentro = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }

  function deptoEnPunto(datos, lon, lat) {
    for (const f of datos.deptos.features) {
      const g = f.geometry;
      const poligonos = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      for (const pol of poligonos) {
        if (puntoEnAnillo([lon, lat], pol[0]) && !pol.slice(1).some((h) => puntoEnAnillo([lon, lat], h))) return f.id;
      }
    }
    return null;
  }

  const pct = (v) => Math.round(v * 100) + " %";
  const num = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v)) ? "—" : v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fechaLarga = (iso) => { const [a, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };
  const mesLargo = (iso) => { const [a, m] = iso.split("-").map(Number); return `${MESES[m - 1]} de ${a}`; };

  function leerPreferido() {
    try { return localStorage.getItem("depto"); } catch (e) { return null; }
  }
  function guardarPreferido(id) {
    try { localStorage.setItem("depto", id); } catch (e) { /* sin almacenamiento */ }
  }

  function registrarSW() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }

  function mostrarError(err) {
    const div = document.createElement("div");
    div.className = "contenedor";
    div.innerHTML = '<div class="panel" style="margin-top:24px;padding:20px"><strong>No se pudieron cargar los datos.</strong><p style="margin:6px 0 0">Revisá tu conexión y volvé a intentar.</p></div>';
    document.querySelector("main").prepend(div);
    console.error(err);
  }

  window.SIG = { MODULOS, cargarDatos, crearMapa, indiceBusqueda, buscar, deptoEnPunto, pct, num, fechaLarga, mesLargo, leerPreferido, guardarPreferido, registrarSW, mostrarError, AZULES, RIESGO };
})();
