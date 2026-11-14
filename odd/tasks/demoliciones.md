# Demoliciones: el barrio se enoja

Demoler hoy solo cuesta plata. Al que se le tira la casa abajo no le pasa nada, así que abrir una
avenida a costa de doce viviendas sale gratis en votos. Se le pone un enojo que se enfría solo.

## Specs

- **S1 Pedido (verbatim).** "si demoles un edificio ya construido, este genere un malestar y si
  demoles varios (Por ejemplo al querer expandir una calle y eliminas residencias o comercio) esto
  genera una baja temporal de aceptación y si es residencia baje un poco la población (creo que eso
  ya está implementado) o algo así." Aprobado con "Si me parece bien por ahora, mas que nada para
  que afecte en algo".
- **S2 La población ya baja sola.** La población es la suma de habitantes de los edificios
  ocupados: `refresh()` recalcula `cityTotals` después de cada plan, así que tirar una vivienda de
  nivel 3 saca 60 vecinos del contador en el acto. No hay nada que agregar ahí.
- **S3 Cuánto enoja.** Se mide **antes** de aplicar el plan, celda por celda, y se suma a un solo
  número de "afectados":

  | Qué se lleva puesto | Afectados |
  |---------------------|-----------|
  | Vivienda ocupada | 1 por habitante (`CAPACITY.R[nivel]`) |
  | Comercio o industria ocupada | 0,5 por puesto de trabajo |
  | Obra pública (servicio o costa) | 200 |
  | Usina | 250 |
  | Ruina abandonada, incendio, lote vacío, calle, plaza | 0 |

  La ruina y el incendio no enojan: demoler eso es sacarse un problema de encima.
- **S4 Cuánto resta en la aprobación.** `puntos = 250 × afectados / max(1000, población)`, con tope
  de 15. Dividir por la población es lo que hace que una metrópoli no se caliente por una casa y un
  pueblo sí:

  | Caso | Puntos |
  |------|--------|
  | 1 casa de nivel 2 (20 vecinos) en un pueblo de 300 | −5 |
  | 12 casas (240 vecinos) en una ciudad de 5.000 | −12 |
  | Lo mismo en una ciudad de 50.000 | −1 |
  | Una escuela demolida en 5.000 | −10 |
  | Cualquier cosa | nunca más de −15 |
- **S5 Es temporal.** Cada mes el enojo se multiplica por 0,5 (hacia abajo) y abajo de 1 se va a
  cero: los puntos bajan a la mitad cada mes, así que se siente dos o tres meses y a los ocho ya no
  queda nada. No se guarda ningún historial, solo el número.
- **S6 Dónde se engancha.** `Simulation.noteDemolition(celdas)` mira el mundo antes de que el plan
  lo toque. Lo llama el juego en el único punto donde el jugador aplica un plan, con **cualquier**
  herramienta: no solo la topadora (mañana sirve igual para otras). El *undo* y el paso del tiempo
  no pasan por ahí, así que deshacer no enoja a nadie.
- **S7 Se ve.** El factor `Demoliciones` aparece en el modal de aprobación mientras dura y se va
  solo; el modal explica en palabras que demoler algo construido cuesta unos meses de aprobación; un
  aviso al demoler dice cuántos quedaron sin casa; y el diario titula cuando el enojo pasa los 5
  puntos y cuando se enfría.
- **S8 Guardado.** Formato 12. Un guardado viejo abre con el enojo en 0 y no cambia nada más.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Medir lo demolido y guardarlo | S3, S5 | `src/config.ts` (`DEMOLITION`), `src/sim/simulation.ts` (`state.grief`, `noteDemolition`) | hecho | `tests/demoliciones.test.ts`: residentes enteros, empleos a la mitad, obra 200, usina 250 contada una sola vez por sus 4 celdas, ruina/incendio/vacío 0 |
| T2 Restarlo de la aprobación | S4 | `src/sim/politics.ts` (`demolitionPoints`, factor) | hecho | 20 vecinos en un pueblo de 300 = −5; 240 en 5.000 = −12; 240 en 50.000 = −1; tope −15 |
| T3 Llamarlo desde el juego, sin el undo | S6 | `src/game.ts` | hecho | el enojo se cuenta antes del `applyPlan` y el `undo` va por `history.undo`, que no pasa por ahí |
| T4 Aviso, modal y diario | S7 | `src/game.ts`, `src/ui/panels.ts`, `src/sim/news.ts` | hecho | en juego: aviso "Demolición: 250 vecinos afectados" y factor "Demoliciones −15" en el modal (capturas 34 y 35); el diario titula al cruzar los 5 puntos y al enfriarse |
| T5 Formato 12 | S8 | `src/save/save.ts` | hecho | preserva el enojo, un guardado del 11 abre en 0, rechaza negativos |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`.

## Log

- **L1 (2026-11-13), lo que había.** Demoler cuesta `$2 + $10 por nivel` y nada más: no hay una sola
  mención de demoliciones en `politics.ts` ni en `news.ts` (verificado con grep). El humo, en
  cambio, ya resta hasta −12 de aprobación, hunde el valor del suelo (`−0,7 × humo`), suma riesgo de
  abandono en viviendas arriba de 70 y aparece como motivo del techo de nivel.
- **L2, por qué la división por población.** Sin normalizar, tirar una casa en una metrópoli costaría
  lo mismo que tirar una en un pueblo, que es exactamente lo que el jugador nota como injusto. Con
  `max(1000, población)` el pueblo chico se enoja rápido y la ciudad grande necesita demoler en serio.
- **L3, por qué un número y no una lista de eventos.** El enojo es un solo `SimState.grief` que se
  multiplica por 0,5 cada mes: se guarda en un campo, se testea sin relojes y no arrastra historial.
- **L4, el primer número enfriaba demasiado lento.** Con 0,7 el enojo de una demolición tardaba trece
  meses en morir: el último punto se arrastraba medio año. Con 0,5 y redondeo hacia abajo, los puntos
  caen a la mitad por mes y a los ocho meses no queda nada; el test del deshielo lo fija.
- **L5, comprobado de punta a punta sin el navegador.** Un guion con `vite-node` sobre el motor real: una calle
  y un bloque residencial, doce meses de simulación, y después la topadora sobre una fila de casas como
  lo haría el jugador: 26 vecinos afectados, población 80 → 54 en el acto, aprobación objetivo 34 → 23
  con el factor en −6, y el enojo en 6 al mes siguiente y en cero al tercero.
- **L6, el undo quedó limpio sin código extra.** El deshacer pasa por `history.undo`, no por el camino
  donde se aplican los planes del jugador, así que tirar abajo lo que acabás de construir no enoja a
  nadie y deshacer una demolición tampoco devuelve el enojo (nadie olvida tan rápido).
