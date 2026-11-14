# Plazas y árboles: el redibujo

Los árboles y las plazas desentonaban con el resto del mapa. Se redibujaron para que hablen el
mismo idioma que los edificios.

## Specs

- **S1 Pedido (verbatim).** "Las plazas y arboles. Quiero cambiar como se ven actualmente ya que
  desentonan un montón, que opinas?" y, tras el diagnóstico: "Hace el cambio grande que planteas y
  lo vemos".
- **S2 El mismo idioma que los edificios.** Nada de elipses: los árboles se dibujan con facetas
  planas y los mismos tres valores de luz que las paredes (`TOP` 1, `LEFT` 0.84, `RIGHT` 0.64), con
  el borde fino oscuro que ya usan `box()` e `hipRoof()`. El tronco se dibuja en píxeles enteros,
  en tres columnas con tono claro, medio y oscuro.
- **S3 Dentro de la paleta del mundo.** Los verdes salen de la familia del terreno (`#436e3a`,
  `#7d9464`, `#6b4a2e`). El jacarandá sigue siendo lila, pero apagado (`#8c7fae` en vez de
  `#8e6cc2`) y el palo borracho pasa a rosa apagado (`#c98ba8` en vez de `#d97aa3`). El agua de la
  fuente usa la del juego (`PAL.water`), no un celeste propio.
- **S4 Una sola escala.** El mismo dibujo para el árbol suelto, el de la plaza y el de al lado de
  una casa. Se van los 0,7 / 0,75 / 0,8: queda un plantín de 0,75 junto a las casas de un piso y
  adultos de 0,9 a 1,1 en el resto.
- **S5 La plaza es un lugar, no un monumento suelto.** El suelo no se toca: ya está bien (diamante
  `PAL.park` con dos caminos cruzados, `drawPark`). Lo que cambia es lo que está arriba: el árbol
  pasa al vértice de atrás del rombo, la pieza queda adelante y a escala humana (el obelisco de
  20 px, más alto que un chalet de dos pisos, es ahora un busto de bronce sobre base de piedra de
  9 px), la fuente deja de ser una elipse y pasa a pileta facetada, y la variante de la fuente suma
  un banco. Las otras dos no llevan banco: en una celda de 32 px, tres objetos no entran.
- **S6 Nada más se mueve.** Misma API (`tree`, `crown`, `post`, `bench`, `treeSpriteFor`,
  `parkSpriteFor`), mismas claves de caché, mismas anclas, mismos tamaños de lienzo y la simulación
  ni se entera.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Copas facetadas y tronco en píxeles | S2, S3, S4 | `src/render/sprites.ts` | hecho | los cuatro árboles comparados a 7x contra las casas |
| T2 Plazas a escala humana | S5 | `src/render/sprites.ts` | hecho | busto de 9 px, pileta facetada, banco junto al camino |
| T3 Verificación en el mapa | S6 | navegador | hecho | plazas plantadas con la herramienta 8 y miradas en el mapa, sin errores de consola |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`.

## Log

- **L1, el diagnóstico (pedido de opinión).** Cinco causas concretas: (1) `blob()` era `ellipse` con
  `stroke` de 0,5 px, la única forma blanda de un mundo de facetas; (2) el tronco medía
  `fillRect(x - 0.8, …, 1.6, …)`: ancho sub-píxel; (3) lila `#8e6cc2` y rosa `#d97aa3` no existen en
  ningún otro sprite y son los píxeles más brillantes del mapa; (4) el mismo árbol a 0,7, 0,75-0,8
  y 0,9-1,1; (5) el obelisco de la plaza llegaba a 20 px contra 12 de pared de un chalet.
- **L2, corrección del padre.** En el diagnóstico dije que la plaza no tenía suelo tratado. **Falso**:
  `drawPark` ya pinta el diamante en `PAL.park` con dos caminos cruzados en `PAL.path`. El problema
  no era el suelo, era lo que se apoya arriba.
- **L3, la luz.** Los edificios usan `TOP` 1, `LEFT` 0.84 y `RIGHT` 0.64: la cara que mira a `+v` es
  más clara que la que mira a `+u`. La copa reparte sus ocho facetas con esa misma regla (factor
  `0,86 + 0,2 · facing + 0,08 · banda`, con `facing` de -1 a 1), y los anillos de arriba son más
  claros, así que la luz viene del mismo lado que en las paredes.
- **L4, tres intentos hasta que la copa leyó.** (1) Una sola corona de anillos → cono: los árboles
  parecían pinos. (2) Tres anillos (`0 → 0,78`, `0,42 → 1`, `0,82 → 0,5` de radio) → copa con
  hombros. (3) El borde de cada faceta a `shade 0,4` armaba una malla oscura, se subió a `0,58` y
  se aclaró el rango de caras.
- **L5, dos árboles por plaza no entran.** Con dos árboles y una pieza, la celda de 32 px queda
  tapada y la fuente no se ve: quedó uno, en el vértice de atrás (`u 0,1 / v 0,6`), con la pieza
  adelante. El banco va solo en la variante de la fuente.
- **L6, el eucalipto.** Con tronco de 13 px y corona chica se leía como un poste blanco: el tronco
  bajó a 8 px, se apagó a `#b3a78c` y la copa se agrandó (dos masas, `z 6` y `z 13`).
- **L7, verificación.** 569 tests verdes, `tsc` limpio, build, y las plazas plantadas en el juego
  real con la herramienta de plazas (tecla 8) y miradas en el mapa a 2x, sin errores de consola.
  Los sprites no se pueden probar con Vitest: `sprites.ts` pide `document.createElement('canvas')`
  y el proyecto no tiene DOM en los tests. La verificación de esta feature es visual, y está dicha.
  Un tropiezo propio: un reemplazo con script se comió las funciones que estaban entre `parkSprite`
  y `parkSpriteFor`; se restauró esa región desde `HEAD` (`git show`) antes de seguir.
