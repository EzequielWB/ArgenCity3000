# Sierras con altura de verdad

Los cordones del mapa «Sierras» se cortaban contra el techo del mundo y quedaban en meseta. Ahora
suben, se ven grises en la cresta, y el relieve se lee de lejos.

## Specs

- **S1** — El techo del mundo (`MAX_HEIGHT`) pasa de 12 a 18 niveles: hay lugar para que una cresta
  suba en vez de aplanarse. El agua sigue en `SEA_LEVEL = 3` y el lecho, plano, en 2.
- **S2** — El generador de la costa (el mapa de siempre) **no cambia**: trabaja contra su propia
  escala (`COAST_SCALE`) y su propio techo (`COAST_MAX = 12`), así que un mundo más alto no le toca
  ni un corner. Lo mismo la llanura. El relieve gana un nivel (llega a 13) porque ya estaba topado.
- **S3** — «Sierras» pasa a tener cordones: dos escalas de ruido de cresta (65 % / 35 %) en vez de
  una, bandas de montaña **angostas** con valles anchos entre ellas, y el piso del valle más parejo.
  Las crestas escalan con el techo del mundo (`MAX_HEIGHT - 1`), así que llegan a 15-18.
- **S4** — Arriba de `rockLine()` —el 62 % de la subida desde el mar, 12.3 niveles— el suelo es
  piedra: primero se apaga el verde, después se aclara hasta el gris claro de la cresta
  (`PAL.rock`, `PAL.rockLight`). La línea queda por encima del punto más alto del mapa costero, así
  que ese mapa conserva su verde de punta a punta.
- **S5** — Encima de la línea de piedra no crecen árboles: es roca pelada (`scatterTrees`).
- **S6** — El relieve se exagera a la vista: `HEIGHT_STEP` pasa de 8 a 12 px por nivel (+50 %). Es lo
  que hace que «más altura» se note en pantalla: la topografía es la misma, el dibujo es más vertical.
  Todo lo que se apoya en el terreno (edificios, puentes, postes, cables, selección) usa la misma
  constante, así que siguen calzando.
- **S7** — El minimapa y la vista previa de la pantalla de inicio acompañan: el degradé verde termina
  en `GROUND_TOP = 12` (el techo viejo, para que las tierras bajas no cambien de color) y arriba de la
  línea de piedra el pixel vira a gris.
- **S8** — `mix()` y `shade()` aceptan tanto `#rrggbb` como `rgb(r,g,b)`, así que el resultado de una
  mezcla puede entrar en otra. Antes, mezclar sobre una mezcla devolvía casi negro: la primera
  versión del degradé de piedra salió negra por eso.

## Tasks

| ID | Qué | Specs | Dónde | Commit |
| --- | --- | --- | --- | --- |
| T1 | Techo del mundo y perfil propio de cada generador | S1, S2 | `src/world/terrain.ts`, `src/world/mapkinds.ts` | `_` |
| T2 | Cordones de sierra: dos escalas, bandas angostas, valles anchos | S3 | `src/world/mapkinds.ts` | `_` |
| T3 | Piedra arriba de la línea, sin árboles | S4, S5 | `src/world/terrain.ts`, `src/render/mapRenderer.ts`, `src/render/minimap.ts`, `src/render/color.ts` | `_` |
| T4 | Exageración vertical | S6 | `src/core/iso.ts` | `_` |
| T5 | Mezcla de colores encadenada | S8 | `src/render/color.ts` | `_` |
| T6 | Pruebas: techos, cordón, piedra y árboles | S1–S5, S7 | `tests/mapkinds.test.ts`, `tests/terrain.test.ts` | `_` |

## Log

- **L1** — Pedido: «quiero que las sierras tengan mayor altura en las zonas, me refiero a que tenga
  sierras más marcadas en su altura».
- **L2** — El problema no era el generador sino el techo: `fillSierras` llegaba a 17 y se cortaba en
  12, así que las crestas se aplanaban en meseta. Subir `MAX_HEIGHT` a 18 fue la mitad del arreglo;
  la otra mitad fue que la costa no se entere: trabaja contra su propia escala y su propio techo.
- **L3** — Con el techo alto, las sierras seguían leyéndose como un domo suave: el ruido de cresta
  era uno solo y muy ancho, y la mediana de `smoothCorners` redondeaba todo. Dos escalas de cresta +
  bandas angostas + valles parejos dieron cordones con pie de sierra, que es lo que promete la
  tarjeta del mapa («cordones de montañas con valles anchos donde construir»).
- **L4** — Lo que más se nota no fue la altura en niveles sino **cuántos píxeles mide un nivel**:
  `HEIGHT_STEP` 8 → 12. Con el mismo terreno, el mapa pasó de "lomas con escalones" a sierras. Es un
  cambio global (también la costa se ve más vertical), y es una constante sola para volver atrás.
- **L5** — La piedra salió negra en el primer intento: `mix()` encadenado sobre el resultado de otra
  `mix()` (que ya es `rgb(...)`) se parseaba como hex y daba basura. Se arregló en la raíz —
  `toRgb()` acepta los dos formatos — y no en el llamador, porque el mismo error estaba latente en
  `scaleRgb` y en cualquier mezcla futura.
- **L6** — Verificación: 703 pruebas en verde, `tsc` limpio, `build` en 1,4 s, probe igual que antes
  (año 15 en 5.376 habitantes; el mapa de la costa no cambió). En el juego: «Sierras» con seed 3
  llega a 18 niveles con crestas grises y valles planos, la costa queda como estaba (sin piedra) y
  una calle trazada subiendo el cordón se apoya bien en las terrazas.
