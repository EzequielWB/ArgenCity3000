# Eventos con decisión: las palancas y el catálogo

Quince casos que se cruzan en la gestión. Cada uno mira la ciudad de verdad y ofrece dos salidas,
las dos con su costo escrito en el botón. Para que las consecuencias sean consecuencias y no
números de adorno, primero hicieron falta las palancas: efectos con vencimiento que los sistemas
que ya existen leen sin enterarse.

## Specs

- **S1** — `SimState.effects` guarda efectos temporales por nombre, en meses
  (`{ industryFrozen: 6 }`). `Simulation.effect(key, months)` lo prende (toma el mayor de los dos
  plazos), `hasEffect(key)` dice si corre, y al cerrar cada mes todos bajan en uno y el que llega a
  cero se borra. Sin efectos, todo el juego se comporta exactamente como antes.
- **S2** — **Freno** (`freeze`): mientras corre, `grow()` no levanta ni un edificio. El resto de la
  ciudad sigue viviendo: se cobra, se apaga el fuego, se abandona. Es «el crecimiento se frena», ni
  más ni menos.
- **S3** — **Industria fría / caliente** (`industryFrozen` ×0.5, `industryBoom` ×1.4): multiplican
  la demanda industrial que sale de `computeDemand`, en un solo lugar (`recomputeDemand`). Si corren
  los dos, se multiplican.
- **S4** — **Costa** (`coastBoost` ×1.5 sobre `coastIncome`, `coastWorn` ×0.4 sobre el plus de valor
  del suelo por cercanía al agua). `monthlyBudget` recibe el factor como último parámetro opcional y
  `computeLandValue` también: sin argumento, uno.
- **S5** — **Sin cortes** (`noBlackout`): `recomputePower` deja `shortage` en falso mientras corre.
  La ciudad compró luz a la Provincia: los servicios y el crecimiento siguen como si hubiera
  capacidad.
- **S6** — **Sliders clavados** (`lock:clinics`, `lock:green`, …): `setFunding` y `setGreen` no
  aceptan cambios mientras el candado corre, y el panel de presupuesto muestra el slider apagado con
  el motivo escrito. Al vencer, se destraba solo.
- **S7** — Un evento no vuelve antes de tiempo: `cool:<id>` lo saca de los candidatos mientras corre.
  Los que dependen de que el jugador *sostenga* una decisión (la ola de robos con las comisarías al
  120 %) usan el mismo truco: su `when` exige que la medida siga en pie y el `cool` es corto.
- **S8** — El catálogo son quince eventos: piquete, oferta de la Provincia, derrame, ola de calor,
  plaza para los vecinos, ola de robos, curtiembre, crecida, feria, corte en la usina, escuela
  (promesa), coima, sequía, humo y temporada. Cada uno con `when` que lee estado real (tránsito,
  delito, humo, caja, balance, potencia, mes, costa, lotes industriales, plazas, aprobación) y dos
  opciones que cuestan en monedas distintas: plata, aprobación, enojo, tiempo de obra o palabra
  empeñada. Ninguna sale gratis.
- **S9** — Las consecuencias nuevas del catálogo se apoyan en lo que ya hay: `nudgeApproval`,
  `state.grief`, `state.cash`, los impuestos por zona, el presupuesto de servicios, `promise()`.
  «Que el barrio se lo tome a mal» es enojo; «la aprobación baja ahora» es un empujón que la
  simulación devuelve sola con el paso de los meses.
- **S10** — Dos efectos del catálogo tocan el mapa y no los números: clausurar la fábrica más
  humeante cerca del agua y la crecida que deja vacía la primera fila. Los dos pasan por
  `abandonBuilding(cell)`, que reusa `setAbandoned` (población, demanda y capa visual incluidas).
- **S11** — `ok` — Un evento puede publicar su propio titular (`report(text)`), y puede tirar una
  chance con el RNG de la partida (`chance(p)`): la coima tapada sale a la luz con el 30 %, y queda
  escrito en el botón.
- **S12** — Los efectos viajan en la partida (formato 14). Una partida anterior abre sin efectos, y
  un efecto sin sentido (meses negativos, nombre vacío) se rechaza al abrir.

## Tasks

| ID | Qué | Specs | Dónde | Commit |
| --- | --- | --- | --- | --- |
| T1 | Las palancas: efectos con vencimiento y su lectura en crecimiento, demanda, costa, valor del suelo, luz y sliders | S1–S7, S10, S12 | `src/sim/effects.ts`, `src/sim/simulation.ts`, `src/sim/budget.ts`, `src/sim/fields.ts`, `src/save/save.ts` | `_` |
| T2 | Tests de las palancas | S1–S7, S10, S12 | `tests/efectos.test.ts` | `_` |
| T3 | El catálogo: quince eventos con sus condiciones y sus dos salidas | S8, S9, S11 | `src/sim/events.ts` | `_` |
| T4 | Tests del catálogo: cada evento aparece cuando debe y cada opción hace lo que promete | S8–S11 | `tests/eventos.test.ts` | `_` |

## Log

- **L1** — Pedido: cargar los quince eventos del catálogo con el mismo mecanismo que la promesa.
- **L2** — Sin palancas, medio catálogo quedaba en palabras: «el tránsito se traba», «la demanda
  industrial cae», «la costa rinde más». Se agregó un solo mecanismo genérico (efectos con
  vencimiento) en vez de diez campos sueltos, y cada sistema que ya existía lo lee en una línea.
- **L3** — El freno de crecimiento es `grow()` apagado, no `appetite` achicado: bajar el apetito
  hunde la demanda y hace que los edificios se degraden y se abandonen. Eso no es frenar, es
  incendiar. Freno = no se construye más; lo construido sigue igual.
- **L4** — Las opciones no inventan monedas nuevas: aprobación y enojo ya existían, y la plata sale
  de la caja o del presupuesto del servicio. Lo único nuevo es «tiempo»: meses de efecto.
- **L5** — Las condiciones se prueban con el estado real del juego, no con un flag: el piquete mira
  `congestion.jammedShare`, la crecida mira el otoño y la costa, la coima mira la caja y que no haya
  elecciones en el año.
- **L6** — Verificación: `npm test`, `tsc`, `build`, `probe` (el año 15 tiene que seguir en ~5.400
  habitantes con el mismo seed) y las capturas de los quince eventos en el juego.
