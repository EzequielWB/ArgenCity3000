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
- **S7 Fuera de alcance, nada.** Lo que no se dibuja: tramos diagonales (el poste tiene cruceta y el
  cable va por los ejes; una diagonal en isométrico se leería como un cable metido en la esquina) y
  cables del poste a la planta (la planta alumbra sola, su radio se ve en la capa de energía).

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Regla de alcance y bloqueo, sin canvas | S3, S4 | `src/render/wire.ts` | hecho | `tests/wires.test.ts` (10): tramos de 1 a 3, fuera de alcance, edificio en el medio, planta/servicio/lote construido, cruce de calle y plaza |
| T2 Dibujo de los tramos y comba por distancia | S5, S6 | `src/render/mapRenderer.ts` (`drawWires`) | hecho | capturas 28 y 29: postes cada 2 y 3 celdas con el cable tendido |
| T3 Lo que queda afuera queda escrito | S7 | este documento | hecho | S7 |

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
