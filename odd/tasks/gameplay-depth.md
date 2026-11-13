# Profundidad de juego: usinas, congestión, hitos y elecciones

Objetivo: que la partida tenga metas, decisiones con costo y una condición de derrota, con lo argentino como mecánica.
Rama: `feat/vertical-slice` · Entrega: commits por unidad en la rama (sin PR pedido) · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit` · Build: `npm run build`
Documento anterior (v1 y todo lo previo): `odd/tasks/argencity-3000.md`.

## Specs

- **S1 — Pedido (verbatim):** "me gustaria dar mas profundidad al Gameplay de este juego, estaria bueno usar de referencia los juegos exitosos que hay como el Cities Skylines y otros actuales, ya que siento que deja de ser interesante a los 5 minutos de jugar y por ahora tampoco tiene una estetica o algo "unico" que te incite a jugar".
- **S2 — Alcance aprobado (verbatim):** propuesta: "Como primer paquete armaría elecciones + hitos, y de lo clásico los puntos 1 y 2" (1 = congestión estimada, 2 = usinas con contrapartida) → respuesta: "Dale, hace esos puntos que decis". Tránsito real queda afuera: "creo que el transito real seria una carga de trabajo enorme por ahora, de ultima MUY al final lo hariamos".
- **S3 — Usinas con contrapartida (propuesta aprobada):** "Con carbón (barata y sucia), gas (intermedia) y eólica o hidroeléctrica (cara, limpia y atada al terreno) ya hay una decisión real." Supuestos: tres tipos, todos de 2×2 y con el mismo alcance de luz. Carbón = la usina actual sin cambios (costo, mantenimiento, 600 MW, humo). Gas: más cara de construir y mantener, 600 MW, poco humo. Eólica: sin humo, mantenimiento bajo, rinde según el lugar: 160 MW en llano abierto, más en lo alto de una loma (se compara con el terreno de alrededor) y cerca del agua, hasta 400 MW (ver L5). Hidroeléctrica queda afuera.
- **S4 — Congestión estimada (propuesta aprobada):** "No se simulan autos: se calcula cuánta gente usa cada calle para ir de su casa al trabajo y se obtiene una carga por celda. Una calle saturada baja el valor del suelo y frena el crecimiento, y una avenida aguanta más." Supuestos: cada vivienda manda a sus vecinos al empleo más cercano por la red de calles; la carga se compara con la capacidad de la calle (más carriles = más capacidad; el puente cuenta como calle); la saturación baja el valor del suelo de los lotes que dan a esa calle y baja la aprobación; capa "Tránsito" y dato en la ficha de la calle. Los autos dibujados siguen siendo decorativos.
- **S5 — Hitos (propuesta aprobada):** "Hitos que desbloquean edificios (de pueblo a ciudad), con edificios únicos como recompensa." Supuestos: los hitos son de población y no se pierden si la población baja; cada hito desbloquea herramientas y da un aporte de plata de la Provincia; el próximo hito se ve siempre en pantalla. Los edificios únicos de recompensa NO entran en este paquete (quedan pendientes).
- **S6 — Elecciones con aprobación (propuesta aprobada):** "Elecciones cada 4 años con aprobación vecinal. Te da meta, condición de derrota y una razón para atender reclamos." Supuestos: la aprobación (0 a 100) se calcula de servicios, tasas, apagones, delito, humo, tránsito, abandono y caja en rojo, se mueve de a poco y se ve arriba con su detalle; hay elección en octubre cada 4 años (la primera en 1993); se gana con 50 o más; si se pierde, la partida avisa y se puede seguir en modo libre (sin más elecciones) o volver al inicio.
- **S7 — Guardado:** el formato pasa a la versión 4 (tipo de cada usina, aprobación, hito alcanzado, mandato). Las partidas 1 a 3 siguen cargando con valores por defecto (usinas a carbón, aprobación 50, hito según el historial). Contexto del usuario (verbatim, 2026-11-12): "las partidas viejas da igual por que estamos en fase de prueba".

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Usinas: carbón, gas y eólica | S3, S7 | inline | hecho | commit `feat(power): coal, gas and wind…`; RED observado (`sim/plants` inexistente); 6 tests nuevos; Chrome: las tres se colocan, con su cartel y sprite, sin errores |
| T2 Congestión estimada | S4 | inline | pendiente | — |
| T3 Hitos y desbloqueos | S5, S7 | inline | pendiente | — |
| T4 Aprobación y elecciones | S6, S7 | inline | pendiente | — |
| T5 Balance, ayuda y verificación final | S3-S7 | inline + verificador independiente (ítem 1: formato de guardado) | pendiente | — |

Ruta: inline. Las cuatro unidades comparten `simulation.ts`, `save.ts`, `game.ts` y `config.ts`, así que no son paralelizables.

## Log

- **L1 (2026-11-13), pedido original (verbatim):** "Buenas, vamos a seguir con este proyecto, no se si quedó algo pendiente de la sesion anterior, pero quiero hacer dos cambios. Arranquemos con el primero, me gustaria dar mas profundidad al Gameplay de este juego, estaria bueno usar de referencia los juegos exitosos que hay como el Cities Skylines y otros actuales, ya que siento que deja de ser interesante a los 5 minutos de jugar y por ahora tampoco tiene una estetica o algo "unico" que te incite a jugar, revisarias lo que hay y me decis que opinas?"
- **L2 (2026-11-13):** diagnóstico dado al usuario: no hay metas, un solo loop que se juega solo, el espacio casi no importa, no hay decisiones con costo, no hay eventos y lo argentino es cosmético. Referencia propuesta: Tropico (política y humor) más simulación clásica barata. El usuario (verbatim): "Bien, me gusta lo que decis y si creo que el transito real seria una carga de trabajo enorme por ahora, de ultima MUY al final lo hariamos. Me gusta eso politico que planteas, no conocia el tropico, pero con simulación clasica que idea planteas?" y después "Dale, hace esos puntos que decis, y queres terminar lo anterior que quedó? creo que me dijiste no faltaba mucho".
- **L3 (2026-11-13):** ideas propuestas que quedan fuera de este paquete: inflación, asentamientos informales, eventos con decisión (piquetes, cortes de luz, inundaciones, paritarias), agua y cloacas, especialización según el mapa, colectivos y tren, edificios únicos de recompensa, tránsito real. El usuario mencionó un segundo cambio que todavía no describió.
- **L4 (2026-11-13):** pronóstico de tamaño: unas 1.500 líneas entre código y tests, en 4 o 5 commits.
- **L5 (2026-11-13), T1 usinas.** `PLANTS` y `WIND` en `config.ts`, `src/sim/plants.ts`, herramientas `plantGas` (J) y `plantWind` (K), sprites e íconos nuevos, ficha y cartel por tipo (el eólico dice cuánto rinde en el lugar antes de pagar). Carbón $3.000 y $350/mes, 600 MW; gas $5.500 y $520/mes, 600 MW, humo 18 contra 60; eólica $4.500 y $140/mes, 80 a 400 MW. Guardado v4 (lee 1 a 3: usina sin tipo = carbón; tipo desconocido se rechaza). Corrección medida: la primera regla del eólico usaba la altura sobre el mar, y en el mapa "Con salida al mar" el 78 % de la tierra llana está 6 niveles o más arriba, así que rendía el máximo en todos lados; ahora se compara con el promedio del terreno a 6 lotes. Evidencia: `npm test` 326 verdes; `tsc` limpio.
