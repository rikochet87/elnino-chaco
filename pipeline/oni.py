"""Índice Oceánico El Niño (ONI) de NOAA CPC y clasificación de veranos Niño.

Definición operativa de NOAA: episodio El Niño cuando el ONI es >= +0,5 °C durante
al menos 5 temporadas trimestrales superpuestas consecutivas. La intensidad se
clasifica por el máximo del episodio: débil (0,5–0,9), moderado (1,0–1,4),
fuerte (1,5–1,9) y muy fuerte (>= 2,0).
"""

import requests

TEMPORADAS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]


def descargar(url: str) -> str:
    r = requests.get(url, timeout=60, headers={"User-Agent": "elnino-chaco"})
    r.raise_for_status()
    return r.text


def parsear(texto: str) -> list[dict]:
    """Devuelve [{'temporada': 'DJF', 'anio': 1950, 'anom': -1.53}, ...] en orden temporal."""
    serie = []
    for linea in texto.splitlines():
        partes = linea.split()
        if len(partes) == 4 and partes[0] in TEMPORADAS:
            serie.append({"temporada": partes[0], "anio": int(partes[1]), "anom": float(partes[3])})
    if not serie:
        raise ValueError("No se reconoció el formato del archivo ONI")
    return serie


def episodios(serie: list[dict], umbral: float = 0.5, minimo: int = 5) -> list[dict]:
    """Episodios El Niño: tramos de >= `minimo` temporadas consecutivas con anom >= umbral."""
    resultado, tramo = [], []
    for i, s in enumerate(serie + [{"anom": -99}]):
        if s["anom"] >= umbral:
            tramo.append(i)
        else:
            if len(tramo) >= minimo:
                pico = max(serie[j]["anom"] for j in tramo)
                resultado.append({"indices": tramo, "pico": pico, "intensidad": intensidad(pico)})
            tramo = []
    return resultado


def intensidad(pico: float) -> str:
    if pico >= 2.0:
        return "muy fuerte"
    if pico >= 1.5:
        return "fuerte"
    if pico >= 1.0:
        return "moderado"
    return "débil"


def veranos_nino(serie: list[dict], umbral: float = 0.5, minimo: int = 5) -> dict[int, str]:
    """Años (del enero/febrero) cuyo trimestre DJF forma parte de un episodio El Niño.

    Devuelve {1983: 'muy fuerte', 1998: 'muy fuerte', ...}.
    """
    resultado = {}
    for ep in episodios(serie, umbral, minimo):
        for i in ep["indices"]:
            if serie[i]["temporada"] == "DJF":
                resultado[serie[i]["anio"]] = ep["intensidad"]
    return resultado


MESES_TEMPORADA = {
    "DJF": "dic–feb", "JFM": "ene–mar", "FMA": "feb–abr", "MAM": "mar–may", "AMJ": "abr–jun", "MJJ": "may–jul",
    "JJA": "jun–ago", "JAS": "jul–sep", "ASO": "ago–oct", "SON": "sep–nov", "OND": "oct–dic", "NDJ": "nov–ene",
}
# Ventana de un episodio: de marzo–mayo del año de inicio a marzo–mayo del año siguiente.
VENTANA = ["MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ", "DJF", "JFM", "FMA", "MAM"]


def _anio_de(temporada: str, anio_inicio: int, posicion: int) -> int:
    # En el archivo ONI, el año de DJF, JFM, FMA y del MAM final es el del enero.
    return anio_inicio + 1 if posicion >= 9 else anio_inicio


def para_web(serie: list[dict], comparar: tuple[int, ...] = (1997, 2015)) -> dict:
    """Curvas del episodio actual y de episodios de referencia, para el gráfico de la web."""
    idx = {(s["temporada"], s["anio"]): s["anom"] for s in serie}
    ultimo = serie[-1]
    pos_ultimo = TEMPORADAS.index(ultimo["temporada"])
    # El episodio actual empieza en el MAM del año del último dato (o del anterior si aún es ene–abr)
    actual = ultimo["anio"] if pos_ultimo >= TEMPORADAS.index("MAM") else ultimo["anio"] - 1

    def curva(anio):
        return [idx.get((t, _anio_de(t, anio, i))) for i, t in enumerate(VENTANA)]

    return {
        "fuente": "NOAA CPC, Oceanic Niño Index (ERSSTv5)",
        "ultimo": {"temporada": ultimo["temporada"], "meses": MESES_TEMPORADA[ultimo["temporada"]],
                   "anio": ultimo["anio"], "anom": ultimo["anom"]},
        "ventana": [MESES_TEMPORADA[t] for t in VENTANA],
        "episodios": [{"nombre": f"{actual}-{str(actual + 1)[-2:]}", "actual": True, "valores": curva(actual)}]
                     + [{"nombre": f"{a}-{str(a + 1)[-2:]}", "actual": False, "valores": curva(a)} for a in comparar],
    }
