/* Estadísticas del conjunto: miembros completos, umbrales estrictamente mayores. */
(function () {
  'use strict';
  function resumen(valores) {
    if (!valores.length || valores.some(x => !Number.isFinite(x) || x < 0)) throw Error('Miembros incompletos');
    const v = [...valores].sort((a,b) => a-b);
    const q = p => { const i = (v.length-1)*p, a = Math.floor(i); return v[a]+(v[Math.min(a+1,v.length-1)]-v[a])*(i-a); };
    return {p10:q(.1), mediana:q(.5), p90:q(.9), miembros:v.length,
      prob:Object.fromEntries([1,10,20,50].map(u => [u, Math.round(100*v.filter(x => x>u).length/v.length)]))};
  }
  function diario(datos) {
    const d = datos?.daily;
    if (!d || !Array.isArray(d.time) || d.time.length !== 7 || d.time.some((f,i) => !/^\d{4}-\d{2}-\d{2}$/.test(f) || (i && f <= d.time[i-1]))) throw Error('Faltan días');
    const miembros = Object.entries(d).filter(([k]) => /^precipitation_sum(_member\d+)?$/.test(k)).map(([,v]) => v);
    if (miembros.length < 20 || miembros.some(v => !Array.isArray(v) || v.length !== 7)) throw Error('Faltan miembros');
    return d.time.map((fecha,i) => ({fecha, ...resumen(miembros.map(m => m[i]))}));
  }
  window.Ensamble = {resumen, diario};
})();
