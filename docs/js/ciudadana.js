/* Vista ciudadana: ficha de la zona elegida y mapa por tema. */
(function () {
  "use strict";
  const S = window.SIG;
  const I = window.I18N, T = I.T;
  const $ = (id) => document.getElementById(id);
  const ORDEN_TABS = ["lluvia", "anegamiento", "dengue", "calor", "agua"];
  const POR_DEFECTO = "san-fernando";

  let datos, indice, mapa, actual, tabActiva = "lluvia";

  function nivelHTML(modulo, d, rotulo) {
    const m = S.MODULOS[modulo];
    const c = m.clases[m.clase(d)];
    const oscuro = ["#9E3A1A", "#D4793A"].includes(c.color);
    return `<span class="nivel-color" style="background:${c.color}"></span>` +
      `<span class="nivel-texto"><small>${rotulo}</small><strong style="color:${oscuro ? "#7A2C13" : "#1B232C"}">${c.texto}</strong></span>`;
  }

  function textoCaminos(cat) {
    return T(cat >= 4 ? "caminos.alta" : cat === 3 ? "caminos.media" : "caminos.baja");
  }

  function mostrarZona(id, { desplazar = false } = {}) {
    if (!datos.emision.departamentos[id]) return;
    actual = id;
    const p = datos.porId[id];
    const d = datos.emision.departamentos[id];
    const e = datos.emision;

    $("titulo-zona").textContent = T("zona.titulo", p.cabecera, p.nombre);
    $("linea-nino").innerHTML = T("zona.nino", S.pct(e.prob_nino), ` <span class="etiqueta-demo">${T("demo.dato")}</span>`);

    // Lluvia
    const l = d.lluvia;
    $("lluvia-titular").textContent = S.MODULOS.lluvia.clases[S.MODULOS.lluvia.clase(d)].texto;
    const dosCat = l.prob_normal === null || l.prob_normal === undefined;
    const cats = dosCat
      ? [[T("lluvia.mas"), l.prob_superior], [T("lluvia.menos"), l.prob_inferior]]
      : [[T("lluvia.mas"), l.prob_superior], [T("lluvia.normal"), l.prob_normal], [T("lluvia.menos"), l.prob_inferior]];
    const mayor = Math.max(...cats.map((c) => c[1]));
    // Las 51 simulaciones del modelo europeo, una por punto
    const puntos = $("lluvia-miembros");
    const leyendaPrevia = puntos.nextElementSibling;
    if (leyendaPrevia && leyendaPrevia.classList.contains("leyenda-miembros")) leyendaPrevia.remove();
    if (dosCat) {
      const total = 51, si = Math.round(l.prob_superior * total);
      puntos.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < si ? "si" : ""}"></i>`).join("");
      puntos.setAttribute("role", "img");
      puntos.setAttribute("aria-label", T("lluvia.puntos-aria", si, total));
      puntos.hidden = false;
      puntos.insertAdjacentHTML("afterend", `<p class="leyenda-miembros">${T("lluvia.puntos", si, total)}</p>`);
    } else {
      puntos.hidden = true;
    }
    const caja = $("lluvia-terciles");
    caja.style.gridTemplateColumns = `repeat(${cats.length}, minmax(0, 1fr))`;
    caja.innerHTML = cats.map(([t, v]) => `<div class="${v === mayor ? "destacado" : ""}">${t}<span>${S.pct(v)}</span></div>`).join("");
    caja.hidden = dosCat; // con dos categorías, los 51 puntos ya muestran la proporción
    const masMenos = (v) => T("lluvia.masmenos", v);
    const pron = typeof l.anom_pronostico_pct === "number" ? T("lluvia.pron", masMenos(l.anom_pronostico_pct)) : "";
    $("lluvia-texto").innerHTML = T("lluvia.texto", l.normal_mm, I.trimestreTexto(e), pron, masMenos(l.anom_nino_pct));

    // Caminos, dengue y calor
    $("caminos-nivel").innerHTML = nivelHTML("anegamiento", d, T("rot.caminos"));
    $("caminos-texto").textContent = textoCaminos(d.anegamiento.categoria);
    $("dengue-nivel").innerHTML = nivelHTML("dengue", d, T("rot.dengue"));
    $("calor-nivel").innerHTML = nivelHTML("calor", d, T("rot.calor"));

    // Agua observada
    const a = d.agua_obs;
    const hayPrevio = a.km2_mes_anterior !== null && a.km2_mes_anterior !== undefined;
    const dif = hayPrevio ? a.km2 - a.km2_mes_anterior : 0;
    const parecido = hayPrevio && Math.abs(dif) < Math.max(0.5, 0.1 * a.km2_mes_anterior);
    const comp = !hayPrevio ? "" : T(parecido ? "agua.parecido" : dif > 0 ? "agua.mas" : "agua.menos");
    $("agua-texto").innerHTML = T("agua.texto", S.fechaLarga(e.agua_obs.fecha_imagen), p.nombre, S.num(a.km2), comp);
    $("agua-km2").textContent = `${S.num(a.km2)} km²`;
    $("agua-caminos").textContent = a.km_caminos === null || a.km_caminos === undefined ? T("agua.sin-dato") : `${S.num(a.km_caminos)} km`;
    $("agua-cambio").textContent = !hayPrevio ? T("agua.sin-previo") : parecido ? T("agua.similar") : T("agua.cambio", dif > 0, S.num(Math.abs(dif)));

    mapa.seleccionar(id);
    S.guardarPreferido(id);
    const url = new URL(location.href);
    url.searchParams.set("d", id);
    history.replaceState(null, "", url);
    if (desplazar) {
      // desde el buscador o la ubicación: se muestra en el mapa, con su ficha emergente
      abrirEmergente(id);
      $("mapa-contenedor").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // Ficha emergente del departamento, sobre el mapa
  let emergente = null;
  function htmlEmergente(id) {
    const p = datos.porId[id], d = datos.emision.departamentos[id];
    const M = S.MODULOS;
    const fila = (modulo, rotulo, valor, extra) => {
      const m = M[modulo], c = m.clases[m.clase(d)];
      return `<li class="${modulo === tabActiva ? "activo" : ""}"><i style="background:${c.color}"></i>` +
        `<span><small>${rotulo}</small><b>${valor || c.texto}</b>${extra ? `<em>${extra}</em>` : ""}</span></li>`;
    };
    const l = d.lluvia;
    const anom = typeof l.anom_pronostico_pct === "number" ? T("pop.lluvia-anom", T("lluvia.masmenos", l.anom_pronostico_pct)) : "";
    const a = d.agua_obs;
    return `<div class="pop"><div class="pop-cab"><strong>${p.nombre}</strong><span>${T("pop.alrededores", p.cabecera)}</span></div>` +
      `<ul class="pop-lista">` +
      fila("lluvia", T("pop.lluvia"), null, anom) +
      fila("anegamiento", T("pop.caminos")) +
      fila("dengue", T("pop.dengue")) +
      fila("calor", T("pop.calor")) +
      fila("agua", T("pop.agua"), `${S.num(a.km2)} km²`) +
      `</ul><div class="pop-pie"><button type="button" data-ficha>${T("pop.ficha")}</button></div></div>`;
  }
  function abrirEmergente(id, lngLat) {
    const m = mapa.mapa;
    const lugar = lngLat || datos.porId[id].centro;
    if (emergente) emergente.remove();
    emergente = new maplibregl.Popup({ className: "pop-depto", maxWidth: "320px", offset: 10, focusAfterOpen: false })
      .setLngLat(lugar).setHTML(htmlEmergente(id)).addTo(m);
    mapa.tooltip(false);
    emergente.on("close", () => { mapa.tooltip(true); emergente = null; });
    emergente.getElement().querySelector("[data-ficha]").addEventListener("click", () => $("resumen").scrollIntoView({ behavior: "smooth", block: "start" }));
    emergente.idDepto = id;
    requestAnimationFrame(() => ajustarEmergente());
  }
  // si la ficha emergente no entra en el mapa, se corre el mapa lo justo para que se vea entera
  function ajustarEmergente() {
    if (!emergente) return;
    const r = emergente.getElement().getBoundingClientRect(), c = $("mapa-contenedor").getBoundingClientRect();
    let dx = 0, dy = 0;
    if (r.bottom > c.bottom - 10) dy = r.bottom - c.bottom + 14;
    if (r.top - dy < c.top + 10) dy = r.top - c.top - 14;
    if (r.right > c.right - 10) dx = r.right - c.right + 14;
    if (r.left - dx < c.left + 10) dx = r.left - c.left - 14;
    if (dx || dy) mapa.mapa.panBy([dx, dy], { duration: 350 });
  }
  // tocar un departamento: actualiza la ficha y abre la ficha emergente
  function reengancharEmergente() {
    emergente.getElement().querySelector("[data-ficha]").addEventListener("click", () => $("resumen").scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function alTocar(id, lngLat) {
    mostrarZona(id);
    abrirEmergente(id, lngLat);
  }

  function pintarMapa() {
    const m = S.MODULOS[tabActiva];
    const colores = {};
    Object.entries(datos.emision.departamentos).forEach(([id, d]) => { colores[id] = m.clases[m.clase(d)].color; });
    mapa.colorear(colores);
    $("leyenda").innerHTML = `<h3>${m.leyendaTitulo}</h3>` +
      m.clases.slice().reverse().map((c) => `<div class="leyenda-item"><span class="leyenda-color" style="background:${c.color}"></span>${c.texto}</div>`).join("") +
      `<p>${T("mapa.ayuda")} <span class="etiqueta-demo">${T("demo.datos")}</span></p>`;
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      const sel = b.dataset.tab === tabActiva;
      b.setAttribute("aria-selected", sel);
      b.tabIndex = sel ? 0 : -1;
    });
  }

  function rotularTabs() {
    document.querySelectorAll("#tabs .tab").forEach((b) => { b.textContent = S.MODULOS[b.dataset.tab].nombre; });
  }

  function armarTabs() {
    $("tabs").innerHTML = ORDEN_TABS.map((k) => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-controls="mapa-contenedor">${S.MODULOS[k].nombre}</button>`).join("");
    $("tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (b) { tabActiva = b.dataset.tab; pintarMapa(); if (emergente) emergente.setHTML(htmlEmergente(emergente.idDepto)), reengancharEmergente(); }
    });
    $("tabs").addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const i = ORDEN_TABS.indexOf(tabActiva) + (e.key === "ArrowRight" ? 1 : -1);
      tabActiva = ORDEN_TABS[(i + ORDEN_TABS.length) % ORDEN_TABS.length];
      pintarMapa();
      document.querySelector(`#tabs [data-tab="${tabActiva}"]`).focus();
    });
    document.querySelectorAll("a[data-tab]").forEach((a) => a.addEventListener("click", () => { tabActiva = a.dataset.tab; pintarMapa(); }));
  }

  function armarBuscador() {
    const input = $("buscar"), lista = $("sugerencias");
    let resultados = [], marcado = -1;

    const cerrar = () => { lista.hidden = true; input.setAttribute("aria-expanded", "false"); marcado = -1; };
    const elegir = (r) => { input.value = r.valor; cerrar(); $("mensaje").textContent = ""; mostrarZona(r.depto, { desplazar: true }); };
    const dibujar = () => {
      lista.innerHTML = resultados.map((r, i) => `<li role="option" id="op-${i}" aria-selected="${i === marcado}"><span>${r.texto}</span><small>${r.sub}</small></li>`).join("");
      lista.hidden = !resultados.length;
      input.setAttribute("aria-expanded", String(!!resultados.length));
      if (marcado >= 0) input.setAttribute("aria-activedescendant", "op-" + marcado); else input.removeAttribute("aria-activedescendant");
    };

    input.addEventListener("input", () => { resultados = S.buscar(indice, input.value); marcado = -1; dibujar(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" && resultados.length) { marcado = (marcado + 1) % resultados.length; dibujar(); e.preventDefault(); }
      else if (e.key === "ArrowUp" && resultados.length) { marcado = (marcado - 1 + resultados.length) % resultados.length; dibujar(); e.preventDefault(); }
      else if (e.key === "Escape") cerrar();
    });
    lista.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li");
      if (li) { e.preventDefault(); elegir(resultados[Number(li.id.slice(3))]); }
    });
    input.addEventListener("blur", () => setTimeout(cerrar, 100));
    $("buscador").addEventListener("submit", (e) => {
      e.preventDefault();
      const r = marcado >= 0 ? resultados[marcado] : S.buscar(indice, input.value, 1)[0];
      if (r) elegir(r);
      else $("mensaje").textContent = T(input.value.trim() ? "buscar.no-encontrado" : "buscar.vacio");
    });

    $("ubicacion").addEventListener("click", () => {
      if (!navigator.geolocation) { $("mensaje").textContent = T("ubic.no-soportada"); return; }
      $("mensaje").textContent = T("ubic.buscando");
      navigator.geolocation.getCurrentPosition((pos) => {
        const id = S.deptoEnPunto(datos, pos.coords.longitude, pos.coords.latitude);
        if (id) { $("mensaje").textContent = T("ubic.encontrada", datos.porId[id].nombre); mostrarZona(id, { desplazar: true }); }
        else $("mensaje").textContent = T("ubic.fuera");
      }, () => { $("mensaje").textContent = T("ubic.error"); }, { timeout: 10000, maximumAge: 600000 });
    });
  }

  function armarCompartir() {
    $("compartir").addEventListener("click", async () => {
      const p = datos.porId[actual], d = datos.emision.departamentos[actual];
      const url = location.href;
      const texto = T("compartir.texto", p.cabecera, p.nombre, I.trimestreTexto(datos.emision),
        S.MODULOS.lluvia.clases[S.MODULOS.lluvia.clase(d)].texto.toLowerCase(),
        S.MODULOS.anegamiento.clases[d.anegamiento.categoria - 1].texto.toLowerCase()) + " " +
        T(datos.emision.demo ? "compartir.demo" : "compartir.real");
      if (navigator.share) {
        try { await navigator.share({ title: "El Niño Argentina", text: texto, url }); } catch (e) { /* cancelado */ }
      } else {
        window.open("https://wa.me/?text=" + encodeURIComponent(texto + " " + url), "_blank", "noopener");
      }
    });
  }

  // Textos que dependen de la emisión y del idioma
  function textosGenerales() {
    const e = datos.emision;
    document.querySelectorAll(".js-trimestre").forEach((n) => { n.textContent = I.trimestreTexto(e); });
    $("franja-emision").textContent = T("franja", S.mesLargo(e.emision + "-01"), S.mesLargo(e.proxima_emision + "-01"));
  }

  async function iniciar() {
    $("titulo-zona").textContent = T("cargando");
    try {
      datos = await S.cargarDatos();
    } catch (err) { S.mostrarError(err); return; }
    const e = datos.emision;
    textosGenerales();
    indice = S.indiceBusqueda(datos);
    mapa = S.crearMapa("mapa-contenedor", datos, alTocar);
    armarTabs();
    armarBuscador();
    armarCompartir();
    await mapa.listo;
    pintarMapa();
    const pedido = new URLSearchParams(location.search).get("d");
    const inicial = [pedido, S.leerPreferido(), POR_DEFECTO].find((x) => x && e.departamentos[x]);
    mostrarZona(inicial);

    document.addEventListener("idioma", () => {
      textosGenerales();
      indice = S.indiceBusqueda(datos);
      $("mensaje").textContent = "";
      rotularTabs();
      pintarMapa();
      if (actual) mostrarZona(actual);
      if (emergente) { emergente.setHTML(htmlEmergente(emergente.idDepto)); reengancharEmergente(); }
    });
  }

  S.registrarSW();
  iniciar();
})();
