# Promesas con plazo y eventos con decisión

El Intendente promete algo en público, y el barrio le toma la palabra. El aviso rojo recuerda qué
prometió y cuánto falta; el día que aparece la obra, el aviso se va solo.

## Specs

- **S1** — Un evento puede pedir una promesa (`Simulation.promise('school' | 'plaza')`). Al aceptar,
  la ciudad queda comprometida con un plazo de `PROMISE.months` (12) meses, contados desde hoy, y
  guarda cómo estaba la ciudad ese día (`baseline`).
- **S2** — Mientras el compromiso está vivo, un aviso rojo sobre el mapa dice qué se prometió y
  cuántos meses quedan: `⚠ PROMESA construir una escuela · quedan 8 meses`. El texto lo arma
  `commitmentText()`, y a menos de dos meses dice `queda 1 mes` / `vence este mes`. Cuando se
  cumple, el aviso desaparece sin que nadie tenga que cerrarlo.
- **S3** — La promesa se cumple en cuanto la ciudad lo muestra, no cuando llega la fecha: una
  escuela que no existía al prometer (`promiseDone`), o cuatro celdas de plaza —el mínimo que la
  ciudad reconoce como plaza—. Se revisa al cerrar cada mes; el mes que aparece, se cobra.
- **S4** — Si la fecha llega sin la obra: `−PROMISE.broken` (10) de aprobación y `PROMISE.grief`
  (200 personas enojadas) que se desvanecen medio a medio como los del enojo por demoliciones.
  Si se cumple: `+PROMISE.kept` (8). En los dos casos el diario publica el desenlace, haya abierto
  el diario o no: lo vieron los vecinos, no el periodista.
- **S5** — Una promesa a la vez. `pickEvent` no dispara nada mientras hay una viva, ni con un
  evento sin responder, ni antes de `EVENT.firstAt` (12) meses, ni antes de `EVENT.gap` (8) meses
  del anterior, y sólo con `EVENT.chance` (0.3) por mes, tirado con el RNG de la partida.
- **S6** — El evento no se puede esquivar: abre la ventana, para el reloj, y sólo se va eligiendo
  una de las dos opciones. Si la partida se guarda con el evento abierto, se reabre al cargar.
- **S7** — Cada opción dice su consecuencia en el botón: lo que va a pasar, en palabras, antes de
  apretar. Las dos cuestan algo, en moneda distinta. En «El barrio se organiza»:

  | Opción | Detalle (texto en el botón) | Costo |
  | --- | --- | --- |
  | Prometer la escuela | «La ciudad se compromete a levantarla: si no está en un año, el barrio se lo toma a mal.» | La palabra: o la obra, o −10 y el enojo |
  | Dar vueltas | «Ni obra ni promesa. Los vecinos se lo anotan y la aprobación baja ahora.» | −6 de aprobación, ya |

- **S8** — El compromiso, el evento pendiente y la fecha del último viajan en la partida (formato
  13). Una partida anterior abre sin promesa y sin evento (`commitment=null`, `pendingEvent=null`,
  `lastEvent=0`), y una promesa con `due <= made` o de un tipo que no existe se rechaza al abrir.

## Tasks

| ID | Qué | Specs | Dónde | Commit |
| --- | --- | --- | --- | --- |
| T1 | El compromiso como dato: plazo, línea de base, progreso y cuándo se cumple | S1, S3 | `src/sim/commitments.ts`, `PROMISE`/`EVENT` en `src/config.ts` | `8e4c1a7` |
| T2 | El evento que pide la promesa y las reglas de cuándo aparece | S5, S7 | `src/sim/events.ts` | `8e4c1a7` |
| T3 | Estado, métodos y el cierre de mes: se cumple, se pierde, y sale en el diario | S3, S4, S6 | `src/sim/simulation.ts` | `8e4c1a7` |
| T4 | Formato 13: viaja en la partida y una partida vieja abre limpia | S8 | `src/save/save.ts` | `8e4c1a7` |
| T5 | El aviso rojo bajo la cinta y la ventana del evento con dos botones | S2, S6, S7 | `index.html`, `src/ui/style.css`, `src/ui/panels.ts`, `src/game.ts` | `8e4c1a7` |
| T6 | Tests de promesa, evento y partida, más la verificación en el juego | S1–S8 | `tests/promesas.test.ts` | `8e4c1a7` |

## Log

- **L1** — Pedido: un sistema de compromiso con plazo; si no es muy difícil, agregarlo, con un
  aviso rojo que le recuerde al jugador lo prometido y muestre cuánto tiempo queda hasta la fecha,
  y que el aviso desaparezca una vez cumplido el compromiso.
- **L2** — Es un puñado de estado y un chequeo por mes: no hacía falta una mecánica nueva. El
  enojo reusa el que ya dejaban las demoliciones (`DEMOLITION.keep`), la aprobación reusa
  `nudgeApproval`, y las noticias reusan `publish`.
- **L3** — El aviso rojo no es un cartel decorativo: su texto sale de `commitmentText()`, que
  recalcula los meses con `monthsLeft`. No hay un contador propio que se pueda desincronizar.
- **L4** — Se cumple apenas se ve la obra, no al vencer: prometer y construir al mes siguiente tiene
  que festejarse al mes siguiente. El vencimiento sólo decide cuándo se pierde.
- **L5** — El diario estaba cerrado en la primera prueba en el juego: la noticia de la promesa caía
  dentro de `if (this.paperOpen())` y no se publicaba nunca. Se comprobó con una partida cargada
  (escuela construida, un mes de reloj) y el desenlace no aparecía en el diario. Ahora la promesa se
  publica siempre, porque el desenlace lo vieron los vecinos.
- **L6** — El primer aviso quedó tapando la cinta con el nombre de la ciudad. Se movió debajo
  (`top: calc(22px * var(--orn) + 18px)`) y, mientras está, los avisos pasajeros bajan para no
  pisarse (`#promise:not(.hidden) ~ #toasts`).
- **L7** — El evento se reabre al cargar: `Game` mira `pendingEvent` al arrancar y en cada mes. Si no,
  una partida guardada en el medio quedaba con un evento invisible y la ciudad siguió creciendo sin
  que nadie decidiera.
- **L8** — Verificado en el juego con capturas: la ventana del evento sobre el mapa real, el aviso
  rojo con `quedan 12 meses`, la promesa cumplida (`Levantaste la escuela prometida: los vecinos lo
  festejan`, aprobación 50 → 58, aviso ido) y el evento reabierto al cargar la partida.
- **L9** — `637` tests en verde, `tsc` limpio, `build` de 1,2 s. El catálogo completo de eventos
  queda para la próxima: acá hay uno solo, el que pide la promesa, porque es el que ejercita todo el
  recorrido.
