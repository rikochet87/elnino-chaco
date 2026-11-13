"""Umbral de Otsu a partir de un histograma (para separar agua de no agua en radar)."""


def umbral(centros: list[float], conteos: list[float]) -> float:
    """Devuelve el valor que maximiza la varianza entre clases (Otsu, 1979)."""
    if len(centros) != len(conteos) or len(centros) < 2:
        raise ValueError("Histograma inválido")
    total = float(sum(conteos))
    if total <= 0:
        raise ValueError("Histograma vacío")
    suma_total = sum(c * n for c, n in zip(centros, conteos))
    peso_b = suma_b = 0.0
    mejor_var, mejor = -1.0, centros[0]
    for c, n in zip(centros[:-1], conteos[:-1]):
        peso_b += n
        if peso_b == 0:
            continue
        peso_f = total - peso_b
        if peso_f == 0:
            break
        suma_b += c * n
        media_b = suma_b / peso_b
        media_f = (suma_total - suma_b) / peso_f
        var = peso_b * peso_f * (media_b - media_f) ** 2
        if var > mejor_var:
            mejor_var, mejor = var, c
    return mejor
