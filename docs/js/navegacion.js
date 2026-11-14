/* Navegación del globo al estilo Google Earth.
 *
 * La vista se describe con el punto del suelo que está en el centro (lat, lon), la distancia a ese punto
 * (alt, en radios terrestres), el rumbo (0 = norte arriba, grados en sentido horario) y la inclinación
 * (0 = mirando hacia abajo; hasta ~70° cerca del suelo, mirando al horizonte).
 *
 * Mouse:   arrastrar = mover · rueda = acercar/alejar hacia el puntero · clic derecho, botón del medio
 *          o Shift/Ctrl + arrastrar = girar (horizontal) e inclinar (vertical) · doble clic = acercarse ahí.
 * Táctil:  un dedo = mover · dos dedos: pellizcar = zoom, rotar = girar, deslizar arriba/abajo = inclinar
 *          · doble toque = acercarse.
 * Teclado: flechas = mover · + y − = zoom · Shift + flechas = girar e inclinar · N = norte arriba.
 * En el modo relato la rueda sigue moviendo la página (Ctrl + rueda o pellizco del touchpad hace zoom)
 * y en pantallas táctiles el desplazamiento vertical con un dedo sigue siendo el scroll de la página.
 */
import * as THREE from "../vendor/three/three.module.min.js";

const D2R = Math.PI / 180;
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (t) => t * t * (3 - 2 * t);

// Convención de SphereGeometry de three.js: u = (lon + 180) / 360, norte arriba.
export function xyz(lat, lon, r = 1, v = new THREE.Vector3()) {
  const la = lat * D2R, ph = (lon + 180) * D2R;
  return v.set(-Math.cos(ph) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(ph) * Math.cos(la) * r);
}
export function latlon(v) {
  const r = v.length();
  const lat = Math.asin(lim(v.y / r, -1, 1)) / D2R;
  let lon = Math.atan2(v.z, -v.x) / D2R - 180;
  if (lon < -180) lon += 360;
  return [lat, lon];
}
function marco(lat, lon) {
  const la = lat * D2R, ph = (lon + 180) * D2R;
  return {
    n: new THREE.Vector3(-Math.cos(ph) * Math.cos(la), Math.sin(la), Math.sin(ph) * Math.cos(la)),
    e: new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph)),
    nn: new THREE.Vector3(Math.cos(ph) * Math.sin(la), Math.cos(la), -Math.sin(ph) * Math.sin(la)),
  };
}
const difAngulo = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

export const ALT_MIN = 0.05, ALT_MAX = 7;
export const inclMax = (alt) => (alt <= 0.5 ? 70 : alt >= 2.5 ? 15 : 70 - ((alt - 0.5) / 2) * 55);

export class Navegacion {
  constructor({ camara, elemento, reducir = false }) {
    this.camara = camara;
    this.el = elemento;
    this.reducir = reducir;
    this.vista = { lat: 0, lon: -150, alt: 3, rumbo: 0, incl: 0 };
    this.modo = "relato";
    this.viaje = null;
    this.inercia = null; // { dlat, dlon } en grados por segundo
    this.punteros = new Map();
    this.alInteractuar = () => {};
    this.rayo = new THREE.Raycaster();
    this.esfera = new THREE.Sphere(new THREE.Vector3(), 1);
    this._eventos();
  }

  // ---------------------------------------------------------------- vista
  saltar(v) { Object.assign(this.vista, v); this.viaje = null; this.inercia = null; }

  irA(destino, dur = 1.9) {
    const hasta = { ...this.vista, ...destino };
    this.inercia = null;
    if (this.reducir) { this.saltar(hasta); return; }
    const desde = { ...this.vista };
    const p0 = xyz(desde.lat, desde.lon), p1 = xyz(hasta.lat, hasta.lon);
    const ang = p0.angleTo(p1);
    this.viaje = { desde, hasta, p0, p1, t: 0, dur, subida: ang > 0.35 ? Math.min(1.2, ang * 0.5) : 0 };
  }

  aplicar() {
    const v = this.vista, c = this.camara;
    v.alt = lim(v.alt, ALT_MIN, ALT_MAX);
    v.incl = lim(v.incl, 0, inclMax(v.alt));
    v.lat = lim(v.lat, -89, 89);
    const { n, e, nn } = marco(v.lat, v.lon);
    const h = v.rumbo * D2R, t = v.incl * D2R;
    const f = nn.clone().multiplyScalar(Math.cos(h)).addScaledVector(e, Math.sin(h));
    const centro = n.clone();
    c.position.copy(centro).addScaledVector(n, Math.cos(t) * v.alt).addScaledVector(f, -Math.sin(t) * v.alt);
    c.up.copy(n).multiplyScalar(Math.sin(t)).addScaledVector(f, Math.cos(t));
    c.lookAt(centro);
    const cerca = Math.max(0.0008, v.alt * 0.04);
    if (Math.abs(c.near - cerca) / cerca > 0.2) { c.near = cerca; c.far = v.alt + 4; c.updateProjectionMatrix(); }
  }

  actualizar(dt) {
    if (this.viaje) {
      const vj = this.viaje;
      vj.t = Math.min(1, vj.t + dt / vj.dur);
      const k = suave(vj.t);
      const q = new THREE.Quaternion().setFromUnitVectors(vj.p0.clone().normalize(), vj.p1.clone().normalize());
      const p = vj.p0.clone().applyQuaternion(new THREE.Quaternion().slerp(q, k));
      [this.vista.lat, this.vista.lon] = latlon(p);
      this.vista.alt = Math.exp(Math.log(vj.desde.alt) + (Math.log(vj.hasta.alt) - Math.log(vj.desde.alt)) * k) + vj.subida * Math.sin(Math.PI * k);
      this.vista.rumbo = vj.desde.rumbo + difAngulo(vj.desde.rumbo, vj.hasta.rumbo) * k;
      this.vista.incl = vj.desde.incl + (vj.hasta.incl - vj.desde.incl) * k;
      if (vj.t >= 1) this.viaje = null;
    } else if (this.inercia) {
      this.vista.lat += this.inercia.dlat * dt;
      this.vista.lon += this.inercia.dlon * dt;
      const decae = Math.exp(-dt * 4.5);
      this.inercia.dlat *= decae; this.inercia.dlon *= decae;
      if (Math.hypot(this.inercia.dlat, this.inercia.dlon) < 0.05) this.inercia = null;
    }
    if (this.vista.lon > 180) this.vista.lon -= 360; else if (this.vista.lon < -180) this.vista.lon += 360;
    this.aplicar();
  }

  // ---------------------------------------------------------------- utilidades de interacción
  _ndc(x, y) {
    const r = this.el.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }
  tocar(x, y) {
    this.rayo.setFromCamera(this._ndc(x, y), this.camara);
    const p = this.rayo.ray.intersectSphere(this.esfera, new THREE.Vector3());
    return p ? p.normalize() : null;
  }
  _interaccion() { this.viaje = null; this.alInteractuar(); }

  mover(dx, dy) {
    // desplazamiento en pantalla → el punto del centro se corre en la dirección opuesta (como arrastrar el mapa)
    const v = this.vista, c = this.camara;
    const h = this.el.clientHeight || 1;
    const k = (2 * Math.tan((c.fov * D2R) / 2) * Math.min(v.alt, 2.2)) / h; // radianes por píxel
    const { n, e, nn } = marco(v.lat, v.lon);
    const r = v.rumbo * D2R;
    const adelante = nn.clone().multiplyScalar(Math.cos(r)).addScaledVector(e, Math.sin(r));
    const derecha = e.clone().multiplyScalar(Math.cos(r)).addScaledVector(nn, -Math.sin(r));
    const p = n.addScaledVector(derecha, -dx * k).addScaledVector(adelante, dy * k).normalize();
    const [lat, lon] = latlon(p);
    const dlat = lat - v.lat, dlon = difAngulo(v.lon, lon);
    v.lat = lat; v.lon = lon;
    return [dlat, dlon];
  }

  acercar(factor, x, y) {
    const v = this.vista;
    const nueva = lim(v.alt * factor, ALT_MIN, ALT_MAX);
    if (x !== undefined && factor < 1) {
      // acercarse hacia el punto bajo el puntero
      const p = this.tocar(x, y);
      if (p) {
        const c = xyz(v.lat, v.lon);
        const q = new THREE.Quaternion().setFromUnitVectors(c, p);
        const k = 1 - nueva / v.alt;
        [v.lat, v.lon] = latlon(c.applyQuaternion(new THREE.Quaternion().slerp(q, k)));
      }
    }
    v.alt = nueva;
  }

  girar(dRumbo, dIncl) {
    const v = this.vista;
    v.rumbo = (((v.rumbo + dRumbo) % 360) + 360) % 360;
    v.incl = lim(v.incl + dIncl, 0, inclMax(v.alt));
  }

  norte() { this.irA({ rumbo: 0, incl: 0 }, 0.8); }

  // ---------------------------------------------------------------- eventos
  _eventos() {
    const el = this.el;
    let ultimo = null, modoArrastre = null, muestras = [], toqueAnterior = { t: 0, x: 0, y: 0 };
    let dos = null;

    el.addEventListener("contextmenu", (e) => e.preventDefault());

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button > 2) return;
      el.setPointerCapture?.(e.pointerId);
      this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.inercia = null;
      if (this.punteros.size === 1) {
        const girar = e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.altKey;
        modoArrastre = girar ? "girar" : "mover";
        ultimo = { x: e.clientX, y: e.clientY };
        muestras = [];
        el.classList.add("arrastrando");
        // doble toque en pantallas táctiles
        if (e.pointerType !== "mouse") {
          const ahora = performance.now();
          if (ahora - toqueAnterior.t < 320 && Math.hypot(e.clientX - toqueAnterior.x, e.clientY - toqueAnterior.y) < 30) this._dobleToque(e.clientX, e.clientY);
          toqueAnterior = { t: ahora, x: e.clientX, y: e.clientY };
        }
      } else if (this.punteros.size === 2) {
        dos = this._medirDos();
        modoArrastre = null;
      }
    });

    el.addEventListener("pointermove", (e) => {
      if (!this.punteros.has(e.pointerId)) return;
      this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.punteros.size === 2 && dos) {
        const ahora = this._medirDos();
        this._interaccion();
        this.vista.alt = lim(this.vista.alt * (dos.dist / ahora.dist), ALT_MIN, ALT_MAX);
        this.girar(-(ahora.ang - dos.ang) / D2R, 0);
        const dy = ahora.y - dos.y;
        if (Math.abs(ahora.dist - dos.dist) < 4) this.girar(0, -dy * 0.25);
        else this.mover(ahora.x - dos.x, ahora.y - dos.y);
        dos = ahora;
        return;
      }
      if (!ultimo || !modoArrastre) return;
      const dx = e.clientX - ultimo.x, dy = e.clientY - ultimo.y;
      ultimo = { x: e.clientX, y: e.clientY };
      if (!dx && !dy) return;
      this._interaccion();
      if (modoArrastre === "girar") this.girar(dx * 0.3, -dy * 0.25);
      else {
        const [dlat, dlon] = this.mover(dx, dy);
        muestras.push({ t: performance.now(), dlat, dlon });
        if (muestras.length > 6) muestras.shift();
      }
    });

    const soltar = (e) => {
      if (!this.punteros.has(e.pointerId)) return;
      this.punteros.delete(e.pointerId);
      if (this.punteros.size === 1) { // de dos dedos a uno: seguir moviendo con el que queda
        const [p] = this.punteros.values();
        ultimo = { x: p.x, y: p.y }; modoArrastre = "mover"; dos = null; muestras = [];
        return;
      }
      if (this.punteros.size === 0) {
        el.classList.remove("arrastrando");
        if (modoArrastre === "mover" && !this.reducir && e.type === "pointerup") {
          const ahora = performance.now();
          const rec = muestras.filter((m) => ahora - m.t < 90);
          if (rec.length >= 2) {
            const dur = Math.max(16, ahora - rec[0].t) / 1000;
            const dlat = rec.reduce((s, m) => s + m.dlat, 0) / dur, dlon = rec.reduce((s, m) => s + m.dlon, 0) / dur;
            if (Math.hypot(dlat, dlon) > 2) this.inercia = { dlat, dlon };
          }
        }
        ultimo = null; modoArrastre = null; dos = null;
      }
    };
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);

    el.addEventListener("wheel", (e) => {
      // En el relato la rueda mueve la página; el zoom va con Ctrl + rueda (o pellizco del touchpad)
      if (this.modo === "relato" && !e.ctrlKey) return;
      e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      this._interaccion();
      this.inercia = null;
      this.acercar(Math.exp(lim(d, -300, 300) * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
    }, { passive: false });

    el.addEventListener("dblclick", (e) => { e.preventDefault(); this._dobleToque(e.clientX, e.clientY); });

    el.addEventListener("keydown", (e) => {
      const paso = 60;
      const acciones = {
        ArrowLeft: () => (e.shiftKey ? this.girar(-10, 0) : this.mover(paso, 0)),
        ArrowRight: () => (e.shiftKey ? this.girar(10, 0) : this.mover(-paso, 0)),
        ArrowUp: () => (e.shiftKey ? this.girar(0, 8) : this.mover(0, paso)),
        ArrowDown: () => (e.shiftKey ? this.girar(0, -8) : this.mover(0, -paso)),
        "+": () => this.acercar(0.7), "=": () => this.acercar(0.7), "-": () => this.acercar(1 / 0.7),
        PageUp: () => this.acercar(0.7), PageDown: () => this.acercar(1 / 0.7),
        n: () => this.norte(), N: () => this.norte(),
      };
      if (!acciones[e.key]) return;
      e.preventDefault();
      this._interaccion();
      acciones[e.key]();
    });
  }

  _medirDos() {
    const [a, b] = [...this.punteros.values()];
    return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ang: Math.atan2(b.y - a.y, b.x - a.x), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  _dobleToque(x, y) {
    const p = this.tocar(x, y);
    if (!p) return;
    this._interaccion();
    const [lat, lon] = latlon(p);
    this.irA({ lat, lon, alt: Math.max(ALT_MIN, this.vista.alt * 0.45) }, 0.9);
  }
}
