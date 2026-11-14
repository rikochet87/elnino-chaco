/* "Cómo llega El Niño a Chaco": globo 3D con datos reales, contado en pasos al bajar con el scroll.
 *
 * Capas:
 *  - temperatura del mar: anomalía diaria NOAA OISST (data/pacifico/*.png, gris = anomalía, 255 = tierra);
 *  - tormentas: partículas que suben donde el mar está más de 1 °C por encima de lo normal (ilustración
 *    ubicada con el dato real);
 *  - onda en altura: anomalía de altura geopotencial a 200 hPa en veranos Niño (data/atmosfera.json);
 *  - chorro subtropical: viento a 200 hPa en veranos Niño, coloreado por su anomalía;
 *  - chorro de capas bajas: flujo de humedad a 850 hPa en veranos Niño;
 *  - lluvia: anomalía de lluvia (GPCP) en veranos Niño; ríos de la cuenca del Plata y Chaco (data/globo.json).
 * Las alturas de las capas están exageradas para que se distingan.
 */
import * as THREE from "../vendor/three/three.module.min.js";
import { Navegacion, xyz } from "./navegacion.js";

const I = window.I18N, T = I.T;
const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180;
const REDUCIR = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOVIL = matchMedia("(max-width: 760px)").matches;
const POCOS = MOVIL || matchMedia("(pointer: coarse)").matches;
THREE.ColorManagement.enabled = false; // colores tal cual (sRGB) en toda la escena

// ---------------------------------------------------------------- utilidades
const suave = (t) => t * t * (3 - 2 * t);
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const lon360 = (lon) => ((lon % 360) + 360) % 360;

async function json(ruta) {
  const r = await fetch(ruta, { cache: "no-cache" });
  if (!r.ok) throw new Error(ruta + " " + r.status);
  return r.json();
}
const opcional = (p) => p.catch(() => null);

// Interpolación bilineal en una grilla regular {lat0, dlat, nlat, lon0, dlon, nlon} (lon 0–360 y vuelta completa)
function muestreador(g, arr) {
  return (lat, lon) => {
    const fi = (lat - g.lat0) / g.dlat;
    const i0 = Math.floor(fi);
    if (i0 < 0 || i0 + 1 >= g.nlat) return null;
    const fj = lon360(lon - g.lon0) / g.dlon;
    const j0 = Math.floor(fj) % g.nlon, j1 = (j0 + 1) % g.nlon;
    const a = arr[i0 * g.nlon + j0], b = arr[i0 * g.nlon + j1], c = arr[(i0 + 1) * g.nlon + j0], d = arr[(i0 + 1) * g.nlon + j1];
    if (a === null || b === null || c === null || d === null) return null;
    const x = fj - Math.floor(fj), y = fi - i0;
    return (a * (1 - x) + b * x) * (1 - y) + (c * (1 - x) + d * x) * y;
  };
}

// Textura equirectangular (norte arriba, lon −180…180) a partir de una función de color
function texturaCampo(ancho, alto, colorEn) {
  const c = document.createElement("canvas");
  c.width = ancho; c.height = alto;
  const g = c.getContext("2d");
  const img = g.createImageData(ancho, alto);
  for (let y = 0; y < alto; y++) {
    const lat = 90 - ((y + 0.5) / alto) * 180;
    for (let x = 0; x < ancho; x++) {
      const lon = -180 + ((x + 0.5) / ancho) * 360;
      const col = colorEn(lat, lon);
      if (!col) continue;
      const k = (y * ancho + x) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = col[3];
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

function puntoRedondo() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,.75)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- escenas
// Cámara (centro lat/lon y distancia) y opacidad de cada capa
const ESCENAS = {
  inicio:    { lat: 4,   lon: -145, dist: 4.4, capas: { sst: 1, chaco: 0.7 } },
  pacifico:  { lat: 0,   lon: -150, dist: 3.9, capas: { sst: 1, chaco: 0.5 } },
  tormentas: { lat: 10,  lon: -140, dist: 3.2, capas: { sst: 1, tormentas: 1, chaco: 0.5 } },
  onda:      { lat: -35, lon: -105, dist: 3.7, capas: { sst: 0.35, tormentas: 0.25, onda: 1, chorro: 1, chaco: 1 } },
  humedad:   { lat: -18, lon: -62,  dist: 2.5, capas: { sst: 0.2, chorro: 0.3, humedad: 1, chaco: 1 } },
  rios:      { lat: -24, lon: -56,  dist: 2.25, capas: { sst: 0.15, lluvia: 1, rios: 1, chaco: 1, humedad: 0.15 } },
  final:     { lat: -26, lon: -60,  dist: 2.1, capas: { sst: 0.15, lluvia: 0.45, rios: 0.8, chaco: 1 } },
};
const CAPAS = ["sst", "tormentas", "onda", "chorro", "humedad", "lluvia", "rios", "chaco"];

const ETIQUETAS = [
  { k: "g.et.pacifico", lat: 0, lon: -140, en: ["inicio", "pacifico", "tormentas"], capa: "sst" },
  { k: "g.et.peru", lat: -6, lon: -86, en: ["pacifico"], capa: "sst" },
  { k: "g.et.indonesia", lat: -4, lon: 128, en: ["pacifico"], capa: "sst" },
  { k: "g.et.tormentas", lat: 9, lon: -130, en: ["tormentas"], capa: "tormentas" },
  { k: "g.et.andes", lat: -17, lon: -70, en: ["tormentas", "humedad"] },
  { k: "g.et.onda", lat: -52, lon: -150, en: ["onda"], capa: "onda" },
  { k: "g.et.chorro", lat: -31, lon: -66, en: ["onda"], clase: "destacada", capa: "chorro" },
  { k: "g.et.amazonia", lat: -4, lon: -62, en: ["humedad"], clase: "humedad" },
  { k: "g.et.capas-bajas", lat: -16, lon: -61.5, en: ["humedad"], clase: "humedad", capa: "humedad" },
  { k: "g.et.chaco", lat: -26, lon: -60.6, en: ["onda", "humedad", "rios", "final"], clase: "destacada", capa: "chaco" },
  { k: "g.et.pantanal", lat: -18.5, lon: -56.5, en: ["rios"], capa: "rios" },
  { k: "g.et.cuenca-alta", lat: -21, lon: -49.5, en: ["rios"], capa: "rios" },
  { k: "g.et.paraguay", lat: -23, lon: -58.6, en: ["rios"], capa: "rios" },
  { k: "g.et.parana", lat: -25.2, lon: -54.2, en: ["rios"], capa: "rios" },
  { k: "g.et.corrientes", lat: -28.6, lon: -58.6, en: ["rios", "final"], capa: "rios" },
];

// ---------------------------------------------------------------- arranque
let estado = { escena: "inicio" };

async function iniciar() {
  registrarSW();
  observarCabecera();
  const [globo, pacifico, atm, emision] = await Promise.all([
    json("data/globo.json"),
    opcional(json("data/pacifico.json")),
    opcional(json("data/atmosfera.json")),
    opcional(json("data/emision-actual.json").then((a) => json("data/" + a.archivo))),
  ]);
  estado = { ...estado, globo, pacifico, atm, emision };
  textos();
  document.addEventListener("idioma", () => { textos(); leyenda(); etiquetasTexto(); actualizarFecha(); idiomaControles(); });

  let vista;
  try { vista = crearVista(); } catch (e) {
    console.error(e);
    $("sin-3d").hidden = false;
    observarPasos(() => {});
    return;
  }
  await vista.cargar();
  observarPasos((nombre) => { if (!vista.explorando()) { vista.irA(nombre); leyenda(); } });
  leyenda();
}

// Mientras la cabecera está a la vista, la leyenda del celular se oculta para no taparla
function observarCabecera() {
  const cab = document.querySelector(".cabecera");
  if (!cab || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => document.body.classList.toggle("cabecera-visible", e.isIntersecting)).observe(cab);
}

function registrarSW() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
}

function observarPasos(alCambiar) {
  const pasos = [...document.querySelectorAll(".g-paso")];
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting && estado.escena !== e.target.dataset.escena) {
        estado.escena = e.target.dataset.escena;
        alCambiar(estado.escena);
      }
    });
  }, { rootMargin: MOVIL ? "-62% 0px -30% 0px" : "-45% 0px -45% 0px" }); // en el celular, la franja de lectura está debajo del globo
  pasos.forEach((p) => obs.observe(p));
}

// ---------------------------------------------------------------- textos con datos
const fmtNum = (v, d = 1) => v.toLocaleString(I.locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const signo = (v, d = 1, u = " °C") => (v >= 0 ? "+" : "−") + fmtNum(Math.abs(v), d) + u;

function promedioCaja(g, arr, lat1, lat2, lon1, lon2) {
  const f = muestreador(g, arr);
  let s = 0, n = 0;
  for (let la = lat1; la <= lat2; la += 1) for (let lo = lon1; lo <= lon2; lo += 1) {
    const v = f(la, lo);
    if (v !== null) { s += v; n++; }
  }
  return n ? s / n : null;
}

function textos() {
  const { pacifico, atm, emision } = estado;
  if (pacifico) {
    $("dato-nino34").textContent = T("g.dato-nino34", signo(pacifico.nino34), pacifico.nino34 >= 0, I.fechaLarga(pacifico.ultimo));
  }
  if (atm) {
    const a = atm.anios_nino;
    $("dato-anios").textContent = T("g.dato-anios", a.length, a[0], a[a.length - 1]);
    const ll = atm.lluvia_sep_feb || atm.lluvia;
    const region = promedioCaja(ll.grilla, ll.anom_pct, -32, -25, -60, -49);
    const amazonia = promedioCaja(ll.grilla, ll.anom_pct, -10, 0, -65, -50);
    if (region !== null) $("dato-lluvia").textContent = T("g.dato-lluvia", Math.round(region), a.length, Math.round(amazonia ?? 0));
  }
  if (emision) {
    const vals = Object.values(emision.departamentos).map((d) => d.lluvia.anom_pronostico_pct).filter((v) => typeof v === "number");
    if (vals.length) {
      const pct = (v) => (v >= 0 ? "+" : "−") + Math.abs(Math.round(v)) + (I.idioma === "en" ? "%" : " %");
      $("dato-pronostico").textContent = T("g.dato-pronostico", I.trimestreTexto(emision), pct(Math.min(...vals)), pct(Math.max(...vals)), I.pct(emision.prob_nino));
    }
  }
}

// Leyenda según el paso
const BARRA_SST = "linear-gradient(90deg,#2166AC,#67A9CF,#D1E5F0,#16304A,#FDDBC7,#EF8A62,#B2182B,#67001F)";
const BARRA_LLUVIA = "linear-gradient(90deg,#8C510A,#D8B365,rgba(0,0,0,0),#7FB2E5,#2B6CB0)";
let capasEncendidas = null; // en modo explorar: { sst: true, ... }
function leyenda() {
  if (capasEncendidas) return leyendaExplorar();
  const e = estado.escena;
  const sst = `<div class="g-grupo"><h3>${T("g.ley.sst")}</h3><div class="g-barra" style="background:${BARRA_SST}"></div>` +
    `<div class="g-barra-rotulos"><span>${signo(-3, 0)}</span><span>0</span><span>${signo(3, 0)}</span></div></div>`;
  const chaco = `<div class="g-item"><i style="background:#F2A541"></i>${T("g.ley.chaco")}</div>`;
  let html = "";
  if (["inicio", "pacifico"].includes(e)) html = sst;
  else if (e === "tormentas") html = sst + `<div class="g-grupo"><div class="g-item"><i class="punto" style="background:#fff"></i>${T("g.ley.tormentas")}</div></div>`;
  else if (e === "onda") html = `<div class="g-grupo"><h3>${T("g.ley.chorro")}</h3>` +
    `<div class="g-item"><i style="background:#F2A541"></i>${T("g.ley.chorro-mas")}</div>` +
    `<div class="g-item"><i style="background:#D9E2EA"></i>${T("g.ley.chorro-igual")}</div>` +
    `<div class="g-item"><i style="background:#7C9CC0"></i>${T("g.ley.chorro-menos")}</div></div>` +
    `<div class="g-grupo"><h3>${T("g.ley.onda")}</h3><div class="g-item"><i class="punto" style="background:#E0614A"></i>${T("g.ley.alta")}</div>` +
    `<div class="g-item"><i class="punto" style="background:#4C8DD6"></i>${T("g.ley.baja")}</div></div>`;
  else if (e === "humedad") html = `<div class="g-grupo"><h3>${T("g.ley.humedad")}</h3>` +
    `<div class="g-item"><i style="background:#5FD3C6"></i>${T("g.ley.humedad-flujo")}</div>` +
    `<div class="g-item"><i style="background:#F2A541;opacity:.6"></i>${T("g.ley.chorro-alto")}</div>${chaco}</div>`;
  else if (e === "rios" || e === "final") html = `<div class="g-grupo"><h3>${T("g.ley.lluvia")}</h3><div class="g-barra" style="background:${BARRA_LLUVIA}"></div>` +
    `<div class="g-barra-rotulos"><span>−50${I.idioma === "en" ? "%" : " %"}</span><span>0</span><span>+50${I.idioma === "en" ? "%" : " %"}</span></div></div>` +
    `<div class="g-grupo"><div class="g-item"><i style="background:#9FD3FF"></i>${T("g.ley.rios")}</div>${chaco}</div>`;
  $("leyenda").innerHTML = html;
}

function leyendaExplorar() {
  const c = capasEncendidas, pc = I.idioma === "en" ? "%" : " %";
  let html = "";
  if (c.sst) html += `<div class="g-grupo"><h3>${T("g.ley.sst")}</h3><div class="g-barra" style="background:${BARRA_SST}"></div>` +
    `<div class="g-barra-rotulos"><span>${signo(-3, 0)}</span><span>0</span><span>${signo(3, 0)}</span></div></div>`;
  if (c.lluvia) html += `<div class="g-grupo"><h3>${T("g.ley.lluvia")}</h3><div class="g-barra" style="background:${BARRA_LLUVIA}"></div>` +
    `<div class="g-barra-rotulos"><span>−50${pc}</span><span>0</span><span>+50${pc}</span></div></div>`;
  const items = [];
  if (c.chorro) items.push(`<div class="g-item"><i style="background:#F2A541"></i>${T("g.ley.chorro-mas")} (${T("g.capa.chorro")})</div>`);
  if (c.onda) items.push(`<div class="g-item"><i class="punto" style="background:#E0614A"></i>${T("g.ley.alta")}</div><div class="g-item"><i class="punto" style="background:#4C8DD6"></i>${T("g.ley.baja")}</div>`);
  if (c.humedad) items.push(`<div class="g-item"><i style="background:#5FD3C6"></i>${T("g.ley.humedad-flujo")}</div>`);
  if (c.rios) items.push(`<div class="g-item"><i style="background:#9FD3FF"></i>${T("g.ley.rios")}</div>`);
  if (items.length) html += `<div class="g-grupo">${items.join("")}</div>`;
  $("leyenda").innerHTML = html;
}

// ---------------------------------------------------------------- vista 3D
let etiquetasTexto = () => {};
let actualizarFecha = () => {};
let idiomaControles = () => {};

function crearVista() {
  const canvas = $("globo");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !POCOS, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, POCOS ? 1.5 : 2));
  renderer.setClearColor(0x08131f, 1);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const { globo, pacifico, atm } = estado;
  const opac = Object.fromEntries(CAPAS.map((c) => [c, 0]));
  const objetivo = { ...opac };
  const reloj = new THREE.Clock();

  // --- Globo base: tierra dibujada en un canvas equirectangular
  function texturaBase() {
    const W = POCOS ? 2048 : 4096, H = W / 2;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#0C2135"; g.fillRect(0, 0, W, H);
    const p = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
    const poligono = (anillo) => { g.beginPath(); anillo.forEach(([lo, la], i) => { const [x, y] = p(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    g.fillStyle = "#22374A"; g.strokeStyle = "#3D5A74"; g.lineWidth = W / 4096;
    globo.tierra.forEach((a) => { poligono(a); g.fill(); g.stroke(); });
    globo.tierra_sa.forEach((a) => { poligono(a); g.fill(); g.stroke(); });
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  const uGlobo = {
    uBase: { value: texturaBase() },
    uSstA: { value: null }, uSstB: { value: null }, uMezcla: { value: 0 },
    uSst: { value: 0 }, uHaySst: { value: 0 },
    uSatTex: { value: null }, uSat: { value: 0 },
  };
  const matGlobo = new THREE.ShaderMaterial({
    uniforms: uGlobo,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN;
      void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uBase, uSstA, uSstB, uSatTex; uniform float uMezcla, uSst, uHaySst, uSat;
      varying vec2 vUv; varying vec3 vN;
      // Bilineal manual que ignora tierra/hielo (255) para no inventar valores en la costa
      vec2 anom(sampler2D t, vec2 uv) {
        vec2 st = uv * vec2(360.0, 180.0) - 0.5; vec2 i0 = floor(st); vec2 f = st - i0;
        float s = 0.0, w = 0.0;
        for (int dy = 0; dy < 2; dy++) for (int dx = 0; dx < 2; dx++) {
          vec2 c = (i0 + vec2(float(dx), float(dy)) + 0.5) / vec2(360.0, 180.0);
          c.x = fract(c.x); c.y = clamp(c.y, 0.0, 1.0);
          float g = texture2D(t, c).r * 255.0;
          float ok = step(g, 254.5);
          float k = (dx == 0 ? 1.0 - f.x : f.x) * (dy == 0 ? 1.0 - f.y : f.y) * ok;
          s += k * (g / 254.0 * 10.0 - 5.0); w += k;
        }
        return vec2(w > 0.0 ? s / w : 0.0, w);
      }
      vec3 rampa(float a) {
        float t = clamp(a / 3.0, -1.0, 1.0);
        if (t >= 0.0) {
          vec3 c = mix(vec3(0.99, 0.86, 0.78), vec3(0.94, 0.54, 0.38), smoothstep(0.0, 0.45, t));
          c = mix(c, vec3(0.70, 0.09, 0.17), smoothstep(0.45, 0.8, t));
          return mix(c, vec3(0.40, 0.0, 0.12), smoothstep(0.8, 1.0, t) * smoothstep(3.0, 4.5, a));
        }
        vec3 c = mix(vec3(0.82, 0.90, 0.94), vec3(0.40, 0.66, 0.81), smoothstep(0.0, 0.45, -t));
        return mix(c, vec3(0.13, 0.40, 0.67), smoothstep(0.45, 1.0, -t));
      }
      void main() {
        vec3 base = texture2D(uBase, vUv).rgb;
        if (uSat > 0.001) base = mix(base, texture2D(uSatTex, vUv).rgb * 0.92, uSat);
        if (uHaySst > 0.5 && uSst > 0.001) {
          vec2 uvS = vec2(fract(vUv.x + 0.5), vUv.y);
          vec2 a = anom(uSstA, uvS), b = anom(uSstB, uvS);
          float w = mix(a.y, b.y, uMezcla);
          float v = mix(a.x, b.x, uMezcla);
          float al = smoothstep(0.5, 1.8, abs(v)) * smoothstep(0.15, 0.6, w) * uSst * 0.92;
          base = mix(base, rampa(v), al);
        }
        float luz = 0.62 + 0.38 * max(dot(normalize(vN), vec3(0.0, 0.25, 1.0)), 0.0);
        gl_FragColor = vec4(base * luz, 1.0);
      }`,
  });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 96), matGlobo);
  escena.add(esfera);

  // Halo de la atmósfera
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vN; void main() { float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0, 0.0, -1.0))), 3.0); gl_FragColor = vec4(0.30, 0.55, 0.85, 1.0) * i * 0.9; }`,
  }));
  escena.add(halo);

  // Capas en cáscaras (texturas equirectangulares de los campos de atmosfera.json)
  function cascara(radio, textura) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radio, 128, 64),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, opacity: 0 }));
    escena.add(m);
    return m;
  }

  let onda = null, lluvia = null, chorro = null, humedad = null, tormentas = null;
  if (atm) {
    const g = atm.grilla;
    const z = muestreador(g, atm.z200_anom);
    onda = cascara(1.045, texturaCampo(360, 180, (lat, lon) => {
      const v = z(lat, lon);
      if (v === null) return null;
      const a = lim((Math.abs(v) - 15) / 70, 0, 1);
      if (a <= 0) return null;
      return v > 0 ? [224, 97, 74, Math.round(a * 150)] : [76, 141, 214, Math.round(a * 150)];
    }));
    const LL = atm.lluvia_sep_feb || atm.lluvia;
    const ll = muestreador(LL.grilla, LL.anom_pct);
    // Solo sobre Sudamérica, con borde suave: es la región del relato
    const borde = (lat, lon) => lim((lat + 48) / 6, 0, 1) * lim((8 - lat) / 6, 0, 1) * lim((lon + 86) / 6, 0, 1) * lim((-30 - lon) / 6, 0, 1);
    lluvia = cascara(1.004, texturaCampo(720, 360, (lat, lon) => {
      const b = borde(lat, lon);
      if (b <= 0) return null;
      const v = ll(lat, lon);
      if (v === null) return null;
      const a = lim((Math.abs(v) - 3) / 20, 0, 1) * b;
      if (a <= 0) return null;
      return v > 0 ? [70, 140, 225, Math.round(a * 200)] : [176, 120, 46, Math.round(a * 190)];
    }));

    const vel = muestreador(g, atm.vel200_anom);
    chorro = new Estelas({
      u: muestreador(g, atm.u200), v: muestreador(g, atm.v200), n: POCOS ? 1400 : 3200, radio: 1.07, largo: 12,
      escala: 0.42, dominio: { latN: 28, latS: -68, lonO: -180, lonE: 180 }, vida: [2.5, 5],
      color: (lat, lon) => {
        const a = vel(lat, lon) ?? 0;
        if (a > 1.2) { const k = lim((a - 1.2) / 3, 0, 1); return [0.95, 0.62 + 0.15 * (1 - k), 0.25, 0.65 + 0.35 * k]; }
        if (a < -1.2) return [0.49, 0.61, 0.75, 0.5];
        return [0.85, 0.89, 0.92, 0.28];
      },
    });
    escena.add(chorro.lineas);

    const qu = muestreador(g, atm.qu850), qv = muestreador(g, atm.qv850);
    humedad = new Estelas({
      u: qu, v: qv, n: POCOS ? 1100 : 2600, radio: 1.014, largo: 14, escala: 0.11,
      dominio: { latN: 12, latS: -42, lonO: -82, lonE: -34 }, vida: [2.5, 5],
      peso: (lat, lon) => { const a = qu(lat, lon), b = qv(lat, lon); return a === null ? 0 : Math.hypot(a, b); },
      color: (lat, lon) => {
        const m = Math.hypot(qu(lat, lon) ?? 0, qv(lat, lon) ?? 0);
        return [0.37, 0.83, 0.78, lim(0.2 + m / 120, 0.2, 0.95)];
      },
    });
    escena.add(humedad.lineas);
  }

  // Ríos de la cuenca del Plata y flujo aguas abajo
  const grupoRios = new THREE.Group();
  const matRio = new THREE.LineBasicMaterial({ color: 0x6fb6e8, transparent: true, opacity: 0 });
  const tramos = globo.rios.map((r) => {
    const pts = r.c.map(([lo, la]) => xyz(la, lo, 1.0011));
    grupoRios.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matRio));
    const largos = [0];
    for (let i = 1; i < pts.length; i++) largos.push(largos[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, largos, total: largos[largos.length - 1], peso: (r.rango <= 4 ? 3 : 1) };
  }).filter((t) => t.total > 0);
  const flujo = crearFlujo(tramos, POCOS ? 450 : 900);
  grupoRios.add(flujo.puntos);
  escena.add(grupoRios);

  // Chaco: contorno y punto en Resistencia
  const matChaco = new THREE.LineBasicMaterial({ color: 0xf2a541, transparent: true, opacity: 0 });
  globo.chaco.forEach((anillo) => {
    escena.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(anillo.map(([lo, la]) => xyz(la, lo, 1.001))), matChaco));
  });
  const matPulso = new THREE.PointsMaterial({ color: 0xf2a541, size: 0.05, map: puntoRedondo(), transparent: true, depthWrite: false, opacity: 0 });
  const pulso = new THREE.Points(new THREE.BufferGeometry().setFromPoints([xyz(-27.45, -58.99, 1.0015)]), matPulso);
  escena.add(pulso);

  // --- Temperatura del mar: cuadros semanales + último día
  const cuadros = [];
  let cuadroActual = 0, reproduciendo = !REDUCIR, tCuadro = 0;
  async function cargarSst() {
    if (!pacifico) return;
    const cargador = new THREE.TextureLoader();
    const lista = pacifico.cuadros;
    const texturas = await Promise.all(lista.map((f) => cargador.loadAsync(`data/pacifico/${f}.png`).catch(() => null)));
    lista.forEach((f, i) => {
      const t = texturas[i];
      if (!t) return;
      t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
      cuadros.push({ fecha: f, t });
    });
    if (!cuadros.length) return;
    cuadroActual = cuadros.length - 1;
    uGlobo.uSstA.value = uGlobo.uSstB.value = cuadros[cuadroActual].t;
    uGlobo.uHaySst.value = 1;
    tormentas = crearTormentas(cuadros[cuadros.length - 1].t.image, POCOS ? 600 : 1200);
    escena.add(tormentas.puntos);
    const rango = $("semana");
    rango.max = String(cuadros.length - 1);
    rango.value = String(cuadroActual);
    $("tiempo").hidden = false;
    rango.addEventListener("input", () => { pausar(); cuadroActual = Number(rango.value); tCuadro = 0; mostrarCuadro(); });
    $("reproducir").addEventListener("click", () => (reproduciendo ? pausar() : reanudar()));
    if (REDUCIR) pausar();
    mostrarCuadro();
  }
  function pausar() { reproduciendo = false; botonReproducir(); }
  function reanudar() { reproduciendo = true; if (cuadroActual >= cuadros.length - 1) cuadroActual = 0; botonReproducir(); }
  function botonReproducir() {
    const b = $("reproducir");
    b.setAttribute("aria-pressed", String(reproduciendo));
    b.textContent = T(reproduciendo ? "g.pausar" : "g.reproducir");
  }
  function mostrarCuadro() {
    if (!cuadros.length) return;
    const sig = Math.min(cuadroActual + 1, cuadros.length - 1);
    uGlobo.uSstA.value = cuadros[cuadroActual].t;
    uGlobo.uSstB.value = cuadros[sig].t;
    $("semana").value = String(cuadroActual);
    actualizarFecha();
  }
  actualizarFecha = () => {
    if (!cuadros.length) return;
    const f = cuadros[cuadroActual].fecha;
    $("fecha-cuadro").textContent = cuadroActual === cuadros.length - 1 ? T("g.ultimo-dato", I.fechaLarga(f)) : T("g.semana-de", I.fechaLarga(f));
    botonReproducir();
  };

  // --- Etiquetas HTML
  const capaEt = $("etiquetas");
  const etiquetas = ETIQUETAS.map((e) => {
    const el = document.createElement("span");
    el.className = "g-etiqueta" + (e.clase ? " " + e.clase : "");
    capaEt.appendChild(el);
    return { ...e, el, pos: xyz(e.lat, e.lon, 1.01) };
  });
  // Prioridad al dibujar: primero las destacadas (Chaco, chorro), después el resto en orden
  const porPrioridad = [...etiquetas].sort((a, b) => (b.clase === "destacada") - (a.clase === "destacada"));
  const medir = () => etiquetas.forEach((e) => { e.w = e.el.offsetWidth; e.h = e.el.offsetHeight; });
  etiquetasTexto = () => { etiquetas.forEach((e) => { e.el.textContent = T(e.k); }); medir(); };
  etiquetasTexto();
  document.fonts?.ready.then(medir);

  // --- Detalle de Sudamérica (costas, países, provincias y departamentos de Chaco), nítido al acercarse
  let detalle = null, cargandoDetalle = false;
  async function cargarDetalle() {
    if (detalle || cargandoDetalle) return;
    cargandoDetalle = true;
    const d = await json("data/detalle_sa.json").catch(() => null);
    if (!d) return;
    // Líneas vectoriales (no una imagen): se ven nítidas a cualquier zoom
    const grupo = new THREE.Group();
    const capa = (lineas, color, opacidad, radio) => {
      const pts = [];
      lineas.forEach((ln) => {
        for (let i = 1; i < ln.length; i++) {
          pts.push(xyz(ln[i - 1][1], ln[i - 1][0], radio), xyz(ln[i][1], ln[i][0], radio));
        }
      });
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, opacity: 0 });
      mat.userData.max = opacidad;
      grupo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
    };
    capa(d.provincias, 0xb0c4d6, 0.5, 1.0005);
    capa(d.costa, 0x96c4eb, 0.85, 1.0006);
    capa(d.paises, 0xe8eef4, 0.9, 1.0007);
    capa(d.departamentos_chaco, 0xf2a541, 0.75, 1.0008);
    detalle = grupo;
    escena.add(detalle);
  }

  // --- Imagen satelital (NASA Blue Marble), se descarga solo si se pide
  let satObjetivo = 0, satCargando = false;
  async function alternarSatelite() {
    if (satCargando) return;
    if (!uGlobo.uSatTex.value) {
      satCargando = true;
      $("ctl-satelite").classList.add("cargando");
      try {
        const t = await new THREE.TextureLoader().loadAsync(`data/imagen/tierra-${POCOS ? 2048 : 4096}.jpg`);
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        uGlobo.uSatTex.value = t;
      } catch (e) {
        aviso(T("g.sat-no"));
        return;
      } finally {
        satCargando = false;
        $("ctl-satelite").classList.remove("cargando");
      }
      cargarDetalle();
    }
    satObjetivo = satObjetivo ? 0 : 1;
    botonSatelite();
  }
  function botonSatelite() {
    const b = $("ctl-satelite");
    b.setAttribute("aria-pressed", String(!!satObjetivo));
    b.textContent = T("g.sat");
    b.title = T(satObjetivo ? "g.mapa-titulo" : "g.sat-titulo");
  }
  let temporizadorAviso;
  function aviso(texto) {
    const a = $("aviso");
    a.textContent = texto; a.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { a.hidden = true; }, 4000);
  }

  // --- Cámara y navegación (arrastrar, zoom, girar, inclinar)
  const nav = new Navegacion({ camara, elemento: canvas, reducir: REDUCIR });
  if (location.search.includes("depurar")) window.__globo = { escena, camara, renderer, nav };
  let interactuado = false, explorando = false;
  nav.alInteractuar = () => { interactuado = true; };
  // En pantallas angostas (celular vertical) la cámara se aleja para que entre el globo de lado a lado
  const factorDist = () => lim(1.3 / (canvas.clientWidth / canvas.clientHeight), 1, 2.6);
  // Las vistas de todo el globo se alejan del todo; las regionales (Sudamérica), menos
  const vistaDe = (nombre) => {
    const e = ESCENAS[nombre];
    const f = 1 + (factorDist() - 1) * lim((e.dist - 1.6) / 2, 0.35, 1);
    return { lat: e.lat, lon: e.lon, alt: e.dist * f - 1, rumbo: 0, incl: 0 };
  };
  nav.saltar(vistaDe("inicio"));

  function irA(nombre) {
    const e = ESCENAS[nombre];
    if (!e) return;
    Object.keys(objetivo).forEach((k) => { objetivo[k] = e.capas[k] || 0; });
    if (nombre === "pacifico" && !REDUCIR && cuadros.length && cuadroActual === cuadros.length - 1) { cuadroActual = 0; reproduciendo = true; mostrarCuadro(); }
    if (nombre !== "pacifico" && cuadros.length && cuadroActual !== cuadros.length - 1) { cuadroActual = cuadros.length - 1; mostrarCuadro(); }
    interactuado = false;
    nav.irA(vistaDe(nombre));
  }

  function encuadre() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    // En el relato el globo se corre para no quedar debajo de la tarjeta: a la derecha en compu, apenas arriba en celular
    if (explorando) camara.clearViewOffset();
    else if (MOVIL) camara.clearViewOffset(); // el globo tiene su propia franja arriba
    else camara.setViewOffset(w, h, -w * 0.15, 0, w, h);
    camara.updateProjectionMatrix();
  }
  addEventListener("resize", encuadre);
  if ("ResizeObserver" in window) new ResizeObserver(() => encuadre()).observe(canvas); // cambia de tamaño al explorar
  encuadre();

  // --- Modo explorar
  const CAPAS_PANEL = ["sst", "tormentas", "onda", "chorro", "humedad", "lluvia", "rios", "chaco"];
  let nombresVisibles = true;
  function panelCapas() {
    $("lista-capas").innerHTML = CAPAS_PANEL.map((c) =>
      `<label class="g-capa"><input type="checkbox" data-capa="${c}" ${capasEncendidas?.[c] ? "checked" : ""}><span>${T("g.capa." + c)}</span></label>`).join("") +
      `<label class="g-capa"><input type="checkbox" data-capa="nombres" ${nombresVisibles ? "checked" : ""}><span>${T("g.capa.nombres")}</span></label>`;
  }
  $("lista-capas").addEventListener("change", (ev) => {
    const c = ev.target.dataset.capa;
    if (!c) return;
    if (c === "nombres") nombresVisibles = ev.target.checked;
    else { capasEncendidas[c] = ev.target.checked; objetivo[c] = ev.target.checked ? 1 : 0; }
    leyenda();
  });
  function explorar(si) {
    if (si === explorando) return;
    explorando = si;
    document.body.classList.toggle("explorando", si);
    nav.modo = si ? "explorar" : "relato";
    $("panel-explorar").hidden = !si;
    $("escena").setAttribute("aria-hidden", String(!si));
    canvas.tabIndex = si ? 0 : -1;
    document.documentElement.style.overflow = si ? "hidden" : "";
    if (si) {
      capasEncendidas = Object.fromEntries(CAPAS_PANEL.map((c) => [c, objetivo[c] > 0.3]));
      if (!Object.values(capasEncendidas).some(Boolean)) capasEncendidas.sst = true;
      CAPAS_PANEL.forEach((c) => { objetivo[c] = capasEncendidas[c] ? 1 : 0; });
      panelCapas();
      cargarDetalle();
      canvas.focus({ preventScroll: true });
    } else {
      capasEncendidas = null;
      irA(estado.escena);
      $("explorar").focus({ preventScroll: true });
    }
    leyenda();
    encuadre();
  }
  document.querySelectorAll("[data-explorar]").forEach((b) => b.addEventListener("click", () => explorar(true)));
  $("salir-explorar").addEventListener("click", () => explorar(false));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && explorando) explorar(false); });
  $("ctl-capas").addEventListener("click", () => {
    const abierto = $("panel-explorar").classList.toggle("abierto");
    $("ctl-capas").setAttribute("aria-expanded", String(abierto));
  });

  // --- Botones de control
  $("ctl-acercar").addEventListener("click", () => { interactuado = true; nav.irA({ alt: Math.max(0.06, nav.vista.alt * 0.55) }, 0.5); });
  $("ctl-alejar").addEventListener("click", () => { interactuado = true; nav.irA({ alt: Math.min(7, nav.vista.alt / 0.55) }, 0.5); });
  $("ctl-norte").addEventListener("click", () => { interactuado = true; nav.norte(); });
  $("ctl-inclinar").addEventListener("click", () => {
    interactuado = true;
    const v = nav.vista;
    if (v.incl > 5) nav.irA({ incl: 0 }, 0.8);
    else nav.irA({ incl: 55, alt: Math.min(v.alt, 0.45) }, 1.1);
  });
  $("ctl-inicio").addEventListener("click", () => {
    if (explorando) { interactuado = true; nav.irA({ lat: -20, lon: -60, alt: 2.6, rumbo: 0, incl: 0 }); }
    else irA(estado.escena);
  });
  $("ctl-satelite").addEventListener("click", alternarSatelite);
  idiomaControles = () => { botonSatelite(); if (explorando) panelCapas(); };
  botonSatelite();

  const tmp = new THREE.Vector3(), brujula = $("brujula");
  let satOpac = 0;
  function cuadroDeAnimacion() {
    const dt = Math.min(reloj.getDelta(), 0.1);
    const t = reloj.elapsedTime;

    // cámara
    if (estado.escena === "inicio" && !interactuado && !explorando && !REDUCIR && !nav.viaje) nav.vista.lon += dt * 1.6; // giro lento al empezar
    nav.actualizar(dt);
    const alt = nav.vista.alt;
    brujula.style.transform = `rotate(${-nav.vista.rumbo}deg)`;
    $("ctl-inclinar").setAttribute("aria-pressed", String(nav.vista.incl > 5));
    if (alt < 2.2) cargarDetalle();

    // capas: fundido hacia la opacidad del paso o de lo elegido en el panel
    CAPAS.forEach((c) => { opac[c] += (objetivo[c] - opac[c]) * Math.min(1, dt * (REDUCIR ? 60 : 2.6)); });
    satOpac += (satObjetivo - satOpac) * Math.min(1, dt * (REDUCIR ? 60 : 3));
    uGlobo.uSat.value = satOpac;
    uGlobo.uSst.value = opac.sst;
    if (onda) onda.material.opacity = opac.onda;
    if (lluvia) lluvia.material.opacity = opac.lluvia;
    if (detalle) {
      const o = Math.max(satOpac * 0.85, lim((2.1 - alt) / 0.6, 0, 1));
      detalle.visible = o > 0.01;
      detalle.children.forEach((l) => { l.material.opacity = o * l.material.userData.max; });
    }
    matRio.opacity = 0.75 * opac.rios;
    matChaco.opacity = opac.chaco;
    const escalaPuntos = lim(alt / 1.1, 0.12, 1);
    matPulso.opacity = opac.chaco * (REDUCIR ? 1 : 0.6 + 0.4 * Math.sin(t * 3));
    matPulso.size = (0.035 + (REDUCIR ? 0 : 0.015 * Math.sin(t * 3))) * escalaPuntos;
    flujo.mat.size = flujo.tam * lim(alt / 1.1, 0.3, 1);

    // temperatura del mar: animación semanal
    if (cuadros.length > 1 && reproduciendo && estado.escena === "pacifico" && !explorando) {
      tCuadro += dt / 0.45;
      if (tCuadro >= 1) {
        tCuadro = 0;
        if (cuadroActual < cuadros.length - 1) cuadroActual++;
        else { cuadroActual = cuadros.length - 1; reproduciendo = false; }
        mostrarCuadro();
      }
      uGlobo.uMezcla.value = cuadroActual < cuadros.length - 1 ? suave(tCuadro) : 0;
    } else uGlobo.uMezcla.value = 0;

    const mover = !REDUCIR;
    if (tormentas) { tormentas.mat.uniforms.uOpac.value = opac.tormentas; if (mover) tormentas.mat.uniforms.uT.value = t; }
    if (chorro) chorro.actualizar(opac.chorro, mover ? dt : 0);
    if (humedad) humedad.actualizar(opac.humedad, mover ? dt : 0);
    flujo.actualizar(opac.rios, mover ? dt : 0);

    // etiquetas: del paso (relato) o de las capas encendidas (explorar), solo del lado visible del globo
    const cam = camara.position;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // y sin pisarse entre sí ni salirse de la pantalla
    const ocupadas = [];
    porPrioridad.forEach((e) => {
      const frente = tmp.copy(e.pos).normalize().dot(cam) > 1.02;
      let activa = frente && (explorando
        ? nombresVisibles && (!e.capa || capasEncendidas[e.capa])
        : e.en.includes(estado.escena));
      if (activa) {
        const p = tmp.copy(e.pos).project(camara);
        const x = ((p.x + 1) / 2) * w, y = ((1 - p.y) / 2) * h;
        const caja = [x - e.w / 2 - 3, y - e.h / 2 - 2, x + e.w / 2 + 3, y + e.h / 2 + 2];
        const dentro = caja[0] > 2 && caja[2] < w - 2 && caja[1] > 2 && caja[3] < h - 2;
        const pisa = ocupadas.some((o) => caja[0] < o[2] && caja[2] > o[0] && caja[1] < o[3] && caja[3] > o[1]);
        activa = dentro && !pisa;
        if (activa) {
          ocupadas.push(caja);
          e.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        }
      }
      e.el.classList.toggle("visible", activa);
    });

    renderer.render(escena, camara);
  }

  let animando = false;
  function bucle() {
    if (document.hidden) { animando = false; return; }
    animando = true;
    cuadroDeAnimacion();
    requestAnimationFrame(bucle);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !animando) { reloj.getDelta(); bucle(); } });

  return {
    async cargar() {
      await cargarSst();
      irA(estado.escena);
      if (REDUCIR) { chorro?.precalentar(); humedad?.precalentar(); flujo.precalentar(); }
      bucle();
    },
    irA,
    explorando: () => explorando,
  };
}

// ---------------------------------------------------------------- partículas con estela (vientos)
class Estelas {
  constructor({ u, v, n, radio, largo, escala, dominio, vida, color, peso }) {
    Object.assign(this, { u, v, n, radio, largo, escala, dominio, vida, color, peso });
    this.lat = new Float32Array(n); this.lon = new Float32Array(n);
    this.edad = new Float32Array(n); this.dur = new Float32Array(n);
    this.rgba = new Float32Array(n * 4);
    this.hist = new Float32Array(n * largo * 3);
    const segs = n * (largo - 1);
    this.pos = new Float32Array(segs * 6);
    this.col = new Float32Array(segs * 8);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, opacity: 0 });
    this.lineas = new THREE.LineSegments(geo, this.mat);
    this.lineas.frustumCulled = false;
    this.pesoMax = 0;
    if (peso) for (let k = 0; k < 400; k++) { const [la, lo] = this.azar(); this.pesoMax = Math.max(this.pesoMax, peso(la, lo)); }
    for (let i = 0; i < n; i++) { this.sembrar(i); this.edad[i] = Math.random() * this.dur[i]; }
    this.v3 = new THREE.Vector3();
  }
  azar() {
    const d = this.dominio;
    const s1 = Math.sin(d.latS * D2R), s2 = Math.sin(d.latN * D2R);
    return [Math.asin(s1 + Math.random() * (s2 - s1)) / D2R, d.lonO + Math.random() * (d.lonE - d.lonO)];
  }
  sembrar(i) {
    let la, lo;
    for (let k = 0; k < 30; k++) {
      [la, lo] = this.azar();
      if (this.u(la, lo) === null) continue;
      if (!this.peso || Math.random() * this.pesoMax < this.peso(la, lo)) break;
    }
    this.lat[i] = la; this.lon[i] = lo; this.edad[i] = 0;
    this.dur[i] = this.vida[0] + Math.random() * (this.vida[1] - this.vida[0]);
    const p = xyz(la, lo, this.radio, this.v3 || new THREE.Vector3());
    for (let k = 0; k < this.largo; k++) { const j = (i * this.largo + k) * 3; this.hist[j] = p.x; this.hist[j + 1] = p.y; this.hist[j + 2] = p.z; }
    this.rgba.set(this.color(la, lo), i * 4);
  }
  paso(dt) {
    const d = this.dominio;
    for (let i = 0; i < this.n; i++) {
      this.edad[i] += dt;
      const la = this.lat[i], lo = this.lon[i];
      const u = this.u(la, lo), v = this.v(la, lo);
      if (this.edad[i] > this.dur[i] || u === null || v === null) { this.sembrar(i); continue; }
      const nla = la + v * this.escala * dt;
      let nlo = lo + (u * this.escala * dt) / Math.max(Math.cos(la * D2R), 0.25);
      if (nlo > 180) nlo -= 360; else if (nlo < -180) nlo += 360;
      if (nla > d.latN || nla < d.latS || (d.lonE - d.lonO < 360 && (nlo < d.lonO || nlo > d.lonE))) { this.sembrar(i); continue; }
      this.lat[i] = nla; this.lon[i] = nlo;
      const b = i * this.largo * 3;
      this.hist.copyWithin(b + 3, b, b + (this.largo - 1) * 3);
      const p = xyz(nla, nlo, this.radio, this.v3);
      this.hist[b] = p.x; this.hist[b + 1] = p.y; this.hist[b + 2] = p.z;
      if ((i + Math.floor(this.edad[i] * 10)) % 8 === 0) this.rgba.set(this.color(nla, nlo), i * 4);
    }
  }
  escribir() {
    const L = this.largo;
    let s = 0;
    for (let i = 0; i < this.n; i++) {
      const vidaRel = this.edad[i] / this.dur[i];
      const fade = Math.min(1, vidaRel * 6, (1 - vidaRel) * 6);
      const r = this.rgba[i * 4], g = this.rgba[i * 4 + 1], b = this.rgba[i * 4 + 2], a = this.rgba[i * 4 + 3] * fade;
      const base = i * L * 3;
      for (let k = 0; k < L - 1; k++, s++) {
        const p = s * 6, c = s * 8, j = base + k * 3;
        this.pos[p] = this.hist[j]; this.pos[p + 1] = this.hist[j + 1]; this.pos[p + 2] = this.hist[j + 2];
        this.pos[p + 3] = this.hist[j + 3]; this.pos[p + 4] = this.hist[j + 4]; this.pos[p + 5] = this.hist[j + 5];
        const a1 = a * (1 - k / (L - 1)), a2 = a * (1 - (k + 1) / (L - 1));
        this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a1;
        this.col[c + 4] = r; this.col[c + 5] = g; this.col[c + 6] = b; this.col[c + 7] = a2;
      }
    }
    const geo = this.lineas.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  actualizar(opacidad, dt) {
    this.mat.opacity = opacidad;
    this.lineas.visible = opacidad > 0.01;
    if (!this.lineas.visible) return;
    if (dt > 0) { this.paso(dt); this.escribir(); }
    else if (!this.escrito) { this.escribir(); this.escrito = true; }
  }
  precalentar() { for (let k = 0; k < this.largo + 2; k++) this.paso(1 / 30); this.escribir(); this.escrito = true; }
}

// ---------------------------------------------------------------- tormentas (convección)
function crearTormentas(imagen, n) {
  // Lugares del trópico con el mar más de 1 °C por encima de lo normal, según el último dato
  const c = document.createElement("canvas");
  c.width = imagen.width; c.height = imagen.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(imagen, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const lugares = [];
  for (let y = 0; y < c.height; y++) {
    const lat = 90 - (y + 0.5) * (180 / c.height);
    if (Math.abs(lat) > 12) continue;
    for (let x = 0; x < c.width; x++) {
      const gris = px[(y * c.width + x) * 4];
      if (gris === 255) continue;
      const anom = (gris / 254) * 10 - 5;
      const lon = (x + 0.5) * (360 / c.width);
      if (anom > 1 && lon > 150 && lon < 285) lugares.push([lat, lon > 180 ? lon - 360 : lon, anom]);
    }
  }
  const dir = new Float32Array(n * 3), fase = new Float32Array(n), vel = new Float32Array(n), tam = new Float32Array(n);
  const v = new THREE.Vector3();
  const total = lugares.reduce((s, l) => s + l[2], 0);
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total, l = lugares[0] || [0, -140, 1];
    for (const cand of lugares) { r -= cand[2]; if (r <= 0) { l = cand; break; } }
    xyz(l[0] + (Math.random() - 0.5), l[1] + (Math.random() - 0.5), 1, v);
    dir.set([v.x, v.y, v.z], i * 3);
    fase[i] = Math.random(); vel[i] = 0.12 + Math.random() * 0.12; tam[i] = 0.6 + Math.random() * 0.8;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aFase", new THREE.BufferAttribute(fase, 1));
  geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 1));
  geo.setAttribute("aTam", new THREE.BufferAttribute(tam, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uOpac: { value: 0 }, uPunto: { value: puntoRedondo() }, uEscala: { value: (POCOS ? 22 : 30) * Math.min(devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aFase, aVel, aTam; uniform float uT, uEscala; varying float vA;
      void main() {
        float h = fract(aFase + uT * aVel);
        vec3 p = normalize(position) * (1.004 + h * 0.16);
        vA = sin(3.14159 * h) * (1.0 - h * 0.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aTam * (0.6 + h * 1.6) * uEscala / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uPunto; uniform float uOpac; varying float vA;
      void main() { float a = texture2D(uPunto, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.93, 0.95, 0.98), a * vA * uOpac * 0.35); }`,
  });
  const puntos = new THREE.Points(geo, mat);
  puntos.frustumCulled = false;
  return { puntos, mat };
}

// ---------------------------------------------------------------- flujo de los ríos
function crearFlujo(tramos, n) {
  const pos = new Float32Array(n * 3);
  const asign = new Int32Array(n), s = new Float32Array(n), vel = new Float32Array(n);
  const pesoTotal = tramos.reduce((a, t) => a + t.total * t.peso, 0);
  for (let i = 0; i < n; i++) {
    let r = Math.random() * pesoTotal, k = 0;
    for (; k < tramos.length - 1; k++) { r -= tramos[k].total * tramos[k].peso; if (r <= 0) break; }
    asign[i] = k; s[i] = Math.random(); vel[i] = 0.004 + Math.random() * 0.004; // unidades de radio terrestre por segundo
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({ color: 0x9fd3ff, size: POCOS ? 0.012 : 0.009, map: puntoRedondo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const puntos = new THREE.Points(geo, mat);
  puntos.frustumCulled = false;
  const v = new THREE.Vector3();
  function colocar(i) {
    const t = tramos[asign[i]];
    const d = s[i] * t.total;
    let j = 1;
    while (j < t.largos.length - 1 && t.largos[j] < d) j++;
    const a = t.largos[j - 1], b = t.largos[j];
    v.lerpVectors(t.pts[j - 1], t.pts[j], b > a ? (d - a) / (b - a) : 0);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  function paso(dt) {
    for (let i = 0; i < n; i++) {
      s[i] += (vel[i] * dt) / tramos[asign[i]].total;
      if (s[i] >= 1) s[i] -= 1; // vuelve a la cabecera: el agua sigue bajando
      colocar(i);
    }
    geo.attributes.position.needsUpdate = true;
  }
  return {
    puntos, mat, tam: mat.size,
    actualizar(opacidad, dt) {
      mat.opacity = opacidad;
      puntos.visible = opacidad > 0.01;
      if (puntos.visible && (dt > 0 || !this.listo)) { paso(dt); this.listo = true; }
    },
    precalentar() { paso(0); this.listo = true; },
  };
}

iniciar().catch((e) => { console.error(e); $("sin-3d").hidden = false; });
