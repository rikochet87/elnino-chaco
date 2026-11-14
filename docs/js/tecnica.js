/* Vista técnica: capas continuas, desglose del índice, ranking y descargas. */
(function () {
  "use strict";
  const S = window.SIG;
  const $ = (id) => document.getElementById(id);

  const I = window.I18N, T = I.T;
  // Capa con nombre según el idioma activo
  const c = (id, clave, extra = {}) => Object.assign({ id, get nombre() { return T(clave); } }, extra);

  // Capas disponibles por módulo. "valor" devuelve el número a mapear.
  const CAPAS = {
    anegamiento: [
      c("cat", "capa.cat-R", { categorica: true }),
      c("R", "capa.R", { valor: (d) => d.anegamiento.R, rampa: "riesgo", dec: 2 }),
      c("H", "capa.H", { valor: (d) => d.anegamiento.H, rampa: "riesgo", dec: 2 }),
      c("E", "capa.E", { valor: (d) => d.anegamiento.E, rampa: "riesgo", dec: 2 }),
      c("V", "capa.V", { valor: (d) => d.anegamiento.V, rampa: "riesgo", dec: 2 }),
      c("bosque", "capa.bosque", { valor: (d) => d.anegamiento.perdida_bosque_pct, rampa: "riesgo", dec: 1 }),
      c("agua", "capa.agua", { valor: (d) => d.agua_obs.km2, rampa: "azul", dec: 1 }),
    ],
    lluvia: [
      c("sup", "capa.sup", { valor: (d) => d.lluvia.prob_superior, rampa: "azul", dec: 2 }),
      c("anompron", "capa.anompron", { valor: (d) => d.lluvia.anom_pronostico_pct ?? 0, rampa: "azul", dec: 0 }),
      c("anom", "capa.anom", { valor: (d) => d.lluvia.anom_nino_pct, rampa: "azul", dec: 0 }),
      c("mm", "capa.mm", { valor: (d) => d.lluvia.normal_mm, rampa: "azul", dec: 0 }),
    ],
    dengue: [
      c("cat", "capa.cat", { categorica: true }),
      c("ind", "capa.ind-dengue", { valor: (d) => d.dengue.indice, rampa: "riesgo", dec: 2 }),
    ],
    calor: [
      c("cat", "capa.cat", { categorica: true }),
      c("ind", "capa.ind-calor", { valor: (d) => d.calor.indice, rampa: "riesgo", dec: 2 }),
    ],
  };
  const MODULOS_TARJETA = [
    { id: "anegamiento", nota: "nota.alta" },
    { id: "dengue", nota: "nota.media" },
    { id: "calor", nota: "nota.verificar" },
    { id: "lluvia", nota: null, notaFija: "ECMWF SEAS5 · Open-Meteo" },
    { id: null, nombre: "tmod.crecidas", nota: "nota.nea" },
    { id: null, nombre: "tmod.incendios", nota: "nota.nina" },
  ];

  let datos, mapa, modulo = "anegamiento", capa = "cat", depto = "san-fernando", orden = { campo: "R", desc: true };

  function capaActual() { return CAPAS[modulo].find((c) => c.id === capa) || CAPAS[modulo][0]; }

  function pintar() {
    const c = capaActual();
    const deps = datos.emision.departamentos;
    const colores = {};
    let leyenda = "";
    if (c.categorica) {
      const m = S.MODULOS[modulo];
      Object.entries(deps).forEach(([id, d]) => { colores[id] = m.clases[m.clase(d)].color; });
      leyenda = m.clases.slice().reverse().map((k) => `<div class="leyenda-item"><span class="leyenda-color" style="background:${k.color}"></span>${k.texto}</div>`).join("");
    } else {
      const vals = Object.values(deps).map(c.valor);
      const lo = Math.min(...vals), hi = Math.max(...vals), paso = (hi - lo) / 5 || 1;
      const rampa = c.rampa === "azul" ? S.AZULES : S.RIESGO;
      Object.entries(deps).forEach(([id, d]) => { colores[id] = rampa[Math.min(4, Math.floor((c.valor(d) - lo) / paso))]; });
      leyenda = [4, 3, 2, 1, 0].map((i) => `<div class="leyenda-item"><span class="leyenda-color" style="background:${rampa[i]}"></span><span class="mono" style="font-size:13px">${S.num(lo + i * paso, c.dec)} – ${S.num(lo + (i + 1) * paso, c.dec)}</span></div>`).join("");
    }
    mapa.colorear(colores);
    $("leyenda").innerHTML = `<h3>${c.nombre}</h3>${leyenda}<p>${T(c.categorica ? "ley.quintiles" : "ley.intervalos")} <span class="etiqueta-demo">Demo</span></p>`;
    $("titulo-mapa").textContent = `${T("tmod." + modulo)} · ${c.nombre} · ${I.trimestre(datos.emision)}`;
  }

  function armarCapas() {
    if (!CAPAS[modulo].some((c) => c.id === capa)) capa = CAPAS[modulo][0].id;
    $("capas").innerHTML = CAPAS[modulo].map((c) => `<label class="opcion"><input type="radio" name="capa" value="${c.id}" ${c.id === capa ? "checked" : ""}>${c.nombre}</label>`).join("");
    document.querySelectorAll("#modulos .modulo").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mod === modulo)));
    $("sel-modulo").value = modulo;
  }

  const chip = (modulo, d) => { const m = S.MODULOS[modulo], k = m.clases[m.clase(d)]; return `<span class="chip"><i style="background:${k.color}"></i>${k.texto}</span>`; };
  const fila = (a, b, c, extra = "") => `<tr${extra}><td>${a}</td><td>${b}</td><td class="num">${c}</td></tr>`;

  function desglose() {
    const p = datos.porId[depto], d = datos.emision.departamentos[depto], w = datos.emision.metodo.pesos;
    $("titulo-desglose").textContent = T("des.titulo", p.nombre);
    $("desglose-id").textContent = T("des.id", depto, p.cabecera);
    const cab = `<thead><tr><th>${T("des.variable")}</th><th>${T("des.fuente")}</th><th class="num">${T("des.valor")}</th></tr></thead>`;
    const a = d.anegamiento;
    $("desglose-formula").innerHTML =
      `<p class="rotulo">${T("tmod.anegamiento")}</p><table class="tabla">${cab}<tbody>` +
      fila("P(Niño)", "IRI / CPC", S.num(datos.emision.prob_nino, 2)) +
      fila(T("des.H"), "CHIRPS, ONI, ECMWF SEAS5", S.num(a.H, 2)) +
      fila(T("des.E"), T("des.E-fuente"), S.num(a.E, 2)) +
      fila(T("des.V"), T("des.V-fuente"), S.num(a.V, 2)) +
      fila("&nbsp;&nbsp;" + T("des.bosque"), "Hansen GFC 2004–2023", S.num(a.perdida_bosque_pct, 1) + " %") +
      `<tr style="border-top:2px solid var(--texto)"><td><strong>${T("des.R")}</strong></td><td>${T("des.quintil", a.categoria)}</td><td class="num"><strong>${S.num(a.R, 2)}</strong></td></tr>` +
      `</tbody></table><p class="mono" style="margin:8px 0 0;font-size:12px;color:var(--texto-4)">w₁ = ${w.w1} · w₂ = ${w.w2} · w₃ = ${w.w3} · ${T("des.media")}</p>`;
    const l = d.lluvia;
    $("desglose-extra").innerHTML =
      `<p class="rotulo">${T("des.otros")}</p><table class="tabla">${cab}<tbody>` +
      (l.prob_normal === null || l.prob_normal === undefined
        ? fila(T("des.p2"), "ECMWF SEAS5 · Open-Meteo", `${S.num(l.prob_superior, 2)} / ${S.num(l.prob_inferior, 2)}`)
        : fila(T("des.p3"), "Copernicus C3S", `${S.num(l.prob_superior, 2)} / ${S.num(l.prob_normal, 2)} / ${S.num(l.prob_inferior, 2)}`)) +
      (typeof l.anom_pronostico_pct === "number" ? fila(T("des.anompron"), T("des.miembros"), (l.anom_pronostico_pct > 0 ? "+" : "") + l.anom_pronostico_pct + " %") : "") +
      fila(T("des.normal"), "CHIRPS 1991–2020", l.normal_mm + " mm") +
      fila(T("des.anom"), "CHIRPS, ONI (NOAA)", (l.anom_nino_pct > 0 ? "+" : "") + l.anom_nino_pct + " %") +
      fila(T("des.dengue"), "ERA5-Land, WorldPop", `${S.num(d.dengue.indice, 2)}<br><small style="font-family:'IBM Plex Sans',sans-serif;color:var(--texto-3)">${chip("dengue", d)}</small>`) +
      fila(T("des.calor"), "ERA5-Land, WorldPop", `${S.num(d.calor.indice, 2)}<br><small style="font-family:'IBM Plex Sans',sans-serif;color:var(--texto-3)">${chip("calor", d)}</small>`) +
      `</tbody></table>`;

    const o = d.agua_obs, e = datos.emision.agua_obs;
    const dif = o.km2_mes_anterior === null || o.km2_mes_anterior === undefined ? null : o.km2 - o.km2_mes_anterior;
    $("agua-meta").textContent = T("agua.meta", e.sensor, e.fecha_imagen, S.num(e.umbral_db, 1));
    $("agua-metricas").innerHTML =
      `<div><small>${T("met.anegado")}</small><strong>${S.num(o.km2)} km²</strong></div>` +
      `<div><small>${T("met.variacion")}</small><strong>${dif === null ? "—" : (dif >= 0 ? "+" : "−") + S.num(Math.abs(dif)) + " km²"}</strong></div>` +
      `<div><small>${T("met.caminos")}</small><strong>${o.km_caminos === null || o.km_caminos === undefined ? T("met.sin-dato") : S.num(o.km_caminos) + " km"}</strong></div>` +
      `<div><small>${T("met.riesgo")}</small><strong style="font-family:inherit;font-size:15px;font-weight:600">${chip("anegamiento", d)}</strong></div>`;

    $("sel-depto").value = depto;
    mapa.seleccionar(depto);
    tabla();
  }

  function filasTabla() {
    return Object.entries(datos.emision.departamentos).map(([id, d]) => ({
      id, nombre: datos.porId[id].nombre, R: d.anegamiento.R, cat: d.anegamiento.categoria, sup: d.lluvia.prob_superior,
      dengue: d.dengue.categoria, calor: d.calor.categoria, agua: d.agua_obs.km2, bosque: d.anegamiento.perdida_bosque_pct, d,
    }));
  }

  function tabla() {
    const filas = filasTabla().sort((a, b) => {
      const x = a[orden.campo], y = b[orden.campo];
      const r = typeof x === "string" ? x.localeCompare(y, "es") : x - y;
      return orden.desc ? -r : r;
    });
    document.querySelector("#ranking tbody").innerHTML = filas.map((f) =>
      `<tr data-id="${f.id}" class="${f.id === depto ? "sel" : ""}" tabindex="0"><td>${f.nombre}</td><td class="num">${S.num(f.R, 2)}</td><td>${chip("anegamiento", f.d)}</td>` +
      `<td class="num">${S.num(f.sup, 2)}</td><td>${chip("dengue", f.d)}</td><td>${chip("calor", f.d)}</td><td class="num">${S.num(f.agua)}</td><td class="num">${S.num(f.bosque)} %</td></tr>`).join("");
    document.querySelectorAll("#ranking th").forEach((th) => {
      const b = th.querySelector("button");
      th.setAttribute("aria-sort", b.dataset.orden === orden.campo ? (orden.desc ? "descending" : "ascending") : "none");
    });
  }

  function csv() {
    const enc = ["id_depto", "departamento", "cabecera", "R", "H", "E", "V", "categoria_caminos", "perdida_bosque_pct", "prob_lluvia_sup", "prob_lluvia_normal", "prob_lluvia_inf", "anom_pronostico_pct", "lluvia_normal_mm", "anom_nino_pct", "dengue_indice", "dengue_categoria", "calor_indice", "calor_categoria", "agua_obs_km2", "agua_obs_km2_mes_ant", "km_caminos_anegados"];
    const lineas = [enc.join(",")];
    Object.entries(datos.emision.departamentos).forEach(([id, d]) => {
      const p = datos.porId[id], a = d.anegamiento, l = d.lluvia, o = d.agua_obs;
      lineas.push([id, `"${p.nombre}"`, `"${p.cabecera}"`, a.R, a.H, a.E, a.V, a.categoria, a.perdida_bosque_pct, l.prob_superior, l.prob_normal ?? "", l.prob_inferior, l.anom_pronostico_pct ?? "", l.normal_mm, l.anom_nino_pct, d.dengue.indice, d.dengue.categoria, d.calor.indice, d.calor.categoria, o.km2, o.km2_mes_anterior, o.km_caminos].join(","));
    });
    const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `riesgo_chaco_${datos.emision.emision}${datos.emision.demo ? "_demo" : ""}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Textos que dependen del idioma
  function textos() {
    const e = datos.emision;
    $("meta").textContent = T("meta", e.emision, I.trimestre(e), S.num(e.prob_nino, 2)) + (e.demo ? " · DEMO" : "");
    $("opt-trimestre").textContent = I.trimestre(e);
    $("metodo-texto").textContent = T("metodo", e);
    $("modulos").innerHTML = MODULOS_TARJETA.map((m) => {
      const nombre = T(m.id ? "tmod." + m.id : m.nombre), nota = m.nota ? T(m.nota) : m.notaFija;
      return m.id
        ? `<button type="button" class="modulo" data-mod="${m.id}" aria-pressed="${m.id === modulo}"><strong>${nombre}</strong><small>${nota}</small></button>`
        : `<button type="button" class="modulo" disabled><strong>${nombre}</strong><small>${nota}</small></button>`;
    }).join("");
    $("descargas").innerHTML = [
      [T("desc.emision"), "JSON", "data/" + `emision-${e.emision}.json`],
      [T("desc.limites"), "GeoJSON", "data/departamentos.geojson"],
      [T("desc.localidades"), "JSON", "data/localidades.json"],
    ].map(([n, f, h]) => `<tr><td>${n}${e.demo && h.includes("emision") ? ' <span class="etiqueta-demo">Demo</span>' : ""}</td><td class="mono">${f}</td><td><a href="${h}" download>${h.split("/").pop()}</a></td></tr>`).join("") +
      `<tr><td>${T("desc.indicadores")}</td><td class="mono">CSV</td><td><a href="#" id="link-csv">riesgo_chaco_${e.emision}.csv</a></td></tr>`;
  }

  function armar() {
    textos();
    $("sel-depto").innerHTML = datos.deptos.features.slice().sort((a, b) => a.properties.nombre.localeCompare(b.properties.nombre, "es"))
      .map((f) => `<option value="${f.id}">${f.properties.nombre}</option>`).join("");
    $("modulos").addEventListener("click", (ev) => { const b = ev.target.closest(".modulo:not([disabled])"); if (b) { modulo = b.dataset.mod; armarCapas(); pintar(); } });
    $("sel-modulo").addEventListener("change", (ev) => { modulo = ev.target.value; armarCapas(); pintar(); });
    $("capas").addEventListener("change", (ev) => { capa = ev.target.value; pintar(); });
    $("sel-depto").addEventListener("change", (ev) => { depto = ev.target.value; desglose(); });
    document.querySelector("#ranking thead").addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      orden = { campo: b.dataset.orden, desc: b.dataset.orden === orden.campo ? !orden.desc : b.dataset.orden !== "nombre" };
      tabla();
    });
    const elegirFila = (tr) => { if (tr) { depto = tr.dataset.id; desglose(); } };
    document.querySelector("#ranking tbody").addEventListener("click", (ev) => elegirFila(ev.target.closest("tr")));
    document.querySelector("#ranking tbody").addEventListener("keydown", (ev) => { if (ev.key === "Enter") elegirFila(ev.target.closest("tr")); });
    $("bajar-csv").addEventListener("click", csv);
    $("descargas").addEventListener("click", (ev) => { if (ev.target.id === "link-csv") { ev.preventDefault(); csv(); } });
  }

  async function iniciar() {
    try { datos = await S.cargarDatos(); } catch (err) { S.mostrarError(err); return; }
    const pedido = new URLSearchParams(location.search).get("d") || S.leerPreferido();
    if (pedido && datos.emision.departamentos[pedido]) depto = pedido;
    mapa = S.crearMapa("mapa-contenedor", datos, (id) => { depto = id; desglose(); });
    armar();
    armarCapas();
    await mapa.listo;
    pintar();
    desglose();
    document.addEventListener("idioma", () => { textos(); armarCapas(); pintar(); desglose(); });
  }

  S.registrarSW();
  iniciar();
})();
