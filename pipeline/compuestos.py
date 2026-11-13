"""Climatología y compuestos de años Niño a partir de series anuales por departamento.

Entrada: para cada departamento, un valor por verano (año del enero/febrero).
Salida: valor normal (media del período de referencia), anomalía media en años Niño
(en % o en unidades) y consistencia de signo (fracción de años Niño con anomalía positiva).
"""

from statistics import mean


def resumen(serie: dict[int, float], anios_nino: list[int], referencia: tuple[int, int], relativo: bool) -> dict:
    """Resume una serie anual de un departamento.

    relativo=True expresa la anomalía en % de la normal (lluvia); False en unidades (días).
    """
    serie = {int(k): v for k, v in serie.items() if v is not None}
    ref = [v for a, v in serie.items() if referencia[0] <= a <= referencia[1]]
    if len(ref) < 20:
        raise ValueError(f"Período de referencia incompleto: {len(ref)} años")
    normal = mean(ref)
    anomalias = []
    for a in anios_nino:
        if a in serie:
            d = serie[a] - normal
            anomalias.append(100 * d / normal if relativo and normal else d)
    if not anomalias:
        raise ValueError("Ningún año Niño con datos")
    return {
        "normal": normal,
        "anom_nino": mean(anomalias),
        "consistencia": sum(1 for x in anomalias if x > 0) / len(anomalias),
        "n_nino": len(anomalias),
    }
