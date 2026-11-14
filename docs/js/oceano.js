/* "El Niño de este año": curva del ONI actual sobre los Niños de 1997-98 y 2015-16. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const I = window.I18N, T = I.T;
  const W = 640, H = 320, M = { izq: 44, der: 86, arr: 16, aba: 34 };
  const Y0 = -0.5, Y1 = 3.0;
  const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toLocaleString(I.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " °C";

  function el(tag, attrs, padre, texto) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (texto !== undefined) n.textContent = texto;
    if (padre) padre.appendChild(n);
    return n;
  }

  function dibujar(svg, datos) {
    const n = datos.ventana.length;
    const x = (i) => M.izq + (i / (n - 1)) * (W - M.izq - M.der);
    const y = (v) => M.arr + ((Y1 - v) / (Y1 - Y0)) * (H - M.arr - M.aba);
    const camino = (vals) => vals.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean)
      .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

    const eje = el("g", { class: "oni-eje" }, svg);
    [0, 1, 2, 3].forEach((v) => {
      el("line", { x1: M.izq, x2: W - M.der, y1: y(v), y2: y(v) }, eje);
      el("text", { x: M.izq - 8, y: y(v) + 4, "text-anchor": "end" }, eje, v === 0 ? "0 °C" : "+" + v);
    });
    [0, 3, 6, 9, 12].forEach((i) => el("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, eje, I.abrev(datos.ventana[i])));

    el("line", { class: "oni-umbral", x1: M.izq, x2: W - M.der, y1: y(0.5), y2: y(0.5) }, svg);
    el("text", { x: W - M.der + 6, y: y(0.5) + 4, fill: "#A9B8C7", "font-size": 12 }, svg, T("oni.umbral"));

    const refs = datos.episodios.filter((e) => !e.actual);
    // Etiquetas al final de cada curva, separadas si quedan muy cerca
    const ult = n - 1;
    const pos = refs.map((e) => y(e.valores[ult]) + 4).sort((a, b) => a - b);
    for (let k = 1; k < pos.length; k++) if (pos[k] - pos[k - 1] < 16) pos[k] = pos[k - 1] + 16;
    const orden = refs.map((e, k) => [k, y(e.valores[ult])]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
    refs.forEach((e, k) => {
      const color = k === 0 ? "var(--referencia)" : "var(--referencia-2)";
      el("path", { class: "oni-ref", d: camino(e.valores), stroke: color }, svg);
      el("text", { class: "oni-etiqueta", x: x(ult) + 6, y: pos[orden.indexOf(k)], fill: color }, svg, e.nombre);
    });

    const act = datos.episodios.find((e) => e.actual);
    const linea = el("path", { class: "oni-actual", d: camino(act.valores) }, svg);
    const largo = linea.getTotalLength();
    linea.style.strokeDasharray = largo;
    linea.style.strokeDashoffset = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : largo;
    linea.classList.add("dibujar");

    const i = act.valores.map((v) => v !== null).lastIndexOf(true);
    const px = x(i), py = y(act.valores[i]);
    el("circle", { class: "oni-pulso", cx: px, cy: py, r: 6 }, svg);
    el("circle", { class: "oni-punto", cx: px, cy: py, r: 6 }, svg);
    const hoy = el("g", { class: "oni-hoy" }, svg);
    el("text", { x: px, y: py - 18, "text-anchor": "middle", fill: "#fff", "font-size": 15, "font-weight": 600 }, hoy, T("oni.hoy") + " " + fmt(act.valores[i]));
    el("text", { x: px, y: py + 28, "text-anchor": "middle", fill: "#F3B3A3", "font-size": 12 }, hoy, act.nombre);
  }

  function texto(datos) {
    const act = datos.episodios.find((e) => e.actual);
    const i = act.valores.map((v) => v !== null).lastIndexOf(true);
    const v = act.valores[i];
    const comp = datos.episodios.filter((e) => !e.actual).map((e) => {
      const r = e.valores[i];
      const pico = Math.max(...e.valores.filter((x) => x !== null));
      return { nombre: e.nombre, r, pico };
    });
    const supera = comp.filter((c) => v > c.r).map((c) => c.nombre);
    const [m1, m2] = datos.ultimo.meses.split("–").map(I.mesDeAbrev);
    const partes = [T("oni.promedio", m1, m2, datos.ultimo.anio)];
    if (supera.length === comp.length) partes.push(T("oni.supera-todos", supera));
    else if (supera.length) partes.push(T("oni.supera-algunos", supera));
    else partes.push(T("oni.comparable"));
    return { valor: fmt(v), parrafo: partes.join(" ") };
  }

  async function iniciar() {
    const caja = document.getElementById("oceano");
    if (!caja) return;
    let datos;
    try {
      const r = await fetch("data/oni.json", { cache: "no-cache" });
      if (!r.ok) return;
      datos = await r.json();
    } catch (e) { return; } // sin datos del océano, la sección queda oculta
    const mostrar = () => {
      const t = texto(datos);
      document.getElementById("oni-valor").textContent = t.valor;
      document.getElementById("oni-texto").textContent = t.parrafo;
      document.getElementById("oni-desc").textContent = T("oni.desc", datos.episodios[0].nombre, t.valor, datos.episodios.slice(1).map((e) => e.nombre));
      const svg = document.getElementById("grafico-oni");
      [...svg.children].forEach((n) => { if (n.id !== "oni-desc") n.remove(); });
      dibujar(svg, datos);
    };
    caja.hidden = false;
    mostrar();
    document.addEventListener("idioma", mostrar);
  }

  iniciar();
})();
