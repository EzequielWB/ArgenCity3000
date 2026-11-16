# El barrio que se vacía

Que las quejas de los vecinos —humo, tránsito, luz, calle, delito— pesen de verdad: si nadie las atiende,
la casa se vacía, y el abandono arrastra a las de al lado. Hoy desatender sale casi gratis: el tránsito
solo frena el crecimiento y el vecindario vacío solo baja el valor del suelo, así que se puede hacer
snowball sin mirar a nadie.

## Specs

- **S1.** Un edificio ocupado que no tiene lo que pide la gente pierde el dueño **a la larga**, con un
  respiro para el jugador de dos a tres años.

  > "la idea es que tome un tiempo, es decir que el jugador pueda tener un respiro (2-3 años? desde que
  > se quejan hasta que se van)"

  Cada lote ocupado lleva un **enojo** de 0 a 100. Sube cada mes mientras algo esté mal y baja cuando
  se arregla; a los 100 el dueño se va. Las quejas son las de siempre más dos que faltaban:

  | Queja | Enojo por mes |
  |---|---|
  | sin luz | 4 |
  | sin calle | 4 |
  | caja en rojo | 3 |
  | delito | 3 |
  | humo (solo vivienda) | 3 |
  | calle saturada | 2 (no existía) |
  | cada edificio abandonado a dos lotes | 2, hasta 4 vecinos (no existía) |

  Una sola queja son ~25 meses: dos años. El techo de 10 por mes deja el peor caso en 10 meses, no en uno.
  Lo arreglado se perdona a 10 por mes.

- **S2.** El abandono **irradia**: un edificio abandonado sube el enojo de sus vecinos, así lo que se
  desatiende vacía una calle y no una casa.

  > "al hacer que abandone, como el abandono suele 'irradiarse' a los edificios cercanos, entonces
  > causa eso, si desatendes lo que pide la gente, esta se va"

- **S3.** Se ve venir. El globo de la queja se va poniendo rojo con el enojo, en capas sobre el dibujo.

  > "que el globo de contexto se vaya volviendo rojo con el tiempo (que sea basicamente un % de 'enojo'
  > que aplica una capa de color roja encima del logo)"

- **S4.** La ficha del lote dice el enojo, en cuántos meses se vacía y qué lo está gastando, con qué hacer.

- **S5.** El juego clásico no cambia ninguna regla que no sea esta.

- **S6.** Las piezas de un mismo aeropuerto o puerto se pasan la luz entre ellas, como cualquier edificio.

  > "no sé por qué lo que son los transportes de agua y mar no se pasan la electricidad entre ellos [...]
  > normalmente los aeropuertos los tengo que rodear de electricidad para que funcionen"

## Tasks

| # | Qué | Dónde | Commit |
|---|---|---|---|
| T1 | `world.anger` + guardado v19; `unrest()` con las dos quejas nuevas; `stepAnger()` mensual que vacía a los 100 (S1, S2) | `src/world/world.ts`, `src/save/save.ts`, `src/sim/simulation.ts`, `src/config.ts` | `5f1e6a4` |
| T2 | La capa roja del globo con el enojo (S3) | `src/render/bubbles.ts`, `src/render/view.ts` | `5f1e6a4` |
| T3 | La ficha: enojo, meses que le quedan y el consejo de la queja más pesada (S4) | `src/sim/report.ts` | `5f1e6a4` |
| T4 | Piezas de aeropuerto y puerto como relés de luz (S6) | `src/sim/power.ts` | `e27c1a5` |
| T5 | Tests: paciencia de 24-36 meses, vecindario vacío, perdón, ficha, guardado, y una sola línea que ilumina el aeropuerto entero | `tests/abandon.test.ts`, `tests/aeropuerto.test.ts` | `5f1e6a4`, `e27c1a5` |

## Log

### L1 — el pedido

> "Sabes que quiero cambiar tambien? de balance. Si los vecinos se quejan de algo (humo, transito, luz,
> etc...) a la larga si no son atendido abandonan la casa, por que estoy notando que ahora es mas facil
> hacer snowball y progresar (lo cual no está mal) pero eso lleva a que alguien se apure y desatienda a la
> gente, entonces al hacer que abandone, como el abandono suele "irradiarse" a los edificios cercanos,
> entonces causa eso, si desatendes lo que pide la gente, esta se va"

### L2 — lectura del código antes de escribir

`abandonRisk` ya existía con cuatro causas (sin luz o sin calle, caja en rojo, delito, humo en vivienda) y
`REOCCUPY_RATE` ya devolvía el edificio cuando las condiciones mejoran. Faltaban justo dos cosas de la
lista: **el tránsito**, que solo frenaba el crecimiento, y **el vecindario vacío**, que bajaba el valor del
suelo (y con eso el nivel) pero no apuraba el abandono. O sea: el pedido no es inventar el abandono, es
cerrar los dos agujeros por los que el jugador puede desatender sin riesgo.

### L3 — por qué un contador y no un dado

La versión anterior tiraba un dado por tick (0,001 + lo que sumaran las quejas): el jugador no podía ver
nada y la única forma de castigar más era subir un número invisible. El pedido cambió el diseño: si el
enojo es un número de 0 a 100 que se ve en el globo, entonces el abandono deja de ser una lotería y pasa a
ser una consecuencia con fecha. `abandonChance`/`vacancyPerMonth` se fueron con el dado.

### L4 — el techo de 10 por mes

Sin techo, un lote con todo mal (sin luz, sin calle, en crisis, con delito, humo, calle saturada y cuatro
vecinos vacíos) sumaba 27 por mes y se vaciaba en cuatro meses: menos respiro que antes, justo lo
contrario del pedido. El techo deja el peor caso en 10 meses y una sola queja en 25.

### L5 — la luz de los hubs

`isRelay` no contaba las piezas de aeropuerto, puerto ni los edificios de la costa: cada pieza tenía que
estar, ella sola, dentro del alcance de un relé. Por eso había que rodear el aeropuerto de cables. Ahora
un edificio es un relé sea del tipo que sea, y una línea que toca una pieza ilumina las seis.
