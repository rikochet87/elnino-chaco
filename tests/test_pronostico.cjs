const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture(fetch) {
  const elements = new Map();
  const element = () => ({ textContent: '', hidden: false, children: [], append(n) { this.children.push(n); }, replaceChildren() { this.children = []; } });
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element, querySelectorAll: () => [] };
  const storage = new Map();
  const context = { window: { I18N: { idioma: 'es', locale: () => 'es-AR' } }, document, fetch, URLSearchParams, AbortSignal, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) } };
  vm.runInNewContext(fs.readFileSync('docs/js/pronostico.js', 'utf8'), context);
  return { api: context.window.Pronostico, elements, storage };
}
const datos = (mm = 5) => ({ daily: { time: Array.from({length: 7}, (_,i) => `2026-11-${17+i}`), precipitation_sum: Array(7).fill(mm), precipitation_probability_max: Array(7).fill(70), weather_code: [95,96,99,0,3,61,null] } });
const p = { nombre: 'Departamento', cabecera: 'Cabecera', centro: [-59, -27] };
test('validates missing values and rejects malformed forecasts', () => {
  const {api} = fixture();
  assert.equal(api.validar(datos()).daily.time.length, 7);
  const d = datos(); d.daily.precipitation_sum[0] = null;
  assert.doesNotThrow(() => api.validar(d));
  d.daily.precipitation_probability_max[0] = 101;
  assert.throws(() => api.validar(d));
  assert.throws(() => api.validar({daily: {time: []}}));
  assert.equal(api.condicion(95), 'Tormentas');
  assert.equal(api.condicion(null), 'Sin dato');
});
test('requests the representative coordinates and reuses the cache', async () => {
  let calls = 0;
  const {api, elements} = fixture(async url => {
    calls++; const q = new URL(url).searchParams;
    assert.equal(q.get('latitude'), '-27'); assert.equal(q.get('longitude'), '-59');
    assert.equal(q.get('forecast_days'), '7');
    return {ok: true, json: async () => datos()};
  });
  await api.mostrar('a', p); await api.mostrar('a', p);
  assert.equal(calls, 1);
  assert.equal(elements.get('pronostico-dias').children.length, 7);
  assert.equal(elements.get('pronostico-dias').children[0].className, 'dia-tormenta');
});
test('late responses cannot replace the selected department', async () => {
  let resolveA;
  const {api, elements} = fixture(url => new URL(url).searchParams.get('longitude') === '-59' ? new Promise(r => resolveA = r) : Promise.resolve({ok:true, json: async () => datos(20)}));
  const a = api.mostrar('a', p);
  await api.mostrar('b', {...p, centro: [-60,-27]});
  resolveA({ok:true, json: async () => datos(1)}); await a;
  assert.equal(elements.get('pronostico-dias').children[0].children[2].textContent, '20 mm');
});
test('offline copies are explicitly marked and missing forecasts show an error', async () => {
  const {api, elements, storage} = fixture(async () => {throw Error('offline');});
  storage.set('pronostico-7-v2--59.0000,-27.0000', JSON.stringify({ consultado: Date.now()-7200000, datos: datos() }));
  await api.mostrar('a', p);
  assert.match(elements.get('pronostico-estado').textContent, /Copia guardada/);
  await api.mostrar('b', {...p, centro: [-60, -27]});
  assert.equal(elements.get('pronostico-tabla').hidden, true);
  assert.match(elements.get('pronostico-estado').textContent, /No se pudo/);
});

test('towns in the same department have independent coordinate forecasts', async () => {
  const requests = [];
  const {api} = fixture(async url => { requests.push(new URL(url).searchParams.get('longitude')); return {ok:true, json: async () => datos()}; });
  await api.mostrar('same-department', p);
  await api.mostrar('same-department', {...p, centro: [-60, -27]});
  assert.deepEqual(requests, ['-59', '-60']);
});
test('device coordinates are used without persisting their forecast', async () => {
  const {api, storage, elements} = fixture(async url => {
    assert.equal(new URL(url).searchParams.get('longitude'), '-60.123456');
    return {ok:true, json: async () => datos()};
  });
  await api.mostrar('device', {...p, centro: [-60.123456, -27.456], dispositivo: true});
  assert.equal(storage.size, 0);
  assert.match(elements.get('pronostico-zona').textContent, /Tu ubicación actual/);
});
test('official locality coordinates cover every department', () => {
  const towns = JSON.parse(fs.readFileSync('docs/data/localidades.json', 'utf8'));
  const departments = JSON.parse(fs.readFileSync('docs/data/departamentos.geojson', 'utf8')).features;
  assert.equal(towns.length, 91);
  for (const town of towns) {
    assert.ok(departments.some(d => d.id === town.depto));
    assert.ok(town.centro.length === 2 && town.centro.every(Number.isFinite));
    assert.ok(town.centro[0] < -58 && town.centro[0] > -64 && town.centro[1] < -24 && town.centro[1] > -29);
  }
  for (const d of departments) assert.ok(towns.some(t => t.depto === d.id));
});
