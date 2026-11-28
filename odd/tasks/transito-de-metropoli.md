# El tránsito de la metrópoli

## Specs

Verbatim del pedido:

- «me gusta lo de la radio que avise, pero de forma sutil y cuando los vecinos de quejan de las calles, algo asi como "quizá mejores calles u otros medios de transporte mejor la situción" o algo asi»
- «Me gusta lo de BUS.trips y el laneCapacity a 1350 creo yo»
- «Despues de este cambio vamos a meter estación de metro tambien» (queda pendiente para la próxima ronda)

### S1 — La radio sugiere, no ordena

- Cuando hay un llamado por `jam` («no se puede salir del barrio») en la lista de la radio, el desplegable
  muestra una línea al pie, sutil: «Quizá mejores calles u otros medios de transporte mejoren la
  situación.» Sin llamados de tránsito, no aparece.

### S2 — Colectivos con peso en la metrópoli

- `BUS.trips` 500 → 1.500: una línea lleva 1.500 viajeros. Con 40 líneas al 100 %, el alivio físico
  pasa de ~4 % a ~13 % de los viajeros de una metrópoli de 460.000; el techo poblacional (`BUS.share`,
  35 %) queda como está.

### S3 — Calles más capaces

- `TRAFFIC.laneCapacity` 1200 → 1350 (+12,5 %): una calle de asfalto aguanta más antes de saturar.
- Medición del probe (`scripts/probe-transito.ts`, metrópoli 128 con avenidas de 2 cada dos cuadras y
  460.800 viajeros): asfalto peor 156 % → **139 %** (atascados 55 % → 49 %); bulevar peor 87 % →
  **77 %** (atascados 0 %). El bulevar sigue siendo la respuesta, ahora menos dura.

### S4 — La ayuda dice la verdad

- El bullet de Transportes de la ayuda (`H`) describe el modelo global con el número nuevo; se va el
  texto viejo del rombo (500 viajeros por calle a 9 lotes).

Criterios de aceptación:

- La nota de la radio aparece con llamado `jam` y sin él no.
- `BUS.trips` vale 1.500 y la ficha de la línea lo dice (texto y número del panel).
- `TRAFFIC.laneCapacity` vale 1.350 y las pruebas de saturación siguen con la constante.

## Tasks

- T1 · S2 S3 · `src/config.ts`: `BUS.trips` 1500, `TRAFFIC.laneCapacity` 1350. Tests: pin de ambos en `tests/transito-de-metropoli.test.ts`.
- T2 · S1 · `src/ui/vecinos.ts`: nota al pie del desplegable cuando hay llamado `jam`. Tests: `tests/vecinos-panel.test.ts`.
- T3 · S4 · `src/ui/panels.ts`: bullet de Transportes con el modelo global y 1.500. `README.md`: misma corrección. `src/sim/outlook.ts`: «rinde con unos 4.300 vecinos» (1.500 / 0,35).

## Evidencia

- Commit: (pendiente de crear) — suite 1492 tests / 106 archivos verde, `tsc --noEmit` limpio.
- Probe con las palancas nuevas: asfalto peor 139 % / 49 % atascados; bulevar peor 77 % / 0 %.
- `tests/transito-de-metropoli.test.ts` (4): pin de `BUS.trips` 1500 y `laneCapacity` 1350; nota de radio
  aparece con llamado `jam` y no con delito.

## Log

- L1 (verbatim): «Claro, el tema que ponele en esta partida mia termino teniendo una congestión enorme y ya tengo avenidas cada dos cuadras (cada una de 4x4 la cuadra, la avenida de 2 de ancho) y no me parece razonable creo yo»
- L2: el probe (`scripts/probe-transito.ts`) mostró que con la misma grilla en bulevar la saturación cae de 156 % a 87 % y los atascos de 55 % a 0 %: la respuesta del juego ya existe (mejorar la calle) y los colectivos no pesan (flota física ~4 %). El usuario eligió: radio sutil + BUS.trips 1500 + laneCapacity 1350, y diferir el metro.
