# Gráfico unificado: el píxel se queda, el canvas viejo se va

## Specs

- **S1.** El juego se ve siempre con el arte de píxel. No hay interruptor, ni `?pixel=`, ni botón.
  Verbátim: *«unificar lo grafico (me refiero a que dejes lo nuevo grafico, lo anterior lo saques)»*.
- **S2.** Lo que el píxel todavía no cubre (los 10 únicos y el puerto, el balneario y el faro de la
  costa) se queda como está, en canvas: *«lo que falta por hacer despues lo seguimos»*. No se toca ni
  se rompe.
- **S3.** El código del arte viejo que ya no se usa **se borra**, no queda colgado detrás de una
  condición que nunca se cumple.
- **S4.** Nada visible cambia respecto de hoy con la capa encendida: mismas piezas, mismos colores,
  mismos tamaños. El diff es de código muerto, no de dibujo.
- **S5.** `main` recibe todo con merge (fast-forward: la rama está 29 adelante y 0 atrás).

Checks: `npx tsc --noEmit` limpio · `npx vitest run` verde · `npm run arte` sigue generando el tablero ·
una captura del mapa de la ciudad igual a la de antes del cambio.

## Tasks

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | Sacar el interruptor: el píxel pasa a ser el único camino | S1 | `src/render/artSwitch.ts`, `src/render/mapRenderer.ts`, `src/render/sprites.ts`, `src/render/traffic.ts`, `src/render/vessels.ts`, `src/game.ts`, `src/main.ts`, `index.html`, `tests/artswitch.test.ts`, `tests/vehiculos-pixel.test.ts` | `0c7bf12` |
| T2 | Borrar los pintores de canvas que quedaron sin uso | S3 | `src/render/sprites.ts` | `0c7bf12` |
| T3 | Textos: tablero de arte, README y ayuda sin `?pixel=` | S1 | `scripts/arte-board.ts`, `scripts/board-city.ts`, `src/render/pixelArt.ts`, `README.md` | `0c7bf12` |
| T4 | Verificar y llevar a `main` | S4, S5 | — | |

## Log

- **L1.** Pedido verbátim: *«Bien, queres aprovechar, unificar lo grafico (me refiero a que dejes lo
  nuevo grafico, lo anterior lo saques y lo que falta por hacer despues lo seguimos) y pushear a main
  los cambios?»*.
- **L2.** `main` está 29 commits atrás y 0 adelante, así que el merge es fast-forward: no hay nada que
  reconciliar ni riesgo de pisar trabajo de la otra rama.
- **L3.** Qué queda en canvas a propósito: `port`, `resort` y `lighthouse` de `coastSprite`, y los 10
  de `uniqueSprite`. Todo lo demás tiene su versión en píxel, así que su pintor viejo se borra.
- **L4.** `noUnusedLocals` hizo de árbitro en las dos tareas: cada bloque borrado que dejaba un helper
  o una constante sin uso aparecía en `tsc --noEmit`, y se siguió borrando hasta que el compilador
  quedó limpio. Así se fueron también `WALLS`, `ROOFS`, `AWNINGS`, `EDGES`, `inset`, `lamp`, `blob`,
  `SIDES`, `inOrder` y el tipo `Op`.
- **L5.** `rectPainter` se salvó del borrado: lo borré con el resto del aeropuerto y `tsc` avisó que
  los diez únicos y los tres edificios de costa lo usan. Volvió con su comentario.
- **L6.** `coastSprite` quedó sin los casos `promenade` y `fishing` —el mapa los dibuja en píxel antes
  de llamarlo— y tira un error si le piden algo que no sea `port`, `resort` o `lighthouse`: un `default`
  que grita es mejor que devolver `undefined` y que la costa desaparezca sin decir por qué.
- **L7.** Verificación: `tsc --noEmit` limpio · `vitest` **1112 / 65 archivos** (los 4 de `artswitch`
  y el del interruptor de vehículos ya no tienen sujeto) · `npm run arte` 171 kB (bajó de 191 al no
  llevar los canvas viejos) · `npm run board` 35 kB · la manzana de `arte.html?solo=city` se ve igual
  que antes, con usina, plaza, calle, tierra y tendido · la costa con sus 13 variantes de rambla y los
  4 muelles · el inicio del juego arranca sin errores en consola.
- **L8.** `sprites.ts`: 2.255 → 1.350 líneas. Lo que queda en canvas es lo que falta hacer: los 10
  únicos y puerto, balneario y faro.
