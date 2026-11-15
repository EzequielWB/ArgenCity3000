# El cable del tendido, hasta donde llega la luz

El tendido eléctrico alumbra tres celdas a la redonda, pero el cable solo se dibujaba entre
celdas pegadas: el poste quedaba con el cable cortado en el aire aunque la luz pasara.

## Specs

- **S1 Pedido (verbatim).** "algo visual respecto al tendido eléctrico: actualmente este dibuja el
  cable cuando está uno al lado del otro, pero este tiene de 2 a 3 bloques de radio de electricidad.
  Me gustaría que si está dentro del rango también se dibuje el cable, básicamente... técnicamente
  funciona bien hoy pero visualmente no se dibuja el cable dentro del rango."
- **S2 Cómo funciona hoy.** `computePower` (`src/sim/power.ts`) recorre la red como un grafo: un
  poste alumbra todo el disco de `LINE_REACH` (3) celdas y cualquier celda alumbrada que sea
  repetidora —otro poste, una planta, un edificio, un servicio— sigue la cadena. O sea que dos
  postes a 2 o 3 celdas **ya son la misma red**; el dibujo (`drawWires`) solo miraba las dos celdas
  vecinas que se pintan antes.
- **S3 El cable va hasta el primer poste dentro del alcance, por cada lado.** Se camina cada uno de
  los dos lados que se dibujan (los que quedan atrás en el orden del dibujo) hasta `LINE_REACH`
  celdas: al primer poste se le tiende el cable, y se corta ahí. Nada de cables a todos los postes
  del disco: sería una telaraña.
- **S4 Un edificio en el medio corta el cable.** Si entre los dos postes hay una planta, un servicio
  o un lote construido, no se dibuja el tramo: la luz pasa por ese edificio (es repetidor), pero el
  cable no atraviesa la casa. Terreno, calle, plaza y agua se cruzan sin problema.
- **S5 Cada par de postes se dibuja una sola vez.** Se camina solo hacia atrás, así que de cada par
  el cable lo tiende el poste de adelante: no se duplica y ningún trozo pintado después lo tapa
  (el mismo criterio que ya usaba el código con las vecinas).
- **S6 La curva acompaña el tramo.** La comba era fija en 3 para un tramo de una celda; ahora crece
  `3 + 2 × (distancia − 1)`, así que un tramo de tres celdas cuelga como corresponde y el de una
  celda queda igual que antes.
- **S7 Fuera de alcance, nada.** Lo que no se dibuja: cables del poste a la planta (la planta alumbra
  sola, su radio se ve en la capa de energía).
- **S8 Las diagonales también se dibujan (verbatim).** "Tambien me gustaria que si está en diagonal se
  le dibuje el cable tambien". Esto da vuelta lo que decía S7 en su versión anterior, que dejaba las
  diagonales afuera porque el poste tiene cruceta y el cable va por los ejes. Ahora se caminan los
  cuatro lados que miran al fondo (los dos ejes y las dos diagonales), así que cada par de postes
  sigue tendiendo el cable una sola vez. Un paso diagonal es más largo que uno de eje: el tramo
  diagonal llega hasta donde llega la luz, o sea 2 celdas, porque un poste a 3 celdas en diagonal
  queda a 4,24 del otro, fuera del disco de `LINE_REACH` (3).
- **S9 El cable tiende dos hilos perpendiculares al tramo.** El corrimiento de ±4 px era siempre en X,
  así que un tramo horizontal o diagonal dibujaba el mismo cable dos veces encima. Ahora el
  corrimiento es perpendicular a la dirección del tramo: los tramos verticales quedan igual que
  antes y los horizontales y los diagonales muestran dos hilos.
- **S10 La recta aprovecha el alcance (verbatim).** "me gustaria que si yo hago una linea recta con
  el mismo, este se coloque de la forma mas eficiente posible, es decir aprovechando su rango para
  eso (cada 3 bloques uno)". Un arrastre recto ya no deja un poste por celda: deja el primero y
  después uno cada `LINE_REACH` celdas, medido en distancia real desde el último poste puesto. Las
  celdas del medio que no pueden tener poste (una zona, una calle) no corren el espaciado. Se cobra
  `COSTS.line` por poste, así que una recta larga cuesta cerca de un tercio de lo que costaba.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Regla de alcance y bloqueo, sin canvas | S3, S4 | `src/render/wire.ts` | hecho | `tests/wires.test.ts` (10): tramos de 1 a 3, fuera de alcance, edificio en el medio, planta/servicio/lote construido, cruce de calle y plaza |
| T2 Dibujo de los tramos y comba por distancia | S5, S6 | `src/render/mapRenderer.ts` (`drawWires`) | hecho | capturas 28 y 29: postes cada 2 y 3 celdas con el cable tendido |
| T3 Lo que queda afuera queda escrito | S7 | este documento | hecho | S7 |
| T4 Tramos diagonales y dos hilos perpendiculares | S8, S9 | `src/render/wire.ts`, `src/render/mapRenderer.ts` | hecho | `tests/wires.test.ts` (3 nuevos): diagonal a 2 celdas, los dos lados del fondo, y nada a 3 celdas en diagonal |
| T5 Un poste cada `LINE_REACH` en la recta | S10 | `src/world/tools.ts` | hecho | `tests/tools.test.ts` (4 nuevos): 0/3/6/9 en una recta de 10, un solo poste si entra en el alcance, ningún par a más de `LINE_REACH`, y el espaciado no se corre por una celda ocupada |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`.

## Log

- **L1 (2026-11-13), el desfase.** `drawWires` miraba `(vx-1, vy)` y `(vx, vy-1)` en coordenadas de
  vista y exigía `TILE.LINE` en la celda vecina. El motor, en cambio, conecta por un disco de 3:
  el dibujo era el que estaba mal, no la mecánica.
- **L2, por qué solo dos lados.** El dibujo va celda por celda en orden de vista; un cable tendido
  hacia adelante lo taparía el terreno que se pinta después. Caminar solo hacia atrás mantiene la
  regla vieja de "cada par una vez" y deja el cable arriba de todo.
- **L3, la regla quedó sin canvas.** Igual que `src/render/park.ts`, la decisión de a dónde va cada
  cable vive en `src/render/wire.ts` con tests: el renderer solo proyecta y pinta.

- **L4 (2026-11-19), las diagonales vuelven.** Pedido (verbatim): "Sabes que quiero hacer, fijate el
  tendido electrico, me gustaria que si yo hago una linea recta con el mismo, este se coloque de la
  forma mas eficiente posible, es decir aprovechando su rango para eso (cada 3 bloques uno). Tambien
  me gustaria que si está en diagonal se le dibuje el cable tambien". S7 queda reescrito por S8: el
  motivo viejo para dejarlas afuera (la cruceta del poste) no aplica más porque el dueño del juego
  pidió lo contrario. Se agregaron los dos lados diagonales que el orden de dibujo ya tenía pintados,
  `(-1,-1)` y `(+1,-1)`, y se dejó que el alcance del tramo salga de la misma cuenta que la luz
  (`d² · paso ≤ LINE_REACH²`), así un cable no se tiende nunca a un poste que la red no alcanza.
- **L5 (2026-11-19), la recta se abarata.** S10 cambia el costo de una recta: en una tirada de 10
  celdas pasan de 10 postes a 4. Un test viejo de `tests/report.test.ts` armaba un tramo de tres
  celdas para preguntar por la celda del medio; como esa celda ya no lleva poste, el test ahora arma
  uno solo y pregunta por él. Verificación: `npx tsc --noEmit` limpio y `npm test` con 870 tests en
  verde (863 antes, 7 nuevos).
