"""Controles antes de publicar una emisión. Errores frenan la publicación; avisos no."""


def revisar(emision: dict, ids_esperados: list[str], anterior: dict | None = None, saltos_max: int = 2) -> tuple[list, list]:
    errores, avisos = [], []
    deps = emision.get("departamentos", {})

    faltan = sorted(set(ids_esperados) - set(deps))
    sobran = sorted(set(deps) - set(ids_esperados))
    if faltan:
        errores.append(f"Faltan departamentos: {', '.join(faltan)}")
    if sobran:
        errores.append(f"Departamentos desconocidos: {', '.join(sobran)}")
    if not 0 <= emision.get("prob_nino", -1) <= 1:
        errores.append("prob_nino fuera de rango [0, 1]")

    for d, v in deps.items():
        l = v["lluvia"]
        suma = l["prob_superior"] + l["prob_normal"] + l["prob_inferior"]
        if abs(suma - 1) > 0.03:
            errores.append(f"{d}: las probabilidades de lluvia suman {suma:.2f}")
        if not 50 <= l["normal_mm"] <= 2000:
            errores.append(f"{d}: lluvia normal improbable ({l['normal_mm']} mm)")
        for mod in ("anegamiento", "dengue", "calor"):
            cat = v[mod]["categoria"]
            if cat not in (1, 2, 3, 4, 5):
                errores.append(f"{d}: categoría inválida en {mod}")
        for k in ("H", "E", "V", "R"):
            if not 0 <= v["anegamiento"][k] <= 1:
                errores.append(f"{d}: {k} fuera de [0, 1]")
        a = v["agua_obs"]
        if a["km2"] is None or a["km2"] < 0:
            errores.append(f"{d}: agua observada inválida")
        if a["km_caminos"] is None:
            avisos.append(f"{d}: sin km de caminos con agua (falta el asset de caminos)")

    if anterior and anterior.get("departamentos"):
        for d, v in deps.items():
            prev = anterior["departamentos"].get(d)
            if not prev:
                continue
            salto = abs(v["anegamiento"]["categoria"] - prev["anegamiento"]["categoria"])
            if salto > saltos_max:
                avisos.append(f"{d}: el riesgo vial cambió {salto} categorías respecto de {anterior.get('emision')}")

    # Los avisos repetidos por departamento se resumen
    sin_caminos = [x for x in avisos if "sin km de caminos" in x]
    if len(sin_caminos) > 3:
        avisos = [x for x in avisos if x not in sin_caminos] + [f"{len(sin_caminos)} departamentos sin km de caminos con agua (falta el asset de caminos)"]
    return errores, avisos
