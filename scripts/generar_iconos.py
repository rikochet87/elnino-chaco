"""Genera los íconos de la PWA (PNG) con Pillow."""

from pathlib import Path

from PIL import Image, ImageDraw

SALIDA = Path(__file__).resolve().parent.parent / "docs" / "icons"
NAVY, BLANCO, AZUL = (19, 41, 63), (255, 255, 255), (92, 138, 181)


def icono(tam: int, enmascarable: bool = False) -> Image.Image:
    s = 4  # sobremuestreo para bordes suaves
    T = tam * s
    img = Image.new("RGB", (T, T), NAVY)
    d = ImageDraw.Draw(img)
    zona = 0.62 if enmascarable else 0.78  # zona segura de los íconos enmascarables
    r = T * zona / 2
    cx = cy = T / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BLANCO, width=int(T * 0.035))
    # Tres ondas: el océano Pacífico que se calienta
    ancho = int(T * 0.04)
    for k, dy in enumerate((-0.18, 0.02, 0.22)):
        y = cy + dy * r * 2 * 0.55
        puntos = []
        for i in range(61):
            t = i / 60
            x = cx - r * 0.72 + t * r * 1.44
            puntos.append((x, y + (T * 0.035) * __import__("math").sin(t * 6.283 * 1.5)))
        d.line(puntos, fill=BLANCO if k < 2 else AZUL, width=ancho, joint="curve")
    return img.resize((tam, tam), Image.LANCZOS)


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    for tam in (180, 192, 512):
        icono(tam).save(SALIDA / f"icono-{tam}.png", optimize=True)
    icono(512, enmascarable=True).save(SALIDA / "icono-512-enmascarable.png", optimize=True)
    print("Íconos generados en", SALIDA)


if __name__ == "__main__":
    main()
