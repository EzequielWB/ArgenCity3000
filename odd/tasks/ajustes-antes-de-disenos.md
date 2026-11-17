# Ajustes antes de cerrar los diseños

Once pedidos chicos que no son una familia de sprites: cuatro de interfaz, tres de textos y metas,
cuatro de simulación. Todos se pueden hacer por separado y cada uno se puede revertir sin los otros.

## Specs

- **S1 — El interruptor del arte, a mano.** Hace falta un botón visible que saque y vuelva a poner la
  capa de píxel sin recargar la página (recargar perdería la partida sin guardar). El botón dice si la
  capa está puesta (`aria-pressed`), y al cambiarla el mapa se redibuja entero en el acto. El parámetro
  `?pixel=` sigue mandando en el arranque; el botón lo pisa mientras dure la sesión.
  Verbatim: «Un botón accesible para sacar la capa actual de forma rapida.»

- **S2 — La herramienta elegida se marca con el borde, no con el fondo.** Hoy la herramienta
  seleccionada se pinta con el fondo dorado y el hover con verde, así que al pasar por arriba de la
  línea de colectivos el botón se pone verde y después queda de otro color. La selección pasa a ser
  **sólo borde** (y el hover sólo borde también): el relleno no cambia, y el color propio de la
  herramienta —el de la línea de colectivos, por ejemplo— se sigue viendo siempre.
  Verbatim: «con los colectivos en un momento se pone en verde y luego queda en el color seleccionado,
  la selección que sea con el borde solo como indicando que está seleccionado.»

- **S3 — El roguelike muestra lo ya elegido y explica la administración.** La ventana de mejoras
  lista las mejoras anteriores, en orden, con lo que hizo cada una (incluido el resultado de las que se
  sortean). Y cada vez que una tarjeta habla de la administración, la ventana explica **qué es**
  (sueldos, oficinas y trámites) **sin decir cuánto cuesta hoy**, porque el número cambia solo y la
  explicación tiene que servir siempre.
  Verbatim: «En el roguelike estaria bueno ver las mejoras anteriores, además que SIEMPRE que se diga
  administración EXPLIQUE que es, pero que NO diga cuanto cuesta actualmente.»

- **S4 — La meta de la run son 500.000 habitantes.** `RUN_GOAL` pasa a 500.000, las marcas del mazo se
  reacomodan para no pasar la meta y todos los textos que decían «un millón» dicen la meta nueva.
  Verbatim: «Bajar en el roguelike el objetivo a 500k, no un millon de habitantes.»

- **S5 — La línea de colectivos alivia lo que cabe en sus colectivos, no un porcentaje del tránsito.**
  Hoy el alivio es una fracción multiplicativa del tránsito de la zona: con dos o tres líneas se llega
  al techo del 60 % y cualquier congestión desaparece, por más grande que sea. Pasa a ser una
  **cantidad de viajes** que la línea se lleva de las calles de su zona, repartida entre ellas: cinco
  líneas juntas suman cinco veces esa capacidad, y una avenida congestionada sigue congestionada si el
  tránsito es mayor. La capacidad de una línea sube un poco para compensar. El área no cambia: sigue
  siendo el rombo de `BUS.radius` alrededor de la cochera.
  Verbatim: «Que los colectivos SOLO afecten en el area que tienen, es decir que si tengo ahora un area
  muy congestionada, poner 5 lineas de colectivo juntas no lo deberia solucionar, quizá aumentar un poco
  lo que mejora el alivio de transito para compensar un poco.»

- **S6 — El botón derecho no hace nada.** El menú del navegador no aparece en ninguna parte del juego,
  ni sobre el mapa ni sobre los paneles. Arrastrar con el botón derecho para mover la vista sigue
  funcionando como siempre.
  Verbatim: «Bloquea la función del botón derecho.»

- **S7 — El mensaje de la calle nombra las dos salidas.** Cuando una calle no se puede trazar, el
  mensaje dice que tiene que salir de la ruta **o de otra calle**, que es lo que la regla permite: una
  calle que sale de otra calle conectada a la ruta se acepta.
  Verbatim: «Cuando vas a poner una calle en el juego te sale que tiene que estar saliendo de una ruta,
  estaria bien que diga que a una ruta u otra calle.»

- **S8 — El Calvario se mide contra el mapa, no contra un número fijo.** Hoy pide 10 niveles de altura y
  en los mapas bajos no se puede poner en ninguna parte. Pasa a pedir la altura de las zonas más altas
  del mapa menos un margen (`UNIQUE_RULES.calvario.margin`), así que siempre hay un rango donde entra y
  sigue estando en lo alto. El texto de la herramienta y el rechazo dicen la regla nueva.
  Verbatim: «Que el calvario (Edificio especial) verifique su posición segun el mapa, tiene que estar en
  las zonas mas altas (con un margen para permitir un rango de colocación bueno).»

- **S9 — La ficha de consulta se cierra al primer clic.** Mientras la ficha está abierta, cualquier
  actualización del HUD reescribe su HTML y cambia el botón de cerrar por otro: el clic se pierde y hay
  que insistir. La ficha se arma una sola vez por celda consultada y el cierre se escucha en el
  contenedor, que no se reemplaza.
  Verbatim: «A veces cuando usas el "consultar" el cartel que aparece no se puede cerrar, necesita
  varios clicks.»

- **S10 — Demoler enoja de verdad.** Hoy el enojo es lineal en la gente afectada y tiene un techo de 15
  puntos, así que tirar diez torres en una ciudad grande mueve la aprobación un par de puntos. Pasa a
  ser **cuadrático** en la gente afectada (una mudanza forzada de muchos se vuelve noticia), el techo
  sube, y la aprobación **baja en el acto** una parte del golpe en vez de esperar el paso mensual.
  Verbatim: «me gustaria que veamos una forma de hacer que demoler ENOJE bastante a la población [...]
  unas 10 casillas de edificios altos de departamento y se generó enojo, pero su aprobación casi no
  bajó, algo de esa magnitud deberia dejarlo muy abajo, habra sacado a no se, 500 personas? motivo
  suficiente.»

- **S11 — Los comercios no piden escuela: piden gente educada.** Hoy el comercio no pasa de nivel 3 sin
  una escuela en la puerta, igual que una casa. El comercio deja de mirar la cobertura de educación de
  su propio lote: lo que lo deja crecer es que **la ciudad tenga gente educada** —la parte de la
  población que vive con escuela cerca—, y eso se mide una vez para toda la ciudad. El tope por
  universidad del comercio y de la industria no cambia.
  Verbatim: «Tambien que los comercios no pidan de educación, la educación se pide en Residencia y que
  haya gente educada es lo que permite que los comercios mejoren.»

## Tasks

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | Botón de la capa de píxel en el menú, con redibujo inmediato | S1 | `src/render/artSwitch.ts`, `src/game.ts`, `index.html`, `src/ui/style.css` | |
| T2 | Selección y hover de la barra: sólo borde | S2 | `src/ui/style.css` | |
| T3 | La ventana de mejoras lista las anteriores y explica la administración sin el costo | S3 | `src/ui/upgrades.ts` | |
| T4 | Meta de 500.000 y marcas reacomodadas | S4 | `src/sim/roguelike.ts`, `src/game.ts`, `src/ui/upgrades.ts` | |
| T5 | Colectivos por capacidad de viajes, no por porcentaje | S5 | `src/config.ts`, `src/sim/transit.ts`, `src/sim/congestion.ts` | |
| T6 | El botón derecho no abre el menú del navegador | S6 | `src/main.ts`, `src/input/controls.ts` | |
| T7 | El rechazo de la calle nombra la ruta y la otra calle | S7 | `src/world/tools.ts` | |
| T8 | El Calvario se mide contra la altura del mapa | S8 | `src/config.ts`, `src/world/uniques.ts`, `src/world/tools.ts` | |
| T9 | La ficha de consulta se cierra al primer clic | S9 | `src/game.ts` | |
| T10 | Demoler enoja: cuadrático, con techo alto y golpe inmediato | S10 | `src/config.ts`, `src/sim/politics.ts`, `src/sim/simulation.ts` | |
| T11 | El comercio crece con la gente educada de la ciudad | S11 | `src/sim/demand.ts`, `src/sim/simulation.ts`, `src/sim/report.ts` | |

## Log

- **L1.** Pedido original, verbatim:
  > Bien, antes de terminar con los diseños, quiero hacer unos pequeños cambios:
  > -Un botón accesible para sacar la capa actual de forma rapida.
  > -No se si es cuando seleccionas o pones el mouse encima pero con los colectivos en un momento se
  > pone en verde y luego queda en el color seleccionado, la selección que sea con el borde solo como
  > indicando que está seleccionado.
  > -En el roguelike estaria bueno ver las mejoras anteriores, además que SIEMPRE que se diga
  > administración EXPLIQUE que es, pero que NO diga cuanto cuesta actualmente.
  > -Bajar en el roguelike el objetivo a 500k, no un millon de habitantes
  > -Que los colectivos SOLO afecten en el area que tienen, es decir que si tengo ahora un area muy
  > congestionada, poner 5 lineas de colectivo juntas no lo deberia solucionar, quizá aumentar un poco
  > lo que mejora el alivio de transito para compensar un poco (Por las dudas revisá si no funciona ya asi)
  > -Bloquea la función del botón derecho
  > -Cuando vas a poner una calle en el juego te sale que tiene que estar saliendo de una ruta, estaria
  > bien que diga que a una ruta u otra calle.
  > -Que el calvario (Edificio especial) verifique su posición segun el mapa, tiene que estar en las
  > zonas mas altas (con un margen para permitir un rango de colocación bueno), ya que si tiene una
  > altura X, en algunos mapas no se puede colocar.
  > -A veces cuando usas el "consultar" el cartel que aparece no se puede cerrar, necesita varios clicks
  > -Y me gustaria que veamos una forma de hacer que demoler ENOJE bastante a la población, a que me
  > refiero? por ejemplo vi a un amigo jugar y el quizo armar una avenida entonces unas 10 casillas de
  > edificios altos de departamento y se generó enojo, pero su aprobación casi no bajó, algo de esa
  > magnitud deberia dejarlo muy abajo, habra sacado a no se, 500 personas? motivo suficiente.
  > -Tambien que los comercios no pidan de educación, la educación se pide en Residencia y que haya
  > gente educada es lo que permite que los comercios mejoren
- **L2.** S5 revisado antes de tocar nada, como pidió: los colectivos **ya** son de área (rombo de
  `BUS.radius` = 9 alrededor de la cochera, nada fuera de ahí) y ya suman de forma multiplicativa. Lo que
  no funciona es el techo: dos líneas dan 0,58 de alivio y tres tocan el techo de 0,6, y como el alivio
  es un porcentaje, ese 0,6 borra cualquier congestión por grande que sea. El problema no era el área,
  era la forma del alivio.
