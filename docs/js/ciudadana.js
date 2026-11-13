/* Vista ciudadana: ficha de la zona elegida y mapa por tema. */
(function () {
  "use strict";
  const S = window.SIG;
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
    if (cat >= 4) return "Los caminos de tierra en zonas bajas suelen quedar intransitables después de lluvias fuertes. Es una de las zonas más expuestas de la provincia.";
    if (cat === 3) return "Algunos caminos de tierra pueden cortarse después de lluvias fuertes, sobre todo en zonas bajas.";
    return "La posibilidad de cortes es menor que en otras zonas de la provincia, aunque una lluvia fuerte siempre puede afectar los caminos de tierra.";
  }

  function mostrarZona(id, { desplazar = false } = {}) {
    if (!datos.emision.departamentos[id]) return;
    actual = id;
    const p = datos.porId[id];
    const d = datos.emision.departamentos[id];
    const e = datos.emision;

    $("titulo-zona").textContent = `${p.cabecera} y alrededores (${p.nombre}, Chaco)`;
    $("linea-nino").innerHTML = `Hay <strong>${S.pct(e.prob_nino)} de probabilidad</strong> de que este verano haya El Niño <span class="etiqueta-demo">dato de ejemplo</span>. En esta zona, eso suele significar más lluvia de lo normal.`;

    // Lluvia
    const l = d.lluvia;
    $("lluvia-titular").textContent = S.MODULOS.lluvia.clases[S.MODULOS.lluvia.clase(d)].texto;
    const mayor = Math.max(l.prob_superior, l.prob_normal, l.prob_inferior);
    $("lluvia-terciles").innerHTML = [
      ["Más de lo normal", l.prob_superior], ["Normal", l.prob_normal], ["Menos de lo normal", l.prob_inferior],
    ].map(([t, v]) => `<div class="${v === mayor ? "destacado" : ""}">${t}<span>${S.pct(v)}</span></div>`).join("");
    const signo = l.anom_nino_pct >= 0 ? `${l.anom_nino_pct} % más` : `${-l.anom_nino_pct} % menos`;
    $("lluvia-texto").innerHTML = `Lo normal en esta zona son unos <strong>${l.normal_mm} mm</strong> de ${e.trimestre_texto}. En los veranos con El Niño de años anteriores llovió en promedio <strong>${signo}</strong>.`;

    // Caminos, dengue y calor
    $("caminos-nivel").innerHTML = nivelHTML("anegamiento", d, "Posibilidad de cortes por agua");
    $("caminos-texto").textContent = textoCaminos(d.anegamiento.categoria);
    $("dengue-nivel").innerHTML = nivelHTML("dengue", d, "Condiciones para el mosquito");
    $("calor-nivel").innerHTML = nivelHTML("calor", d, "Calor húmedo y noches pesadas");

    // Agua observada
    const a = d.agua_obs;
    const hayPrevio = a.km2_mes_anterior !== null && a.km2_mes_anterior !== undefined;
    const dif = hayPrevio ? a.km2 - a.km2_mes_anterior : 0;
    const parecido = hayPrevio && Math.abs(dif) < Math.max(0.5, 0.1 * a.km2_mes_anterior);
    const comp = !hayPrevio ? "" : parecido ? ", parecido al mes pasado" : dif > 0 ? ", más que el mes pasado" : ", menos que el mes pasado";
    $("agua-texto").innerHTML = `Según la imagen satelital del <strong>${S.fechaLarga(e.agua_obs.fecha_imagen)}</strong>, en el departamento ${p.nombre} hay unos <strong>${S.num(a.km2)} km²</strong> de campos y caminos con agua fuera de lo habitual${comp}.`;
    $("agua-km2").textContent = `${S.num(a.km2)} km²`;
    $("agua-caminos").textContent = a.km_caminos === null || a.km_caminos === undefined ? "Sin dato aún" : `${S.num(a.km_caminos)} km`;
    $("agua-cambio").textContent = !hayPrevio ? "Sin dato del mes pasado" : parecido ? "Parecido" : `${dif > 0 ? "Más" : "Menos"} agua (${dif > 0 ? "+" : "−"}${S.num(Math.abs(dif))} km²)`;

    mapa.seleccionar(id);
    S.guardarPreferido(id);
    const url = new URL(location.href);
    url.searchParams.set("d", id);
    history.replaceState(null, "", url);
    if (desplazar) $("resumen").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pintarMapa() {
    const m = S.MODULOS[tabActiva];
    const colores = {};
    Object.entries(datos.emision.departamentos).forEach(([id, d]) => { colores[id] = m.clases[m.clase(d)].color; });
    mapa.colorear(colores);
    $("leyenda").innerHTML = `<h3>${m.leyendaTitulo}</h3>` +
      m.clases.slice().reverse().map((c) => `<div class="leyenda-item"><span class="leyenda-color" style="background:${c.color}"></span>${c.texto}</div>`).join("") +
      `<p>Tocá un departamento para ver su ficha. Es una tendencia para toda la temporada, no el pronóstico de un día. <span class="etiqueta-demo">Datos de ejemplo</span></p>`;
    document.querySelectorAll("#tabs .tab").forEach((b) => {
      const sel = b.dataset.tab === tabActiva;
      b.setAttribute("aria-selected", sel);
      b.tabIndex = sel ? 0 : -1;
    });
  }

  function armarTabs() {
    $("tabs").innerHTML = ORDEN_TABS.map((k) => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-controls="mapa-contenedor">${S.MODULOS[k].nombre}</button>`).join("");
    $("tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (b) { tabActiva = b.dataset.tab; pintarMapa(); }
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
    const elegir = (r) => { input.value = r.texto.replace(/^Departamento /, ""); cerrar(); $("mensaje").textContent = ""; mostrarZona(r.depto, { desplazar: true }); };
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
      else $("mensaje").textContent = input.value.trim() ? "No encontramos esa localidad en Chaco. Probá con el nombre del departamento o usá tu ubicación." : "Escribí el nombre de tu localidad.";
    });

    $("ubicacion").addEventListener("click", () => {
      if (!navigator.geolocation) { $("mensaje").textContent = "Tu navegador no permite usar la ubicación."; return; }
      $("mensaje").textContent = "Buscando tu ubicación…";
      navigator.geolocation.getCurrentPosition((pos) => {
        const id = S.deptoEnPunto(datos, pos.coords.longitude, pos.coords.latitude);
        if (id) { $("mensaje").textContent = `Estás en el departamento ${datos.porId[id].nombre}.`; mostrarZona(id, { desplazar: true }); }
        else $("mensaje").textContent = "Tu ubicación está fuera de Chaco. Por ahora el sitio cubre solo esta provincia; buscá una localidad.";
      }, () => { $("mensaje").textContent = "No pudimos obtener tu ubicación. Podés buscar tu localidad por nombre."; }, { timeout: 10000, maximumAge: 600000 });
    });
  }

  function armarCompartir() {
    $("compartir").addEventListener("click", async () => {
      const p = datos.porId[actual], d = datos.emision.departamentos[actual];
      const url = location.href;
      const texto = `El Niño en ${p.cabecera} (${p.nombre}, Chaco), ${datos.emision.trimestre_texto}: ` +
        `${S.MODULOS.lluvia.clases[S.MODULOS.lluvia.clase(d)].texto.toLowerCase()}; ` +
        `posibilidad de cortes de caminos ${S.MODULOS.anegamiento.clases[d.anegamiento.categoria - 1].texto.toLowerCase()}. ` +
        (datos.emision.demo ? "(Versión de demostración, datos de ejemplo)" : "(Riesgo relativo, no es una alerta oficial)");
      if (navigator.share) {
        try { await navigator.share({ title: "SIG El Niño Argentina", text: texto, url }); } catch (e) { /* cancelado */ }
      } else {
        window.open("https://wa.me/?text=" + encodeURIComponent(texto + " " + url), "_blank", "noopener");
      }
    });
  }

  async function iniciar() {
    try {
      datos = await S.cargarDatos();
    } catch (err) { S.mostrarError(err); return; }
    const e = datos.emision;
    document.querySelectorAll(".js-trimestre").forEach((n) => { n.textContent = e.trimestre_texto; });
    $("franja-emision").textContent = `Información de ${S.mesLargo(e.emision + "-01")} · Próxima actualización: ${S.mesLargo(e.proxima_emision + "-01")}`;
    indice = S.indiceBusqueda(datos);
    mapa = S.crearMapa("mapa-contenedor", datos, (id) => mostrarZona(id, { desplazar: true }));
    armarTabs();
    armarBuscador();
    armarCompartir();
    await mapa.listo;
    pintarMapa();
    const pedido = new URLSearchParams(location.search).get("d");
    const inicial = [pedido, S.leerPreferido(), POR_DEFECTO].find((x) => x && e.departamentos[x]);
    mostrarZona(inicial);
  }

  S.registrarSW();
  iniciar();
})();
