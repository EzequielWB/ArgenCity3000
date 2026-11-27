# Revisión mobile: radio, escala de interfaz y barra de herramientas

## Specs

- S1 (verbatim): «Vi que la radio no es apta para mobile, mas que nada por que no se ve la queja de los vecinos si la expandis.»
- S2 (verbatim): «además me gustaria que la interfaz sea un 90% de lo que es ahora»
- S3 (verbatim): «además que la barra de abajo se note (heuristica) que se puede desplazar a la derecha»

Hallazgos de la revisión (iframe de 390px, layout mobile activo):

- El desplegable de la radio mide 520px en un viewport de 390px (x=222, derecho en 742): `min-width: 520px` le gana a `max-width` y la lista de quejas queda afuera de pantalla a la derecha. Reproducido con 28 quejas reales.
- La barra de herramientas inferior (`#toolbar`, `overflow: auto hidden; scrollbar-width: none`) se desplaza de costado sin ninguna señal: sin scrollbare sin flecha.
- No hay escala: la interfaz mobile es igual de grande que la de escritorio.

## Tasks

- M1 — Radio apta para mobile: `src/ui/style.css` (en ≤950px el desplegable pasa a `position: fixed`, de borde a borde, `min-width: 0`, alto limitado con scroll) + `src/ui/radio.ts` (al abrir, anclarlo justo debajo del gabinete medido en vivo). Commit: pendiente.
- M2 — Interfaz al 90%: `src/ui/style.css` (en el layout de teléfono, `zoom: 0.9` sobre `#app` con `height: calc(100dvh / 0.9)` para no dejar hueco). Commit: pendiente.
- M3 — Heurística de desplazamiento: `src/ui/style.css` (pistón pegajoso con flecha `›` al borde derecho de `#toolbar`) + `src/ui/toolbar.ts` (clase `end` cuando no queda nada a la derecha; chequeo al inicio y en resize). Commit: pendiente.

## Ronda 2 (pedido verbatim)

- R1 (verbatim): «El menu de la radio deberia verse por encima de lo del diario, sino queda raro, y la flecha de abajo del menu deberia quedar por encima y nada pasarla, tambien queda raro»
- R2 (verbatim): «los menu como el preguntar si quiero tutorial, milestones, feriados, etc... ocupan TODO el espacio y no es necesario, en todo caso quedaria bien que simplemente fuera un cartel por encima donde atrás esté lo demas oscurecido y listo (asi con cada tipo de prompt de este estilo)»

Correcciones (todo en `src/ui/style.css`):

- R1-radio: la causa era el apilado — `#btnDiario` (z 6 en mobile) vive en `#stage` sin contexto de apilado propio, así que quedaba por encima de todo `#topbar` (z 2), y el desplegable (z 60) estaba atrapado dentro del contexto del topbar. Fijo: `#topbar { z-index: 8 }` en ≤900px, por encima del diario (6) y de su hoja (7); los modales siguen arriba (z 10).
- R1-flecha: `#toolbar::after` ahora con `z-index: 1` — ningún botón pasa por debajo de ella.
- R1-flecha-2 (tercera ronda): el pistón tenía un degradado transparente al 55 %, así que el botón de transporte asomaba a través y parecía seguir más allá de la flecha. Ahora es opaco (`deep → base`, con filo de `gold-dark` a la izquierda): los botones se cortan en la flecha y es visualmente el fin de la barra.
- R1-flecha-3 (cuarta ronda): aún así, en el entorno del usuario los botones seguían pasando por debajo/detrás de la flecha: `position: sticky` dentro del contenedor con `overflow-x: auto; overflow-y: hidden` no ancla confiablemente (falla conocida de Safari). Cambio estructural: `src/ui/toolbar.ts` envuelve todo el contenido de la barra en `.bar-row` (en escritorio `display: contents`, así la columna no cambia) y en teléfono la FILA es la que scrollea mientras `#toolbar` queda quieto; la flecha pasa a `position: absolute; right: 0` sobre la barra — anclada siempre al borde, en cualquier motor. El detector de fin de desplazamiento (`onScroll`) ahora lee `.bar-row`.

Verificación (iframe 390px + tab escritorio):

- Mobile: a mitad de desplazamiento el pistón queda pegado al borde derecho (`right: 0`, `position: absolute`), opaco — el recorte del pantallazo muestra los botones cortados en la flecha y nada asoma del otro lado; al final del desplazamiento la flecha se apaga (`content: ''`, clase `end`) y al volver reaparece.
- Escritorio: la columna de categorías se ve exactamente igual (Consulta, Calles y luz, Zonas… Deshacer) — `display: contents` mantiene a los botones como hijos directos del flex de columna.
- `npx tsc --noEmit` limpio; suite 1473 tests / 103 archivos en verde.

Nota de proceso (L3): la primera edición del wrapper de `innerHTML` se perdió junto con un lote rechazado por solapamiento de edits — quedó un `querySelector('.bar-row')` sobre un DOM sin wrapper y el arranque del juego reventaba en el constructor de Toolbar. Detectado porque la barra aparecía vacía y los modales no abrían; corregido aplicando el wrapper aparte. Lección: cuando un lote de edits se rechaza, verificar que CADA edición del lote se haya re-aplicado.
- R2: el bloque de teléfono forzaba la tarjeta a `height: 100dvh` ancho completo. Ahora `width: min(540px, 100%)`, `height: auto`, tope de alto con scroll, y `#modal` con `padding: 16px 10px`: cartel de contenido con el fondo oscurecido (el velo `rgba(0,0,0,.62)` ya existía).

Verificación en vivo (iframe 390px): tarjeta de tutorial de 370×197 centrada con velo oscuro (antes ocupaba toda la pantalla); `elementFromPoint` sobre el botón del diario con la radio abierta cae dentro del desplegable (el diario queda debajo); topbar z 8; flecha sticky z 1.

Verificación (todo en iframe de 390px, layout de teléfono activo):

- Radio: desplegable de 372px de ancho en un viewport de 390, sin desborde derecho ni inferior; 28 vecinos · 1 barrio con la queja completa a la vista.
- Zoom: `#app` ocupa todo el viewport (973px de 973) con zoom 0.9; apuntar a la celda [0,64] junto a la ruta y hacer clic construyó la calle exactamente ahí (caja 30.000 → 29.990) — puntero alineado.
- Flecha: `›` visible al inicio, se apaga (`''`) al llegar al final del desplazamiento y vuelve al volver.
- `npx tsc --noEmit` limpio; suite 1473 tests / 103 archivos en verde.

## Log

- L1 (verbatim): «Lo quiero como un colchón para que el jugador nuevo tenga mas espacio a cometer errores con el manejo de la caja hasta que se afiance. Quiero hacer una revisión ahora de lo que es el juego en mobile. Vi que la radio no es apta para mobile, mas que nada por que no se ve la queja de los vecinos si la expandis. Además me gustaria que la interfaz sea un 90% de lo que es ahora? además que la barra de abajo se note (heuristica) que se puede desplazar a la derecha»
- L2: el subsidio de S1 se tomó como justificación del telegrama ya implementado (odd/tasks/beneficio-provincial.md); esta tarea es la revisión mobile.
