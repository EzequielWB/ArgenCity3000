# Los casos cobran en semanas de recaudación

Objetivo: que una decisión pese lo mismo en un pueblo de cinco mil habitantes que en una ciudad de
cien mil. Antes cobraban pesos fijos.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los
decide el usuario). Runner: `npx vitest run`, `npx tsc --noEmit`.

## Specs

### S1 — Los importes eran fijos, y eso no escala

> "no sé como escalan los eventos aleatorios respecto al dinero, me refiero a que si es un valor fijo, en una ciudad de 100k de habitantes quizá gastar 5k de plata no cambia nada"

Medido antes de tocar nada, con `npm run probe` y con una ciudad llena a nivel 5:

| Ciudad | Recaudación por mes | $15.000 son |
|---|---|---|
| `probe`, año 3 (4.336 hab) | ~$660 | 22 meses |
| 25.000 hab, media ciudad | ~$12.000 | 1,2 meses |
| 128×128 llena a nivel 5 | ~$870.000 | medio día |

La recaudación por habitante va de 0,14 a 1,1 pesos por mes. Los importes estaban calibrados para
una ciudad de veinte o treinta mil: abajo eran catastróficos, arriba eran ruido.

Criterio de aceptación: el mismo caso cuesta lo mismo **en semanas de lo que la ciudad recauda**.

### S2 — La unidad es el tiempo de recaudación

> "Me gusta hacerlo por tiempo de recaudación"

`weeksOfIncome(sim, semanas)` = lo que la ciudad recaudó el mes pasado ÷ 4 × las semanas.

**Corregido después**, verbatim: "no se puede hacer con numeros? prefiero que el usuario sepa que le
va a salir X dinero que imaginar cuanto seria el impacto en caja". El detalle de cada opción dice el
peso exacto, calculado al abrir la ventana (`EventOption.detail` puede ser `(sim) => string`), y es el
mismo número que se cobra: el tiempo está en pausa hasta que el jugador elige.

### S3 — Que joda, pero que no cague la partida

> "lo que si creo yo es que tiralo un "poquito" para abajo en el sentido que te joda, pero tampoco te pueda cagar la partida"

Cada importe viejo se convirtió a semanas redondeando **hacia arriba** (tendiendo a más caro), nunca
hacia abajo, y con un piso de $500 por semana para que un pueblo que todavía no recaudó nada igual
pague algo.

## Tasks

- T1 — `weeksOfIncome` y el piso, en `src/sim/events.ts`.
- T2 — Las 24 opciones de los casos y las tres de los feriados, en semanas.
- T3 — Los tests de `tests/eventos.test.ts` pasan a asertar semanas.

## Log

- L1 — Pedido original, verbatim en S1.
- L2 — Medición: ver la tabla. El `probe` se estanca en 5.000 habitantes, así que la calibración
  "para veinte o treinta mil" es una lectura de la tabla, no un dato del juego.
- L3 — Los topes de caja de los `when` (`cash > 5000`, `cash > 20000`) quedaron en pesos absolutos:
  son más estrictos que el costo real y no rompen nada. Se pueden pasar a semanas si alguna vez
  frenan un caso que el jugador podría pagar.
- L4 — `weeksOfIncome` no redondea el resultado final: un importe puede quedar en medio peso cuando
  la semana da impar. Solo se ve en la caja, nunca en un texto.
- L5 — El detalle volvió a los pesos, calculados en el momento. Las semanas quedan como la unidad de
  la fórmula, no de la pantalla.
