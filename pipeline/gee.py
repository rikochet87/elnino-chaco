"""Procesamiento en Google Earth Engine.

- historico(): series anuales de verano por departamento (CHIRPS, ERA5-Land) y
  capas fijas (zonas bajas MERIT HAND, pérdida de bosque Hansen, población WorldPop).
- agua_observada(): superficie anegada fuera de lo habitual en un mes (Sentinel-1 + JRC).

Requiere `earthengine authenticate` una vez y el proyecto en config.yaml (gee.proyecto).
"""

from . import otsu

VERSION_AGUA = 2  # cambia cuando cambia el método: invalida las mediciones guardadas
from .comun import anios_estacion, departamentos


def iniciar(cfg: dict):
    import ee

    proyecto = cfg["gee"]["proyecto"]
    if not proyecto or proyecto.startswith("TU-"):
        raise SystemExit("Falta configurar gee.proyecto en pipeline/config.yaml")
    ee.Initialize(project=proyecto)
    return ee


def coleccion_deptos(ee, cfg: dict):
    fc = departamentos(cfg)
    return ee.FeatureCollection([
        ee.Feature(ee.Geometry(f["geometry"], None, False), {"id": f["id"]}) for f in fc["features"]
    ])


def _por_depto(ee, imagen, deptos, reductor, escala: int) -> dict:
    """Reduce una imagen multibanda por departamento → {id: {banda: valor}}."""
    tabla = imagen.reduceRegions(collection=deptos, reducer=reductor, scale=escala, tileScale=4).getInfo()
    return {f["properties"]["id"]: {k: v for k, v in f["properties"].items() if k != "id"} for f in tabla["features"]}


def _rango(ee, anio_final: int, meses: list[int]):
    pares = anios_estacion(anio_final, meses)
    a0, m0 = pares[0]
    a1, m1 = pares[-1]
    inicio = ee.Date.fromYMD(a0, m0, 1)
    fin = ee.Date.fromYMD(a1, m1, 1).advance(1, "month")
    return inicio, fin


def historico(cfg: dict, anio_hasta: int) -> dict:
    """Series de verano por departamento desde clima.historico_desde hasta anio_hasta."""
    ee = iniciar(cfg)
    deptos = coleccion_deptos(ee, cfg)
    f, u = cfg["fuentes"], cfg["umbrales"]
    meses = cfg["estacion"]["meses"]
    anios = list(range(cfg["clima"]["historico_desde"], anio_hasta + 1))

    chirps = ee.ImageCollection(f["chirps"]).select("precipitation")
    era5 = ee.ImageCollection(f["era5_land"])
    k_min = u["dengue_temp_min_c"] + 273.15
    k_max = u["dengue_temp_max_c"] + 273.15
    k_trop = u["noche_tropical_c"] + 273.15

    lluvia, noches, aptos = [], [], []
    for a in anios:
        ini, fin = _rango(ee, a, meses)
        lluvia.append(chirps.filterDate(ini, fin).sum().rename(f"pp_{a}"))
        dias = era5.filterDate(ini, fin)
        noches.append(dias.map(lambda i: i.select("temperature_2m_min").gt(k_trop)).sum().rename(f"nt_{a}"))
        aptos.append(dias.map(lambda i: i.select("temperature_2m").gte(k_min).And(i.select("temperature_2m").lte(k_max))).sum().rename(f"da_{a}"))

    series = {}
    for nombre, imgs, escala in (("lluvia_mm", lluvia, 5566), ("noches_tropicales", noches, 11132), ("dias_aptos_dengue", aptos, 11132)):
        res = _por_depto(ee, ee.Image.cat(imgs), deptos, ee.Reducer.mean(), escala)
        for d, vals in res.items():
            series.setdefault(d, {})[nombre] = {int(k.split("_")[-1]): v for k, v in vals.items()}

    for d, v in capas_fijas(cfg, ee, deptos).items():
        series[d].update(v)

    return {"anios": anios, "departamentos": series}


def capas_fijas(cfg: dict, ee=None, deptos=None) -> dict:
    """Capas que no cambian por año: relieve (HAND), pérdida de bosque y población."""
    if ee is None:
        ee = iniciar(cfg)
        deptos = coleccion_deptos(ee, cfg)
    f, u = cfg["fuentes"], cfg["umbrales"]
    salida = {}
    area = ee.Image.pixelArea()

    # Chaco es una llanura: con 5 m casi todo queda como "zona baja". Se guarda la altura
    # media sobre el drenaje (HAND, continua) y la fracción bajo el umbral de config.
    hnd = ee.Image(f["hand"]).select("hnd")
    img = ee.Image.cat(hnd.rename("hand_medio"), hnd.lt(u["zona_baja_hand_m"]).rename("frac_zona_baja"))
    for d, v in _por_depto(ee, img, deptos, ee.Reducer.mean(), 90).items():
        salida.setdefault(d, {}).update({"hand_medio": v.get("hand_medio"), "frac_zona_baja": v.get("frac_zona_baja")})

    h = ee.Image(f["hansen"])
    bosque = h.select("treecover2000").gte(u["bosque_cobertura_2000_pct"])
    perdida = h.select("lossyear").gte(u["bosque_perdida_desde"] - 2000).And(h.select("lossyear").lte(u["bosque_perdida_hasta"] - 2000)).And(bosque)
    img = ee.Image.cat(area.updateMask(bosque).rename("bosque"), area.updateMask(perdida).rename("perdida"))
    for d, v in _por_depto(ee, img, deptos, ee.Reducer.sum(), 30).items():
        b = v.get("bosque") or 0
        salida.setdefault(d, {})["perdida_bosque_pct"] = 100 * (v.get("perdida") or 0) / b if b > 0 else 0.0

    pob = ee.ImageCollection(f["worldpop"]).filter(ee.Filter.eq("country", "ARG")).filter(ee.Filter.eq("year", 2020)).mosaic()
    for d, v in _por_depto(ee, pob.rename("poblacion"), deptos, ee.Reducer.sum(), 100).items():
        salida.setdefault(d, {})["poblacion"] = v.get("sum")
    return salida


def agua_observada(cfg: dict, anio: int, mes: int, asset_caminos: str | None = None) -> dict:
    """Agua fuera de lo habitual en un mes, por departamento (km² y km de caminos)."""
    ee = iniciar(cfg)
    deptos = coleccion_deptos(ee, cfg)
    f, u = cfg["fuentes"], cfg["umbrales"]
    region = ee.Geometry.Rectangle(cfg["area"]["bbox"])
    ini = ee.Date.fromYMD(anio, mes, 1)
    fin = ini.advance(1, "month")

    s1 = (ee.ImageCollection(f["sentinel1"]).filterBounds(region).filterDate(ini, fin)
          .filter(ee.Filter.eq("instrumentMode", "IW"))
          .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
          .select("VV"))
    n = s1.size().getInfo()
    if n == 0:
        raise RuntimeError(f"No hay imágenes Sentinel-1 para {anio}-{mes:02d}")
    fechas = s1.aggregate_array("system:time_start").getInfo()
    vv = s1.median().focalMedian(30, "circle", "meters").clip(region)

    # Umbral de Otsu. Otsu necesita un histograma con dos modos (agua y tierra): sobre toda
    # la provincia casi todo es tierra y el umbral sale demasiado alto. Por eso el histograma
    # se arma solo cerca de cuerpos de agua conocidos (JRC), donde hay mezcla de ambos.
    a = cfg["agua"]
    cerca_agua = (ee.Image(f["jrc_agua"]).select("occurrence").unmask(0).gt(a["ocurrencia_muestra"])
                  .focalMax(a["distancia_muestra_m"], "circle", "meters"))
    hist = vv.updateMask(cerca_agua).reduceRegion(ee.Reducer.histogram(255, 0.1), region, 100, maxPixels=1e10, tileScale=4).getInfo()["VV"]
    metodo = "otsu"
    try:
        umbral_db = otsu.umbral(hist["bucketMeans"], hist["histogram"])
    except (ValueError, TypeError):
        umbral_db = None
    if umbral_db is None or not a["umbral_min_db"] <= umbral_db <= a["umbral_max_db"]:
        print(f"  Umbral de Otsu fuera de rango ({umbral_db}); se usa el de respaldo {a['umbral_respaldo_db']} dB")
        umbral_db, metodo = a["umbral_respaldo_db"], "respaldo"

    habitual = ee.Image(f["jrc_agua"]).select("occurrence").unmask(0).gte(u["agua_permanente_ocurrencia"])
    agua = vv.lt(umbral_db).And(habitual.Not()).selfMask()

    km2 = _por_depto(ee, ee.Image.pixelArea().divide(1e6).updateMask(agua).rename("km2"), deptos, ee.Reducer.sum(), 30)
    resultado = {d: {"km2": round(v.get("sum") or 0.0, 2), "km_caminos": None} for d, v in km2.items()}

    if asset_caminos:
        # Caminos rasterizados a 30 m: cada píxel de camino con agua ≈ 30 m de camino.
        caminos = ee.Image().byte().paint(ee.FeatureCollection(asset_caminos), 1).unmask(0)
        img = caminos.And(agua.unmask(0)).multiply(0.03).rename("km")
        res = _por_depto(ee, img, deptos, ee.Reducer.sum(), 30)
        for d, v in res.items():
            resultado[d]["km_caminos"] = round(v.get("sum") or 0.0, 1)

    ultimo = max(fechas)
    return {
        "anio": anio, "mes": mes, "imagenes": n,
        "fecha_ultima_imagen": ee.Date(ultimo).format("YYYY-MM-dd").getInfo(),
        "umbral_db": round(umbral_db, 2),
        "metodo_umbral": metodo,
        "version": VERSION_AGUA,
        "asset_caminos": asset_caminos,
        "departamentos": resultado,
    }
