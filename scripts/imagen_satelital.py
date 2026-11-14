"""Imagen satelital del globo: NASA Blue Marble Next Generation (dominio público).

Se pide primero al servicio de mapas GIBS de la NASA (Blue Marble con relieve y batimetría) y, si no responde,
al archivo original del Earth Observatory (composición de diciembre de 2004, verano austral).
Se guarda reducida para la web: 4096 × 2048 (compu) y 2048 × 1024 (celular).
Uso: python scripts/imagen_satelital.py   (lo corre GitHub Actions; NASA no pide cuenta)
"""

import io
from pathlib import Path

import requests
import urllib3.util.connection as conexion
from PIL import Image

conexion.HAS_IPV6 = False  # los servidores de GitHub no tienen salida IPv6
Image.MAX_IMAGE_PIXELS = None

RAIZ = Path(__file__).resolve().parent.parent
GIBS = ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
        "&LAYERS={capa}&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048&FORMAT=image/jpeg")
FUENTES = [
    GIBS.format(capa="BlueMarble_ShadedRelief_Bathymetry"),
    GIBS.format(capa="BlueMarble_NextGeneration"),
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x5400x2700.jpg",
]


def main():
    ultimo = None
    for url in FUENTES:
        try:
            r = requests.get(url, timeout=300, headers={"User-Agent": "elnino-chaco"})
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            break
        except Exception as e:  # probar la siguiente
            ultimo = e
            print(f"No se pudo descargar {url}: {e}")
    else:
        raise SystemExit(f"Sin imagen: {ultimo}")
    print(f"Descargada {url} ({img.width}×{img.height})")
    destino = RAIZ / "docs/data/imagen"
    destino.mkdir(parents=True, exist_ok=True)
    for ancho, calidad in [(4096, 80), (2048, 78)]:
        chica = img.resize((ancho, ancho // 2), Image.LANCZOS)
        ruta = destino / f"tierra-{ancho}.jpg"
        chica.save(ruta, quality=calidad, optimize=True, progressive=True)
        print(f"{ruta}: {ruta.stat().st_size / 1024:.0f} KB")
    (destino / "FUENTE.txt").write_text(
        "NASA Blue Marble Next Generation (Reto Stöckli, NASA Earth Observatory / NASA GIBS).\n"
        f"Original: {url}\nDominio público.\n", encoding="utf-8")


if __name__ == "__main__":
    main()
