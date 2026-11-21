# Los vecinos

Un panel que pone cara, dirección y tiempo a las quejas que la simulación ya calcula.

Hoy el juego sabe, lote por lote, qué está mal (`buildingIssues`) y cuánto lo está sufriendo cada barrio
(`world.anger`), pero todo eso vive en burbujas y números. Los vecinos lo traducen a una voz: quién es,
dónde vive, desde cuándo y qué le pasa. No simula personas: **lee lo que ya está**.

## Specs

- **S1 — El panel se llama «Los vecinos» y se abre desde el menú.** Un botón en el menú de la barra
  de arriba, con el número de reclamos a la vista (`Los vecinos (4)`), y un punto como el del diario
  cuando hay alguno nuevo. El panel es un modal más: se cierra con Escape o con la ✕.
- **S2 — Un reclamo sale de una queja real, no de un invento.** Cada tarjeta muestra el problema que
  `buildingIssues` devuelve para ese lote (`power`, `road`, `jam`, `crime`, `smoke`), y sólo si ese
  problema es de los que suben el enojo: **el vecino que reclama es el que se va a ir**. La falta de
  salud y de escuela no entra — esa se paga en aprobación, no en abandono.
- **S3 — El nombre y la dirección son los mismos siempre.** Salen de `hash2(x, y, seed)`, no del
  `rng` de la partida: el vecino de la manzana 12 es el mismo si el jugador recarga, y mirar el panel
  no cambia el rumbo de la simulación. Tres formas: `Doña <nombre> <apellido>`, `Don <nombre> <apellido>`
  y `La familia <apellido>`.
- **S4 — «Hace N meses» es un dato, no una figura.** El mundo recuerda desde cuándo cada lote tiene algo
  mal (`troubleSince`) y desde cuándo se arregló (`fixedAt`), en ticks. Un lote sin problema no tiene
  fecha. Los campos son aditivos: un save viejo abre sin reclamos viejos inventados.
- **S5 — Cuatro arriba y el resto contado.** Se listan los cuatro lotes más enojados con enojo
  `>= VECINOS.angerMin`; el resto se agrupa por causa («Y 27 vecinos más con el mismo problema de la
  luz»). Sin ese tope una ciudad sin luz muestra cuarenta reclamos idénticos.
- **S6 — Un arreglo se agradece.** Cuando el problema desaparece, el reclamo no se borra: queda hasta
  `VECINOS.thanksFor` meses como agradecimiento, con la frase del problema que se resolvió. Después se
  va solo. Sin eso el panel es una lista de reproches y el jugador aprende a ignorarla.
- **S7 — «Ir» lleva la cámara, no arregla nada.** El botón cierra el panel, centra la vista en el lote y
  abre la tarjeta de consulta de esa celda. No hay botón que resuelva el problema desde la lista: el
  juego se resuelve en el mapa.

## Tasks

| ID | Qué | Dónde | Specs | Commit |
|---|---|---|---|---|
| T1 | `troubleMonths` / `troubleWhat` / `fixedMonths` en el mundo, escritos en `stepAnger`, serializados como opcionales | `src/world/world.ts`, `src/sim/simulation.ts`, `src/save/save.ts` | S4 | `4c9fd0b` |
| T2 | El motor de vecinos: nombres deterministas, reclamos y agradecimientos | `src/sim/vecinos.ts` | S2, S3, S5, S6 | `4c9fd0b` |
| T3 | El markup del panel, puro y testeable | `src/ui/vecinos.ts` | S5, S6, S7 | `0d6c7cb` |
| T4 | `openVecinos` y el botón del menú con su contador | `src/ui/panels.ts`, `src/game.ts`, `src/main.ts`, `index.html`, `src/ui/style.css` | S1, S7 | `0d6c7cb` |
| T5 | Tests y verificación en el juego | `tests/vecinos.test.ts`, `tests/vecinos-panel.test.ts` | todas | `4c9fd0b`, `0d6c7cb` |

## Log

- **L1** — «Dale, comentame como seria la idea» y después «Si un panel propio me parece razonable, si
  queres implementalo y vamos viendo como va». El panel propio queda aprobado; el resto se prueba en
  el juego y se ajusta.
- **L2** — Se descartó darle un oficio a cada vecino: el oficio prometía que el barrio industrial
  hablara distinto del centro, y para eso hacía falta un juego de frases por zona. La variedad sale de
  dos frases por problema elegidas con el mismo hash, que cuesta la mitad.
- **L3** — El corte por enojo (`VECINOS.angerMin`) es lo que convierte la lista en una prioridad: lo
  primero es lo que está por vaciar el barrio, no todo lo que está flojo.
- **L4** — Excepción al test-first: el motor se escribió antes que sus tests porque no tenía interfaz
  todavía y el comportamiento sólo se podía describir una vez que existía. Los 20 tests son del motor y
  del markup, y el caso que más importa —problema → meses → arreglo → agradecimiento— se mide sobre una
  simulación real, no sobre campos puestos a mano.
- **L5** — Dos `++` sobre `troubleMonths` en el mismo paso del mes: el primero quedó del código anterior
  y el segundo venía con el bloque nuevo, así que cada mes contaba el doble. Lo encontró el test de
  «tres meses = 3», no la lectura.
- **L6** — El `troubleWhat` no se guardaba: los agradecimientos llegaban con el nombre del vecino pero
  sin frase, porque `gripOfCode(0)` es `null`. Un campo de memoria que no se serializa es un campo que no
  existe después de cargar, y el save de prueba lo mostró en cinco minutos.
- **L7** — Verificado en el juego con una ciudad de 30 meses a la que se le corta el tendido: el botón
  dice `Los vecinos (67)`, el panel lista cuatro y cuenta 61, y «Ir» abre la consulta del lote con el
  mismo 64 % de enojo y el «se vacía en ~9 meses» que decía la tarjeta.
- **L8** — Lo que falta para que la idea esté completa, si el jugador lo pide: el agrupado por barrio
  («todo Villa Florito sin luz») y que el vecino que se fue por abandono deje su carta. Hoy el que se va
  no deja nada.
