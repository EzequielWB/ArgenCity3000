# Ruta provincial: de dónde se arranca y por dónde llega la gente

Objetivo: que en los mapas inventados la ciudad crezca desde una ruta que entra por un borde, y que el tránsito venga de ella.
Rama: `feat/vertical-slice` · Entrega: commits por unidad en la rama; push solo cuando el usuario lo pida · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit`

## Specs

- **S1 — Pedido (verbatim):** "siempre en uno de los bordes de la zona de donde se juega haya una "ruta" provincial (que no se puede tocar) y de ahí se arranca a jugar, solo de ahí se puede construrir. Claramente que si el mapa tiene salida al mar esa ruta no esté en la salida al mar."
- **S2 — Aclaraciones del usuario (verbatim):** "No no, si es un mapa real no se toca nada, solo en los mapas comunes. Con solo ahi se puede construir me refiero a que al arrancar con una calle, solo ahi se puede colocar, eso para evitar que se arranque en medio del mapa y los autos salgan de cualquier lado, la idea es que el transito viene de la ruta como gent que llega nueva".
- **S3 — Reglas (supuestos del padre, a revisar jugando):**
  - **Dónde:** solo en los mapas inventados (los cuatro tipos y los tres tamaños). Los mapas reales y las partidas guardadas antes de este cambio no tienen ruta y siguen exactamente como hoy, sin ninguna restricción.
  - **Qué es:** una franja de 2 casilleros de ancho (una mano en cada sentido) que corre recta a lo largo de un borde del mapa, a un casillero del borde. Es una calle común (`TILE.ROAD`) marcada en un arreglo nuevo `World.route` (1 en las celdas de la ruta; se guarda). Así el acceso a calles, la congestión, el dibujado de avenidas y los puentes funcionan sin cambios. Cruza el agua con puente.
  - **Qué borde:** el que tiene menos agua en su franja y en los casilleros pegados a ella. Si hay varios sin nada de agua, uno según la semilla del mapa (la misma semilla da la misma ruta). En un mapa con salida al mar nunca queda sobre la costa. Es una función pura y probada (`chooseRoute` o similar).
  - **Intocable:** la topadora no la demuele, ninguna herramienta la reemplaza, el nivelado de manzanas no la mueve, y deshacer no la afecta. El cartel dice por qué ("La ruta provincial no se toca").
  - **Gratis:** no paga mantenimiento, tampoco en los tramos de puente.
  - **Solo desde la ruta:** con una ruta en el mapa, una calle o puente nuevo solo se puede colocar si toca (por un costado, no en diagonal) la ruta, una calle ya conectada a ella, o la celda anterior del mismo trazado ya aceptada. Si no, esa celda se rechaza y el cartel dice "Las calles tienen que salir de la ruta". "Conectada" es alcanzable desde la ruta por celdas de calle en el momento de planear. Lo demás no cambia: zonas y servicios siguen necesitando una calle a 3 lotes para crecer, y usinas, tendido y plazas se colocan donde se quiera.
  - **El tránsito viene de la ruta:** los autos decorativos nacen en las celdas de la ruta (la cantidad sigue dependiendo de la densidad de la ciudad, como hoy) y se meten por las calles; sin ruta, todo como ahora.
  - **Arranque:** la cámara empieza mirando el medio de la ruta; el aviso de bienvenida dice que se empiece con una calle que salga de la ruta; la ficha de consulta de una celda de la ruta dice qué es y que por ahí llega la gente nueva. La ruta se ve distinta de una calle: asfalto más oscuro, línea central amarilla continua y, cada tanto, un cartel verde de ruta ("RP"); también tiene color propio en el minimapa.
  - **Guardado:** formato 8 con `route` (arreglo de bytes); las partidas 1 a 7 abren sin ruta.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Ruta provincial en los mapas inventados | S1, S2, S3 | delegado (writer I: respaldo de contexto del padre; empieza cuando termina el writer H de la costa, que toca los mismos archivos) | pendiente | — |

## Log

- **L1 (2026-11-13), pedido original (verbatim):** "Otra cosa que me gustaria cambiar y no se que tan complicado es que siempre en uno de los bordes de la zona de donde se juega haya una "ruta" provincial (que no se puede tocar) y de ahí se arranca a jugar, solo de ahí se puede construrir. Claramente que si el mapa tiene salida al mar esa ruta no esté en la salida al mar."
- **L2 (2026-11-13):** se contestó que es de dificultad media y se preguntó a qué cosas aplicar "solo de ahí"; el usuario aclaró (S2): solo mapas inventados, y lo que importa es que se arranque desde la ruta y que el tránsito venga de ella. Se tomó la opción "solo a las calles" propuesta por el padre, que coincide con lo que el usuario describió.
- **L3 (2026-11-13):** decisión técnica: en vez de un casillero nuevo, la ruta es una calle común más una marca guardada, porque así todo lo que ya funciona sobre calles (acceso, congestión, avenidas, puentes, tránsito) queda igual. El costo es un arreglo más en el guardado.
