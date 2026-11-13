"""Utilidades compartidas: configuración, rutas, lectura y escritura."""

import json
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent


def cargar_config(ruta: str | None = None) -> dict:
    ruta = Path(ruta) if ruta else RAIZ / "pipeline" / "config.yaml"
    cfg = yaml.safe_load(ruta.read_text(encoding="utf-8"))
    cfg["_raiz"] = str(RAIZ)
    return cfg


def ruta(cfg: dict, clave: str, *partes: str) -> Path:
    p = RAIZ / cfg["rutas"][clave]
    p.mkdir(parents=True, exist_ok=True)
    return p.joinpath(*partes)


def leer_json(p: Path) -> dict:
    return json.loads(Path(p).read_text(encoding="utf-8"))


def escribir_json(p: Path, datos, indent: int | None = 1) -> None:
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(datos, ensure_ascii=False, indent=indent), encoding="utf-8")


def departamentos(cfg: dict) -> dict:
    """GeoJSON de los departamentos del área."""
    return leer_json(RAIZ / cfg["area"]["departamentos"])


def anios_estacion(anio_final: int, meses: list[int]) -> list[tuple[int, int]]:
    """Pares (año, mes) de una estación que termina en anio_final.

    Para DEF y anio_final=2016 devuelve [(2015, 12), (2016, 1), (2016, 2)].
    """
    # Se recorre hacia atrás desde el último mes: cada vez que el mes "sube", se pasó al año anterior.
    pares, anio = [], anio_final
    for i in range(len(meses) - 1, -1, -1):
        if i < len(meses) - 1 and meses[i] > meses[i + 1]:
            anio -= 1
        pares.append((anio, meses[i]))
    return pares[::-1]
