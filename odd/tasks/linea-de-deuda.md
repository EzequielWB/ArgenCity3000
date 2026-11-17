# La línea de deuda

Objective: que estar en rojo deje de ser el final silencioso de la partida.
Branch: feat/vertical-slice. Delivery: ask-on-risk. Runner: `npx vitest run tests/deuda.test.ts`.

Plan completo y clasificación de las 18 tareas de gobiernos: `PLAN-GOBIERNOS.txt`.

## Specs

- S1. "Igual la idea es que tenga su 'complejidad' el juego, si vos lo desatendes tu ciudad se rompe"
  — quebrar tiene que seguir rompiendo la ciudad. No se ablanda ningún castigo: se le pone
  salida y consecuencia, que es distinto.

- S2. Medido: con la caja en −1 peso `spend()` devuelve `false` para todo
  (`if (cost > this.state.cash) return false`, `simulation.ts:440`). El crédito máximo son
  50.000 y el ingreso es `pop × tasa`. Con `pop = 0`, la partida termina sin aviso: no se puede
  gastar, no se puede ingresar, y no hay regla que saque al jugador de ahí. Le pasa al bot
  (`spent.bulldoze = 0` en las 120 corridas, con `clearAbandoned()` corriendo todos los meses).

- S3. La línea de crédito escala con lo construido y no con la población: cuando la población se
  derrumba, una línea atada a ella se derrumba con ella y vuelve a encerrar a la ciudad.

- S4. El interés del descubierto (2 %/mes) es **más caro** que el crédito bancario
  (`LOANS[0]`: 10.000 con tasa 0,3 en 24 meses ≈ 1,1 %/mes efectivo). El banco sigue siendo la
  jugada inteligente y el descubierto la de emergencia.

- S5. Vivir de la línea no puede ser una estrategia: la deuda se compone, la línea no crece con
  la deuda, y al pasarse la Provincia interviene (P0b).

## Tasks

- **T1** — `DEBT` en `config.ts`, `debtLimit(built)` en `sim/loans.ts`, y el guard de `spend()`
  pasa a la línea. Test: se puede llegar a −límite, no se puede pasar.
- **T2** — Interés mensual sobre saldo negativo, como línea del presupuesto
  (`BudgetReport.interest`), visible en la planilla. Test: cobra sólo sobre negativo.
- **T3** — Comprobante de que lo viejo sigue igual: `spend` con caja positiva y sin fondos
  suficientes ya no se rechaza por falta de plata sino por la línea — la regla cambió a
  propósito, y el test de `tests/sim.test.ts:324` se reescribe para expresar la nueva pared.
- **T4** — `overdraft` en `SimState` + `concurso()` y la versión de guardado 20 (P0b).

## Log

**L1 (2026-11-16)** — pedido original: "Osea vos decís que al quedar en rojo podrían salir esas 3
opciones para elegir una, y que solo exista una vez? estilo al caer en rojo por debajo de los 5k
saltan esas 3 opciones?" Se descartó el menú de tres opciones: si las consecuencias son
opcionales nadie las elige, "sólo una vez" deja el segundo fundido sin regla, −5.000 salta en el
año 2 de casi cualquier partida (medido: tecnocracia −3.108 en el año 1, −20.684 en el 2) y
duplica el sistema de créditos.

**L2** — corrección de una propuesta propia: primero dije que el límite escalara con la
población. Está mal por S3: es la misma trampa con otro disfraz.

**L3** — por qué P0a destraba el instrumento sin tocar el bot: `clearAbandoned()`
(`city-bot.ts:241`) se llama todos los meses sin condición y demuele 3, 8 o 20 abandonados según
el estilo; gastó 0 en las 120 corridas sólo porque `spend()` devolvía `false`.

**L4 (2026-11-16) — revertido, con la evidencia.** El jugador marcó la pieza que faltaba: "el
jugador puede hacer eso y también pedir créditos". Es correcto y cambia el diagnóstico: `takeLoan`
no tiene ninguna condición de crisis ni de caja, y el préstamo pone la caja en positivo, que es
exactamente lo que lee `crisis`. **La salida del encierro existía desde el principio.**

Se midió la ruta del crédito para el bot (sacándole `balance > -1500` de `city-bot.ts:218`, sin la
línea de deuda): pico 1.699, caja −705.518. Nada. Y con la línea de deuda: pico 1.699, caja
−32.956.933. La línea sin P0b abre un pozo más hondo que el que cierra, porque el interés compone
sobre una deuda que ya pasó la línea.

Decisión: revertir P0a entero. No mueve la medición, resuelve un problema que un jugador no tiene
y contradice la regla de que desatender rompe la ciudad. La causa medida está en el arranque del bot
(`nextBand < 3`), no en el juego.
