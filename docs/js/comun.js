/* Funciones compartidas por la vista ciudadana y la técnica. */
(function () {
  "use strict";

  const RIESGO = ["#E3EAF0", "#B3C7D8", "#E9C48A", "#D4793A", "#9E3A1A"];
  const AZULES = ["#EEF2F6", "#C7D7E6", "#8FB0CF", "#4F7FAD", "#1F4E79"];

  const I = window.I18N;
  // Clases con texto según el idioma activo.
  const clases = (clave, colores) => colores.map((color, i) => ({ color, get texto() { return I.T(clave)[i]; } }));

  // Cada módulo define cómo se clasifica un departamento para la vista ciudadana.
  const MODULOS = {
    lluvia: {
      get nombre() { return I.T("mod.lluvia"); },
      get leyendaTitulo() { return I.T("ley.lluvia"); },
      clases: clases("cl.lluvia", ["#C9A15E", "#EDEAE3", "#A9C3DA", "#5C8AB5", "#1F4E79"]),
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
      get nombre() { return I.T("mod.anegamiento"); },
      get leyendaTitulo() { return I.T("ley.anegamiento"); },
      clases: clases("cl.anegamiento", RIESGO),
      clase: (d) => d.anegamiento.categoria - 1,
    },
    dengue: {
      get nombre() { return I.T("mod.dengue"); },
      get leyendaTitulo() { return I.T("ley.dengue"); },
      clases: clases("cl.dengue", RIESGO),
      clase: (d) => d.dengue.categoria - 1,
    },
    calor: {
      get nombre() { return I.T("mod.calor"); },
      get leyendaTitulo() { return I.T("ley.calor"); },
      clases: clases("cl.calor", RIESGO),
      clase: (d) => d.calor.categoria - 1,
    },
    agua: {
      get nombre() { return I.T("mod.agua"); },
      get leyendaTitulo() { return I.T("ley.agua"); },
      clases: clases("cl.agua", AZULES),
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
    let atribucion = new maplibregl.AttributionControl({ compact: true, customAttribution: I.T("mapa.limites") });
    mapa.addControl(atribucion);
    document.addEventListener("idioma", () => {
      mapa.removeControl(atribucion);
      atribucion = new maplibregl.AttributionControl({ compact: true, customAttribution: I.T("mapa.limites") });
      mapa.addControl(atribucion);
    });

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
    const items = datos.localidades.map((l) => ({ texto: l.nombre, valor: l.nombre, sub: datos.porId[l.depto].nombre, depto: l.depto }));
    datos.deptos.features.forEach((f) => items.push({ texto: I.T("depto", f.properties.nombre), valor: f.properties.nombre, sub: "Chaco", depto: f.id }));
    items.forEach((i) => { i.clave = normalizar(i.texto); i.base = normalizar(i.valor); });
    return items;
  }

  function buscar(indice, consulta, max = 8) {
    const q = normalizar(consulta);
    if (!q) return [];
    const empiezan = indice.filter((i) => i.clave.startsWith(q) || i.base.startsWith(q));
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

  const pct = (v) => I.pct(v);
  const num = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v)) ? "—" : v.toLocaleString(I.locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  const { fechaLarga, mesLargo } = I;

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
    div.innerHTML = `<div class="panel" style="margin-top:24px;padding:20px"><strong>${I.T("error.titulo")}</strong><p style="margin:6px 0 0">${I.T("error.texto")}</p></div>`;
    document.querySelector("main").prepend(div);
    console.error(err);
  }

  window.SIG = { MODULOS, cargarDatos, crearMapa, indiceBusqueda, buscar, deptoEnPunto, pct, num, fechaLarga, mesLargo, leerPreferido, guardarPreferido, registrarSW, mostrarError, AZULES, RIESGO };
})();
