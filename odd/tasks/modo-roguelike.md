# Modo roguelike

Un modo de juego nuevo: la ciudad se juega como siempre, el objetivo es llegar a **1.000.000 de
habitantes** y en cada marca de población el jugador elige **1 de 3 mejoras**. Las mejoras son la
palanca que rompe la curva: con el balance actual 1M no es difícil, es imposible (ver L2).

Runner de la suite: `npm test` (Vitest). Verificación de alcance: `npx vite-node scripts/run-probe.ts`.

## Specs

### S1 — El modo nuevo y su objetivo

> "agregar un modo de juego nuevo estilo \"roguelike\" que el objetivo sea llegar a 1 millón de
> habitantes para ganar (el resto se juega normal)"

- La partida arranca en modo `clasico` o `roguelike`, elegido en la pantalla de inicio.
- En `roguelike` el objetivo es `RUN_GOAL = 1_000_000`. Al llegar, la run se gana y se muestra el resumen.
- Todo lo demás se juega igual: mismas reglas, mismos hitos de herramientas, mismos eventos,
  mismo presupuesto, mismas elecciones.
- Criterio de aceptación: una partida `clasico` no cambia ni un número (test de regresión).

### S2 — Elegir 1 de 3 en cada marca

> "cada ciertas milestones elegís entre 3 mejoras (algunas solo buenas, algunas malas y buenas,
> algunas malas pero a futuro buenas y asi)"

- Marcas de la run: `RUN_MARKS` (11 marcas, de 500 a 700.000). La marca 12 no es pick: es la victoria.
- Al cruzar una marca se abre una ventana con **3 mejoras distintas** y el tiempo se pausa.
- Tres clases: `buena` (solo ayuda), `mixta` (da y saca ya), `semilla` (cuesta ahora, paga después
  con una etapa a plazo).
- Nunca se ofrecen 3 de la misma clase; nunca se ofrece una mejora ya tomada.
- La oferta se guarda en la partida: al cargar, la ventana se reabre igual (no se vuelve a sortear).
- Criterio de aceptación: mismo seed + mismas decisiones = mismas ofertas.

### S2b — Las dos cartas que se sortean al tomarlas

> "una que se llame 50/50 que te duplica algo aleatoriamente y te reduce algo la mitad
> aleatoriamente (Entre dinero, población y aprobación) y una que sea TODO O NADA, te puede
> triplicar alguna de esas tres O te divide a la mitad una de esas tres"

- `50/50` (mixta): duplica **una** de las tres cosas (`dinero`, `poblacion`, `aprobacion`) y reduce
  **otra** a la mitad; nunca la misma. Las dos se sortean con el rng de la run.
- `todo-o-nada` (mixta): sortea **una** de las tres y una moneda: ×3 o ÷2.
- El sorteo se resuelve **al tomarlas** y queda escrito en el pick (`mods` y `outcome`): no se vuelve
  a tirar al cargar y el resumen de la run dice qué salió.
- La población se mueve como **densidad** (la gente por vivienda): ×2, ×3 o ÷2 de lo que cada edificio
  alberga, que es la única forma de que la población se mueva en este motor.
- La plata y la aprobación son efectos de una sola vez; la aprobación se recorta a 0..100.
- Criterio de aceptación: la ciudad cambia en el acto (caja, aprobación y habitantes), el aviso dice
  qué salió, y al cargar la partida el mismo pick da exactamente los mismos números.

### S2c — Las cartas no se delatan

> "que no diga 'buena, mala ...' sinó que te des cuenta solo leyendo, además que estaria bueno que
> esten 'shuffled' cosa que la buena no esté siempre en el 1er lugar ni la mala en el 3ero"

> "la card de la mejora del rogue like que sea bordó el color de fondo y el titulo en dorado con el
> borde de la card en dorado"

> "vi algo de 'administración' que seria eso? podrias explicarlo mas claro"

- La clase de la carta (`buena`/`mixta`/`semilla`) es una regla del sorteo, no una etiqueta: no se
  escribe en la pantalla ni en el resumen de la run. Se entiende leyendo la carta.
- El orden de las tres se baraja con el rng de la run: ninguna clase tiene un lugar fijo.
- La carta es bordó (`--bordo`), con el borde y el título en dorado (`--gold`), en su propia forma de
  ventana (`data-shape="mejora"`) para no tocar los casos comunes.
- Las cartas que mueven la administración llevan una raya y una línea que dice qué es esa cuenta y
  cuánto costó el mes pasado, en pesos: sin eso, "el recargo por tamaño" no dice nada.
- Criterio de aceptación: el HTML de la oferta no contiene ninguna de las tres etiquetas; en veinte
  seeds las tres clases pasan por el primer lugar; la nota lleva el `services` del último presupuesto.

### S3 — La run se pierde y no se sigue

> "si perdes no podes seguir, solo partida nueva (ir al menu o reiniciar el mismo mapa), 2 años de
> caja en rojo te hacen perder tambien, solo se gana con 1 millon y listo"

- **Dos formas de perder**: perder la elección (o el Congreso del Partido), o **24 meses seguidos con
  la caja en rojo** (`RUN_DRY_MONTHS`). Un mes en positivo reinicia la cuenta.
- Perdida la run no se sigue jugando: la ventana de cierre **no se puede cerrar** y solo ofrece
  *Volver al menú* o *Reiniciar el mismo mapa* (mismo terreno y semilla, partida nueva desde cero).
- Una vez perdida, no se abren más ventanas de mejoras ni se puede ganar.
- Solo se gana con 1.000.000 de habitantes.
- Criterio de aceptación: `runOver` devuelve `ganada` / `eleccion` / `caja` / `null`, y en `clasico`
  siempre `null` (la caja en rojo sigue como hoy y la elección perdida sigue en modo libre).

### S4 — Las mejoras mueven perillas, no reglas nuevas

- Cada mejora aporta etapas con multiplicadores sobre `RunMods`: densidad, empleos, administración,
  curva de la administración, valor del suelo, potencia, crecimiento, migración, ingresos y costo de servicios.
- Los sistemas que ya existen leen `RunMods`; no se duplica ninguna regla.
- Criterio de aceptación: con `NO_MODS` el juego da exactamente los mismos números que antes.

### S5 — Guardado

- `SAVE_VERSION` 18. Las partidas anteriores cargan como `clasico`, sin run.
- El estado de la run se valida al cargar: ids de mejoras conocidos, oferta de 3 ids conocidos,
  índices de marca dentro de rango.

### S6 — 1M tiene que ser alcanzable

> "el objetivo sea llegar a 1 millón de habitantes para ganar"

- Una ciudad de 1M con el stack de mejoras adecuado tiene que ser solvente y no derrumbarse.
- Medición: `scripts/run-probe.ts` arma una ciudad de 1M con el stack completo y la corre dos años.
- Si no cierra, se ajustan las perillas de las mejoras, no la meta.

## Tasks

- **T1** — `src/sim/roguelike.ts`: `RunState`, `RunMods`, `RUN_MARKS`, `RUN_DRY_MONTHS`, los 20 upgrades en tres
  clases, `runMods` (etapas por tick), `openOffer` (una de cada clase, determinista), `takeUpgrade`,
  `runOver` (`ganada` / `eleccion` / `caja`).
- **T2** — Perillas en los sistemas que ya existían: `cityTotals`/`addBuilding` (`demand.ts`),
  `monthlyBudget` (`budget.ts`), `computePower` (`power.ts`), `computeLandValue` (`fields.ts`) y el
  crecimiento (`simulation.ts`). Todo con default neutro.
- **T3** — `SimState.run`, `Simulation.mods` (refresco al tomar carta y al cerrar el mes), marcas y
  victoria en `tick`/`endOfMonth`, `applyUpgrade` (recuenta la ciudad en el acto), contador de meses
  en rojo.
- **T4** — Guardado v18 (`save.ts`): `parseRun` valida ids, oferta, marcas y `wonAt`; una partida
  anterior abre como clásica.
- **T5** — UI: `#startMode` en el inicio, ventana de cartas (`src/ui/upgrades.ts`), cierre de run con
  *Reiniciar el mismo mapa* / *Volver al menú*, línea de objetivo con el contador `rojo N/24`.
- **T6** — Verificación de alcance sin script nuevo: el test *el millón cierra la cuenta con el stack de
  mejoras* arma una ciudad de 1M (viviendas, empleos y servicios) y mide el presupuesto con las cuatro
  reformas del pool: cierra en positivo, y en negativo sin ellas. No se simuló la partida completa
  hasta el millón.
- **T7** — README y ayuda del juego.

Commit del feature: e3896e7.

Tests: `tests/roguelike.test.ts` (14 casos: clásico intacto, sorteo, etapas, densidad, administración,
las dos derrotas, la victoria, la marca automática, solvencia del millón, guardado v18 y markup).


## Log

**L1 — pedido original:**

> "Buenas, me gustaria agregar un modo de juego nuevo estilo \"roguelike\" que el objetivo sea llegar
> a 1 millon de habitantes para ganar (el resto se juega normal) y cada ciertas milestones elegis
> entre 3 mejoras (algunas solo buenas, algunas malas y buenas, algunas malas pero a futuro buenas y asi)"

**L2 — 1M es imposible con el balance actual (medido, no intuido):**

- `budget.ts`: la administración municipal cuesta `pop × 0,1 × (1 + pop / 14.000)`. A 1M son ~$7,2M
  por mes contra ~$925k de impuestos con el impuesto en 10 %. El término cuadrático es el muro.
- `demand.ts:95` + `fields.ts`: la congestión hunde el valor del suelo, baja `levelCap` y los edificios
  se achican. `odd/tasks/balance-de-gobiernos.md` (L3) midió que una ciudad terminada de 163.200 cae a
  31.009 en 24 meses por esta causa.
- Conclusión de diseño: las mejoras tienen que atacar esas dos cosas (curva administrativa y valor del
  suelo) o la meta es decorativa.

**L3 — la condición de derrota.** El pedido original no la decía. Corrección del usuario: perder la
elección **o** dos años seguidos con la caja en rojo terminan la run, y no se puede seguir: solo menú
o reiniciar el mismo mapa. En `clasico` no cambia nada.

**L4 — decisión de arquitectura.** Un objeto `RunMods` con multiplicadores (y un bonus de valor del
suelo aditivo) en vez de una bandera por mejora: 20 mejoras se expresan como datos y cada sistema
existente lee la perilla una sola vez. Prohibido ramificar `if (modoRoguelike)` dentro de la simulación.

**L5 — las cartas de azar.** Pedido del usuario sobre el pool:

> "una que se llame 50/50 que te duplica algo aleatoriamente y te reduce algo la mitad aleatoriamente
> (Entre dinero, población y aprobación) y una que sea TODO O NADA, te puede triplicar alguna de esas
> tres O te divide a la mitad una de esas tres"

No encajan en el modelo de perillas porque tocan estado vivo (caja, aprobación) y porque el resultado
no se conoce hasta tomarlas. La solución mínima: el `Upgrade` declara `gamble` y el sorteo se resuelve
en `takeUpgrade`, que devuelve los factores de caja y aprobación y **escribe en el pick** el resultado
(`mods` para la densidad y `outcome` en palabras). Así `runMods` sigue siendo una función pura del
eestado guardado, no se sortea dos veces y el resumen puede contar qué pasó.
