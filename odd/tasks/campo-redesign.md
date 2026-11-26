# Rediseño del campo

## Specs

Verbatim del pedido (L1):

- «actualmente esta MUY roto, no pide nada y te hace ganar si o si plata todos los años»
- «el panel del campo deberia ser MUCHO mas simple, dos o tres barras deslizantes de cosas para balancear y no mucho mas, actualmente es gigante con mucho texto e innecesario»
- «el campo tiene que funcionar como una "inversión" que puede ser o simple generando ganancias sutiles, o altas ganancias si el jugador arriesga»
- «se puede implementar camiones para el transporte o algo asi y generar algo relacionado? es muy argentino»

### S1 — Inversión de riesgo (perfil)

- Slider global «Perfil» de 0 (tranquilo) a 100 (arriesgado): mezcla el año entre trigo seguro y soja.
- Tranquilo (hoy): trigo, cosecha fija de `CROPS.trigo.tons` por lote en diciembre, precio 120–180.
- Arriesgado: soja con rendimiento y precio multiplicados (≥2×), pero un dado climático por cosecha:
  sequía/plaga/granizo que puede dejar la cosecha en la mitad o en cero. La esperanza de la apuesta
  arriesgada debe ser mayor que la segura, pero un año malo tiene que doler.
- El perfil es decisión de la ciudad (un estado en `SimState`), no por lote.

### S2 — El campo pide camino (camiones)

- La cosecha de un lote solo entra si hay camino hacia una feria: sin camión, se pierde (se avisa).
- En el mes de cosecha se dibujan camiones viajando del lote a la feria por las calles.

### S3 — Panel mínimo

- Un párrafo de estado (cadena: lotes/silos/ferias + último cierre en una línea).
- Los tres sliders: perfil, precio mínimo, retención.
- Tira compacta de precios del año (no tabla de 12 filas).
- Se elimina el consejo de múltiples párrafos (`campoAdviceHtml`).

### S4 — Balance

- El campo ya no garantiza plata: la ganancia segura es sutil (cubrir upkeep con margen chico) y la
  arriesgada tiene esperanza mayor con varianza real.
- Los tests de balance existentes (campo-precio, campo-cosecha, campo-panel, campo-ficha) se ajustan
  a la nueva mecánica solo donde cambie la regla; los que pinan comportamiento previo que se conserva
  siguen pasando sin cambios.

## Tasks

- T1 · S4 S1 · `src/config.ts`, `src/sim/campo.ts`: dado climático + perfil en el cierre (`soy` en `CROPS`, `risk` en estado, multiplicadores y roll). Tests: `tests/campo-cosecha.test.ts`. Commit: `c8c2808`
- T2 · S2 · `src/world/farms.ts`, `src/sim/campo.ts`: cosecha pide camino a la cadena (silo o feria, `truckNetwork` + `farmServida`); aviso de pérdida y ficha honesta. Tests: `tests/campo-cosecha.test.ts`, `tests/campo-ficha.test.ts`. Commit: `27e17e8`
- T3 · S2 · `src/render/`: camiones en el mes de cosecha (sprite sobre las calles hacia la feria). Tests: `tests/vehiculos-pixel.test.ts` o propio. Commit: —
- T4 · S3 · `src/ui/campo.ts`, `src/ui/panels.ts`, `src/ui/style.css`: panel mínimo + tira de precios. Tests: `tests/campo-panel.test.ts`. Commit: `0015757`
- T5 · S1 · perfil en estado y save (resuelto dentro de T1/T4: `campoRisk` en `SimState`, `setCampoRisk`, save). Commit: `c8c2808`

## Log

- L1 «Bien, ahora quiero tocar y simplificar lo que es el campo, actualmente esta MUY roto, no pide nada y te hace ganar si o si plata todos los años. Además que el panel del campo deberia ser MUCHO mas simple, dos o tres barras deslizantes de cosas para balancear y no mucho mas, actualmente es gigante con mucho texto e innecesario, el campo tiene que funcionar como una "inversión" que puede ser o simple generando ganancias sutiles, o altas ganancias si el jugador arriesga. Tambien pensaba que se puede implementar camiones para el transporte o algo asi y generar algo relacionado? es muy argentino»
- L2 Diagnóstico confirmado: 6 t/lote/año × ~$150 ≈ $900 por un lote de $30, sin requisitos ni riesgo; la presión de oferta (satura en 2000 t) no actúa a esa escala.
- L3 Resuelto: los camiones van al final de la pasada (T3); el balance primero (T1, T2, T4, T5).
