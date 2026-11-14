"""Imagen satelital del globo: NASA Blue Marble Next Generation (dominio público).

Composición de diciembre de 2004 (verano austral), con relieve y batimetría, 5400 × 2700 px.
Se guarda reducida para la web: 4096 × 2048 (compu) y 2048 × 1024 (celular).
Uso: python scripts/imagen_satelital.py   (lo corre GitHub Actions; NASA no pide cuenta)
"""

import io
from pathlib import Path

import requests
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
FUENTES = [
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
        "NASA Earth Observatory, Blue Marble Next Generation (Reto Stöckli, NASA GSFC), diciembre de 2004.\n"
        f"Original: {url}\nDominio público.\n", encoding="utf-8")


if __name__ == "__main__":
    main()
