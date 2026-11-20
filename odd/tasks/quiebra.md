# La quiebra

Un año con la caja en rojo y la Provincia interviene el municipio: la partida termina. Vale para todos los
gobiernos y para cualquier modo de juego.

## Specs

### S1 — Un año en rojo, no dos
- *"TODOS los gobiernos, mas bien el juego en general, lo perdes si tenes UN año de caja en rojo"*: doce
  meses seguidos con `cash < 0` y la partida se termina. `BANKRUPT_MONTHS = 12`.
- Un mes en negro devuelve la cuenta a cero. La cuenta es de meses **consecutivos**, no acumulados.

### S2 — Vale para todos los gobiernos
- La regla no mira `government`. Al que no puede pagar los sueldos no lo salva ni la fe ni el Partido.
- Antes la caja en rojo sólo hundía el modo roguelike, y a los dos años (`RUN_DRY_MONTHS = 24`, dentro de
  `RunState`). Eran dos reglas distintas para lo mismo y ninguna se sentía. Ahora hay **un** contador, vive
  en `SimState.dry`, y el roguelike lo comparte: `runOver(state, months)` lo recibe del que llama.

### S3 — La derrota se anuncia, y se ve venir
- Perder por algo que el jugador no puede ver es una trampa. El diario ya avisaba del rojo; ahora el aviso
  dice la consecuencia: *"Doce meses seguidos así y la Provincia interviene el municipio"*.
- El pie del panel de presupuesto muestra la cuenta: *"La caja lleva 7 meses en rojo: a los 12 la Provincia
  interviene el municipio y se termina la partida"*. Sin barra ni adorno.
- El titular de la derrota dice intervención, no elección: *"12 meses con la caja en rojo: la Provincia
  intervino <ciudad> y sacó al Intendente del gobierno: la ciudad queda en modo libre"*.
- No hay una segunda intervención sobre una partida ya perdida.

### S4 — Los saves viejos no reinician la cuenta
- El contador vivía dentro de `RunState` hasta la versión 21. `dryOf()` en `save.ts` lo lee del estado y,
  si no está, de `run.dry`. Cargar una partida no reinicia los meses que ya venían contados.
- `SAVE_VERSION` no se mueve: el campo es aditivo y el parser tolera su ausencia.

### S5 — No cambia el balance de una ciudad sana
- Medido con `npm run probe` (15 años, bot headless): el bot nunca tiene caja negativa —mínimo $17.579 en
  el año 3— y pierde por elección en el año 4. La corrida es idéntica antes y después del cambio.

## Tasks

- **T1** — `BANKRUPT_MONTHS` en `config.ts`. `S1`
- **T2** — `SimState.dry` y `checkBankruptcy()`, llamado en `endOfMonth` después del balance. `S1 S2`
- **T3** — El roguelike suelta `RUN_DRY_MONTHS` y `RunState.dry`; `runOver` los recibe. `S2`
- **T4** — El aviso del diario, la línea del presupuesto y el titular de la intervención. `S3`
- **T5** — `dryOf()` en el save. `S4`
- **T6** — `tests/quiebra.test.ts`, seis casos: once meses no alcanzan, doce sí, el titular habla de
  intervención, un mes en negro resetea, los cinco gobiernos, y una ciudad que sangrea sola. `S1 S2 S3`

## Log

- **L1** — Pedido original, verbatim: *"Dale, lo que si antes que nada quiero hacer una mini update y que de
  paso lo pusees a main asi está. TODOS los gobiernos, mas bien el juego en general, lo perdes si tenes UN
  año de caja en rojo"*.
- **L2** — Antes de tocar se corrió el probe para tener la línea base: el bot nunca entra en rojo, así que
  la regla nueva no le cambia el resultado. Se volvió a correr después y la salida fue idéntica línea por
  línea.
- **L3** — El contador se movió de `RunState` a `SimState` en vez de duplicarlo. Dos contadores con dos
  umbrales distintos para la misma cosa era justamente el problema que esta regla viene a cerrar.
