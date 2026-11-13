/* Vista técnica: capas continuas, desglose del índice, ranking y descargas. */
(function () {
  "use strict";
  const S = window.SIG;
  const $ = (id) => document.getElementById(id);

  // Capas disponibles por módulo. "valor" devuelve el número a mapear.
  const CAPAS = {
    anegamiento: [
      { id: "cat", nombre: "Categoría (quintiles de R)", categorica: true },
      { id: "R", nombre: "Índice R", valor: (d) => d.anegamiento.R, rampa: "riesgo", dec: 2 },
      { id: "H", nombre: "Amenaza H", valor: (d) => d.anegamiento.H, rampa: "riesgo", dec: 2 },
      { id: "E", nombre: "Exposición E", valor: (d) => d.anegamiento.E, rampa: "riesgo", dec: 2 },
      { id: "V", nombre: "Vulnerabilidad V", valor: (d) => d.anegamiento.V, rampa: "riesgo", dec: 2 },
      { id: "bosque", nombre: "Pérdida de bosque nativo (%)", valor: (d) => d.anegamiento.perdida_bosque_pct, rampa: "riesgo", dec: 1 },
      { id: "agua", nombre: "Agua observada (km²)", valor: (d) => d.agua_obs.km2, rampa: "azul", dec: 1 },
    ],
    lluvia: [
      { id: "sup", nombre: "P(lluvia superior a lo normal)", valor: (d) => d.lluvia.prob_superior, rampa: "azul", dec: 2 },
      { id: "anom", nombre: "Anomalía histórica en años Niño (%)", valor: (d) => d.lluvia.anom_nino_pct, rampa: "azul", dec: 0 },
      { id: "mm", nombre: "Lluvia normal del trimestre (mm)", valor: (d) => d.lluvia.normal_mm, rampa: "azul", dec: 0 },
    ],
    dengue: [
      { id: "cat", nombre: "Categoría (quintiles)", categorica: true },
      { id: "ind", nombre: "Índice de condiciones", valor: (d) => d.dengue.indice, rampa: "riesgo", dec: 2 },
    ],
    calor: [
      { id: "cat", nombre: "Categoría (quintiles)", categorica: true },
      { id: "ind", nombre: "Índice de estrés térmico", valor: (d) => d.calor.indice, rampa: "riesgo", dec: 2 },
    ],
  };
  const NOMBRES_MOD = { anegamiento: "Anegamiento y caminos", lluvia: "Lluvia", dengue: "Dengue", calor: "Calor" };
  const MODULOS_TARJETA = [
    { id: "anegamiento", nombre: "Anegamiento y caminos", nota: "Confianza alta · Piloto" },
    { id: "dengue", nombre: "Dengue", nota: "Confianza media · Piloto" },
    { id: "calor", nombre: "Calor", nota: "Señal a verificar · Piloto" },
    { id: "lluvia", nombre: "Lluvia", nota: "Pronóstico estacional" },
    { id: null, nombre: "Crecidas de ríos", nota: "Próximamente · Fase NEA" },
    { id: null, nombre: "Incendios", nota: "Próximamente · Fase La Niña" },
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
    $("leyenda").innerHTML = `<h3>${c.nombre}</h3>${leyenda}<p>${c.categorica ? "Clases por quintiles: 5 departamentos por clase." : "Cinco intervalos iguales entre el mínimo y el máximo del área."} <span class="etiqueta-demo">Demo</span></p>`;
    $("titulo-mapa").textContent = `${NOMBRES_MOD[modulo]} · ${c.nombre} · ${datos.emision.trimestre}`;
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
    $("titulo-desglose").textContent = `Desglose · ${p.nombre}, Chaco`;
    $("desglose-id").textContent = `id_depto ${depto} · cabecera ${p.cabecera}`;
    const a = d.anegamiento;
    $("desglose-formula").innerHTML =
      `<p class="rotulo">Anegamiento y caminos</p><table class="tabla"><thead><tr><th>Variable</th><th>Fuente prevista</th><th class="num">Valor</th></tr></thead><tbody>` +
      fila("P(Niño)", "IRI / CPC", S.num(datos.emision.prob_nino, 2)) +
      fila("H amenaza", "ERA5, CHIRPS, C3S", S.num(a.H, 2)) +
      fila("E exposición", "IGN, OSM, INDEC", S.num(a.E, 2)) +
      fila("V vulnerabilidad", "OSM, DEM, MapBiomas", S.num(a.V, 2)) +
      fila("&nbsp;&nbsp;incl. pérdida de bosque", "2004–2024", S.num(a.perdida_bosque_pct, 1) + " %") +
      `<tr style="border-top:2px solid var(--texto)"><td><strong>R índice</strong></td><td>Quintil ${a.categoria}</td><td class="num"><strong>${S.num(a.R, 2)}</strong></td></tr>` +
      `</tbody></table><p class="mono" style="margin:8px 0 0;font-size:12px;color:var(--texto-4)">w₁ = ${w.w1} · w₂ = ${w.w2} · w₃ = ${w.w3} · media geométrica</p>`;
    const l = d.lluvia;
    $("desglose-extra").innerHTML =
      `<p class="rotulo">Otros módulos</p><table class="tabla"><thead><tr><th>Variable</th><th>Fuente prevista</th><th class="num">Valor</th></tr></thead><tbody>` +
      fila("P(lluvia sup. / normal / inf.)", "Copernicus C3S", `${S.num(l.prob_superior, 2)} / ${S.num(l.prob_normal, 2)} / ${S.num(l.prob_inferior, 2)}`) +
      fila("Lluvia normal del trimestre", "CHIRPS 1991–2020", l.normal_mm + " mm") +
      fila("Anomalía media en años Niño", "Composites ERA5 / CHIRPS", (l.anom_nino_pct > 0 ? "+" : "") + l.anom_nino_pct + " %") +
      fila("Dengue, índice", "ERA5, INDEC", `${S.num(d.dengue.indice, 2)}<br><small style="font-family:'IBM Plex Sans',sans-serif;color:var(--texto-3)">${chip("dengue", d)}</small>`) +
      fila("Calor, índice", "ERA5, SMN", `${S.num(d.calor.indice, 2)}<br><small style="font-family:'IBM Plex Sans',sans-serif;color:var(--texto-3)">${chip("calor", d)}</small>`) +
      `</tbody></table>`;

    const o = d.agua_obs, e = datos.emision.agua_obs, dif = o.km2 - o.km2_mes_anterior;
    $("agua-meta").textContent = `${e.sensor} · ${e.fecha_imagen} · umbral ${S.num(e.umbral_db, 1)} dB`;
    $("agua-metricas").innerHTML =
      `<div><small>Anegado fuera de lo habitual</small><strong>${S.num(o.km2)} km²</strong></div>` +
      `<div><small>Variación vs. mes anterior</small><strong>${dif >= 0 ? "+" : "−"}${S.num(Math.abs(dif))} km²</strong></div>` +
      `<div><small>Caminos en zona anegada</small><strong>${S.num(o.km_caminos)} km</strong></div>` +
      `<div><small>Riesgo pronosticado</small><strong style="font-family:inherit;font-size:15px;font-weight:600">${chip("anegamiento", d)}</strong></div>`;

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
    const enc = ["id_depto", "departamento", "cabecera", "R", "H", "E", "V", "categoria_caminos", "perdida_bosque_pct", "prob_lluvia_sup", "prob_lluvia_normal", "prob_lluvia_inf", "lluvia_normal_mm", "anom_nino_pct", "dengue_indice", "dengue_categoria", "calor_indice", "calor_categoria", "agua_obs_km2", "agua_obs_km2_mes_ant", "km_caminos_anegados"];
    const lineas = [enc.join(",")];
    Object.entries(datos.emision.departamentos).forEach(([id, d]) => {
      const p = datos.porId[id], a = d.anegamiento, l = d.lluvia, o = d.agua_obs;
      lineas.push([id, `"${p.nombre}"`, `"${p.cabecera}"`, a.R, a.H, a.E, a.V, a.categoria, a.perdida_bosque_pct, l.prob_superior, l.prob_normal, l.prob_inferior, l.normal_mm, l.anom_nino_pct, d.dengue.indice, d.dengue.categoria, d.calor.indice, d.calor.categoria, o.km2, o.km2_mes_anterior, o.km_caminos].join(","));
    });
    const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `riesgo_chaco_${datos.emision.emision}${datos.emision.demo ? "_demo" : ""}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function armar() {
    const e = datos.emision;
    $("meta").textContent = `Emisión ${e.emision} · ${e.trimestre} · P(Niño) ${S.num(e.prob_nino, 2)}${e.demo ? " · DEMO" : ""}`;
    $("opt-trimestre").textContent = e.trimestre;
    $("metodo-texto").textContent = `Normalización ${e.metodo.normalizacion}; categorías por ${e.metodo.categorias}.`;
    $("sel-depto").innerHTML = datos.deptos.features.slice().sort((a, b) => a.properties.nombre.localeCompare(b.properties.nombre, "es"))
      .map((f) => `<option value="${f.id}">${f.properties.nombre}</option>`).join("");
    $("modulos").innerHTML = MODULOS_TARJETA.map((m) => m.id
      ? `<button type="button" class="modulo" data-mod="${m.id}" aria-pressed="false"><strong>${m.nombre}</strong><small>${m.nota}</small></button>`
      : `<button type="button" class="modulo" disabled><strong>${m.nombre}</strong><small>${m.nota}</small></button>`).join("");
    $("descargas").innerHTML = [
      ["Emisión completa (todos los módulos)", "JSON", "data/" + `emision-${e.emision}.json`],
      ["Límites departamentales de Chaco", "GeoJSON", "data/departamentos.geojson"],
      ["Localidades para búsqueda", "JSON", "data/localidades.json"],
    ].map(([n, f, h]) => `<tr><td>${n}${e.demo && h.includes("emision") ? ' <span class="etiqueta-demo">Demo</span>' : ""}</td><td class="mono">${f}</td><td><a href="${h}" download>${h.split("/").pop()}</a></td></tr>`).join("") +
      `<tr><td>Indicadores por departamento</td><td class="mono">CSV</td><td><a href="#" id="link-csv">riesgo_chaco_${e.emision}.csv</a></td></tr>`;

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
    $("link-csv").addEventListener("click", (ev) => { ev.preventDefault(); csv(); });
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
  }

  S.registrarSW();
  iniciar();
})();
