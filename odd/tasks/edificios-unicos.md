# Edificios únicos (compartidos)

Una categoría nueva del toolbar, **Únicos (estrella)**, con cinco construcciones que la ciudad
puede tener una sola vez cada una y que no dan plata fija: suben un porcentaje del turismo de la
ciudad, y cada una tiene su temporada. Los cinco únicos **de gobierno** quedan para un paquete
posterior (S10).

## Specs

- **S1 — Categoría y unicidad (verbatim, L1/L2):** "agregar una categoria de "Edificios unicos" que
  su categoria sea una estrella" y "debe haber varios unicos que TODOS tengan". Cada uno de los
  cinco se puede construir **una sola vez por ciudad**; el segundo intento se rechaza con un mensaje
  que nombra el edificio (`Ya hay un Obelisco: la ciudad puede tener uno solo`), como hace hoy el
  faro (`src/sim/coast.ts`, `coastRefusal`).
  *Criterio:* existe un grupo `uniques` rotulado `Únicos`; los cinco `ToolId` viven sólo ahí; el
  segundo `planTool` del mismo tipo devuelve `cells: []`.
  *Check:* `tests/toolgroups.test.ts`, `tests/unicos.test.ts` (unicidad).

- **S2 — Tamaños (verbatim, L5, corregido en L11):** "El obelisco deberia ser 2x2, el Calvario lo
  imagino de 3x6 (El calvario de Tandil como referencia), el Puente de 2x6, el teatro de 2x2 y el
  estadio de 4x4". El teatro pasó a **3x3**: con dos celdas de lado la fachada visible mide 22 px y
  seis columnas de 1,5 px no se leen. El ancla es la celda de arriba a la izquierda y no se rota,
  como los aeropuertos y los puertos (`HUBS`, `hubFootprint`).
  *Criterio:* `UNIQUES[kind].w/h` valen 2/2, 3/6, 2/6, 3/3 y 4/4; `footprintOfTool` devuelve esa
  cantidad de celdas y las mantiene dentro del mapa.
  *Check:* `tests/unicos.test.ts` (footprints).

- **S3 — Sólo construcciones (verbatim, L4):** "respecto a los normales, deberian ser solo
  construcciones". Nada de paisajes (cataratas, cuevas, parques nacionales): los cinco son obra del
  jugador, con costo, mantenimiento y deshacer.
  *Criterio:* los cinco cobran `cost`, pagan `upkeep` y se demuelen enteros con la topadora.
  *Check:* `tests/unicos.test.ts` (obra y demolición).

- **S4 — Multiplicador de turismo, no ingreso fijo (verbatim, L3):** "Me gusta el multiplicador".
  Cada único suma un porcentaje al turismo de la ciudad: la suma de `coastIncome` y `hubIncome` del
  mes. Cada uno tiene **su propia temporada** (`peakMonths`), así el Calvario cobra en la
  peregrinación y el Teatro en la temporada de funciones. El total tiene techo
  (`UNIQUE_BOOST_MAX`) para que la suma no se escape.
  *Criterio:* `uniqueBoost(w, month)` devuelve la suma de los únicos que funcionan, con el pico del
  mes y capada al techo; el presupuesto presenta esa plata en su propia línea
  (`uniqueIncome`), no dentro de la costa.
  *Check:* `tests/unicos.test.ts` (boost, temporada, techo, presupuesto).

- **S5 — Posiciones especiales (verbatim, L3):** "lo de que tengan que estar en posiciones
  especiales". Una regla por edificio, con datos que el mundo ya calcula, y un rechazo en palabras:
  | Edificio | Regla | Dato que ya existe |
  |---|---|---|
  | Obelisco | 8 celdas de plaza a 2 lotes o menos (y se planta **sobre** lotes de plaza) | `w.parkArea` / `TILE.PARK` |
  | Calvario | la punta más alta del terreno a 10 niveles o más | `w.minMax` |
  | Puente | todo el predio sobre el agua, con una punta en tierra | `w.isWater` |
  | Teatro | valor del suelo promedio alrededor de 45 o más | `w.landValue` |
  | Estadio | un bulevar a 6 lotes o menos | `w.roadTier` / `roadRank` |
  El Puente acepta una sola punta en tierra a propósito: medido con `vite-node` sobre los cinco
  tipos de mapa y tres semillas, "tierra en las dos puntas" da 0 colocaciones en sierras, y "una
  punta" da entre 18 y 78 en todos los mapas. El Calvario pide altura 10 y no la línea de roca
  (12,3): con roca queda imposible en costa y en llanura, y la llanura directamente no tiene altura.
  *Criterio:* cada regla tiene su test de "entra" y de "no entra", y su mensaje nombra el edificio.
  *Check:* `tests/unicos.test.ts` (reglas).

- **S6 — Servicio y fichas:** un único rinde sólo con una calle a `ROAD_REACH` o menos de alguna
  celda del predio: un monumento necesita que la gente llegue. No pide luz ni la reparte (es piedra y
  acero, no un servicio), así que `isRelay` lo ignora y no consume potencia. Su ficha
  (`src/sim/report.ts`) dice cuánto suma, en qué meses y qué pide para funcionar.
  *Criterio:* `uniqueWorks` falso sin calle; `describeCell` sobre una celda del predio (en tierra y
  sobre el agua, para el puente) devuelve el nombre del edificio y las líneas de turismo y temporada.
  *Check:* `tests/unicos.test.ts` (ficha y servicio).

- **S7 — Desbloqueo por hito (corregido en L13):** entran por `MILESTONES`, como el resto de las
  herramientas, y los cinco juntos en `Metrópolis` (25.000). La barra ya avisa con `lockNotice`.
  *Criterio:* `milestoneOfTool` devuelve un hito para los cinco y `isUnlocked` es falso antes.
  *Check:* `tests/unicos.test.ts` (hitos), `tests/milestones.test.ts`.

- **S8 — Presupuesto:** el mantenimiento de los cinco entra a los gastos en la línea `uniques` y la
  plata del multiplicador en la línea `uniqueIncome`, las dos visibles en el Presupuesto municipal.
  *Criterio:* `monthlyBudget` suma `uniques` a `expenses` y `uniqueIncome` a `income`; el panel
  muestra las dos filas; una partida vieja sin los campos se lee con ceros.
  *Check:* `tests/unicos.test.ts` (presupuesto), `tests/save.test.ts`.

- **S9 — Guardado y deshacer:** los únicos se guardan (versión 20, legible hacia atrás) y la
  topadora y el deshacer los tratan como una pieza entera, como una usina o un puerto.
  *Criterio:* ida y vuelta por `serialize`/`deserialize` conserva el predio; `undo` devuelve el
  predio y la plata.
  *Check:* `tests/unicos.test.ts` (guardado y deshacer).

- **S10 — Los cinco de gobierno** (Cabildo, Regimiento, Planetario, Santuario, Sindicato): estaban
  fuera del primer paquete por pedido explícito ("primero hacé los 5 compartidos") y se implementan
  en S11.

- **S11 — Los cinco de gobierno (verbatim, L14):** "Te gustaria seguir haciendo los edificios unicos
  de tipo de gobierno? Segui esa logica visual con la que venimos trabajando, si queres toma
  inspiraciones de cosas reales". Cada gobierno tiene **un** único propio, y sólo ese gobierno lo
  puede construir: la ciudad fundada como democracia tiene el Cabildo y no el Regimiento. Sigue la
  misma lógica que los compartidos (uno por ciudad, obra del jugador, con costo y mantenimiento,
  posición especial, temporada) pero **cada uno hace algo distinto**, que es lo que el pedido
  original nombraba ("generar turismo o cosas asi, dependiendo del tipo"):

  | Gobierno | Edificio | Lote | Inspiración real | Regla de lugar | Qué hace |
  |---|---|---|---|---|---|
  | Democracia | Cabildo | 3×2 | Cabildo de Buenos Aires: arcada de dos pisos, techo de tejas, torre con reloj | 6 lotes de plaza a 3 lotes o menos | **+aprobación** por mes, y el doble en septiembre, el mes de la elección (`ELECTION_MONTH`) |
  | Dictadura | Regimiento | 4×3 | Regimiento de Campo de Mayo: galpones bajos alrededor de una plaza de armas, mástil y torre | 12 lotes sin zonificar a 4 lotes o menos (descampado) | **baja el delito** alrededor, como las luces del bulevar |
  | Tecnocracia | Planetario | 3×3 | Planetario Galileo Galilei: esfera sobre un cilindro, en un parque | a 8 lotes de una universidad | **da educación** alrededor: se ve en la capa Educación y destraba el cuarto nivel de las casas |
  | Teocracia | Santuario | 3×4 | Basílica de Luján: ladrillo, dos torres, rosetón | a 4 lotes del agua | **+favor** por mes, y el doble en abril |
  | Comunismo | Sindicato | 3×2 | Sindicato de la Carne de Berisso: bloque bajo con salón y cartel | 10 lotes industriales a 4 lotes o menos | **turismo que escala con los puestos de trabajo industriales**, con techo |

  *Criterio:* `UNIQUES[kind].government` dice de quién es cada uno; `uniqueRefusal` rechaza el de
  otro gobierno nombrando los dos; cada efecto tiene su función pura en `src/world/uniques.ts` y su
  test de "hace algo" y de "no hace nada si no corresponde"; el de turismo respeta
  `UNIQUE_BOOST_MAX` junto con los compartidos.
  *Check:* `tests/unicos.test.ts` (gobierno, reglas, efectos), `tests/fields.test.ts` (delito y
  educación), `tests/politics.test.ts` (aprobación), `tests/favor.test.ts` (favor).

## Tasks

- **T1** — Datos, tipo y terreno: `UNIQUES`, `UNIQUE_KINDS`, `UNIQUE_RULES`, `UNIQUE_BOOST_MAX` en
  `src/config.ts`; `TILE.UNIQUE` y `World.uniques` en `src/world/world.ts`; `src/world/uniques.ts`
  (predio, reglas, servicio, boost, mantenimiento); `uniqueHeight` y `isPlatform` en
  `src/render/geometry.ts`. → `tests/unicos.test.ts` · commit `feat(unicos): datos, terreno y reglas`
- **T2** — Herramientas: los cinco `ToolId`, el grupo `uniques`, `planTool`/`applyPlan`, la topadora,
  `refusalAt` en `src/game.ts`, deshacer en `src/world/history.ts` y los hitos en
  `src/sim/milestones.ts`. → `tests/unicos.test.ts`, `tests/toolgroups.test.ts` · commit
  `feat(unicos): la categoria en la barra`
- **T3** — Turismo y presupuesto: `uniqueIncome` y `uniques` en `src/sim/budget.ts`, filas en
  `src/ui/panels.ts`, línea en `src/sim/outlook.ts`, campos en `src/save/save.ts`. →
  `tests/unicos.test.ts`
- **T4** — Ficha: `describeCell` para el predio en `src/sim/report.ts`. → `tests/unicos.test.ts`
- **T5** — Arte y barra: cinco sprites en `src/render/sprites.ts`, rama de dibujo en
  `src/render/mapRenderer.ts`, cinco íconos y la estrella del grupo en `src/ui/icons.ts` y
  `src/ui/toolbar.ts`, ayuda en `src/ui/panels.ts`. · commit `feat(unicos): el arte de los cinco`
- **T7 ✅** — Datos y reglas de los cinco de gobierno: `UNIQUE_KINDS` (los cinco compartidos),
  `GOVERNMENT_UNIQUE_KINDS`, `ALL_UNIQUE_KINDS`, `UNIQUES` (lote, costo, gasto, efectos),
  `UNIQUE_RULES`, `GOVERNMENT_UNIQUES` como interruptor, la puerta por gobierno en `uniqueRefusal`,
  los predicados de lugar (plaza cerca, descampado, universidad cerca, agua cerca, industria cerca).
  `isUniqueTool` pasa a leer `ALL_UNIQUE_KINDS`, así que un único de gobierno se planifica, se
  topadorea y se deshace como cualquier otro. → `tests/unicos.test.ts` · commit
  `feat(unicos): los cinco de gobierno, datos y reglas`
- **T8 ✅** — Efectos: aprobación (Cabildo) y favor (Santuario) en el paso del mes, delito
  (Regimiento) y educación (Planetario) en `src/sim/fields.ts`, turismo por puestos industriales
  (Sindicato) en `uniqueBoost`. → `tests/unicos.test.ts`, `tests/fields.test.ts` · commit
  `feat(unicos): lo que hace cada uno de gobierno`
- **T9 ✅** — Barra, fichas y ayuda: cinco herramientas con teclas propias, íconos, ayuda del panel,
  ficha de consulta con el efecto, y el hito. → `tests/toolgroups.test.ts`, `tests/unicos.test.ts`
  · commit `feat(unicos): barra y fichas de los de gobierno`
- **T10 ✅** — Arte: cinco sprites fieles a su referencia y su altura en `uniqueHeight`, más el tablero
  `npm run board`. → `tests/unicos.test.ts` (alto) · commit `feat(unicos): el arte de los de gobierno`
- **T6** — Guardado v20 y cierre: `src/save/save.ts`, `npm test`, `npm run typecheck`, `npm run build`.
  Con T3 y T4 en el commit de la barra.

## Log

- **L1 (pedido original, verbatim):** "Buenas, me gustaria agregar una categoria de "Edificios
  unicos" que su categoria sea una estrella, la idea seria agregar cosas como "unicas" argentinas
  (Un calvario, el obelisco... etc) y tambien hacer que cada tipo de gobierno tenga UN edificio
  especial que unico de su tipo de gobierno, que pensas?"
- **L2 (verbatim):** "No no, yo opino que debe haber varios unicos que TODOS tengan, como el
  obelisco, calvario, etc y que APARTE haya UNO unico para cada gobierno. Estos edificios unicos
  estaria bueno que lo que hagan es generar turismo o cosas asi, dependiendo del tipo"
- **L3 (verbatim):** "Me gusta el multiplicador y lo de que tengan que estar en posiciones
  especiales. La cosa es que quiero mas ideas , Argentinas obviamente, de lugares para poner, además
  de que edificio especial podria tener cada gobierno"
- **L4 (verbatim, corrección):** "Que seria el Monumento al Desfile? y respecto a los normales,
  deberian ser solo construcciones" — el Monumento al Desfile era una invención del asistente para
  la dictadura; se retira y su reemplazo propuesto es el Regimiento (cuartel con plaza de armas:
  baja el delito y baja el valor del suelo del radio). Los paisajes (Cataratas, Cueva de las Manos,
  Parque Nacional) salen de la lista.
- **L5 (verbatim, autorización y medidas):** "Me gusta todas tus ideas, queres implementarlas? y para
  lo visual vayamos de a poco, primero hacé los 5 compartidos, El obelisco deberia ser 2x2, el
  Calvario lo imagino de 3x6 (El calvario de Tandil como referencia), el Puente de 2x6, el teatro de
  2x2 y el estadio de 4x4."
- **L6 (evidencia, medición con `vite-node` sobre `generateMap` 128 y semillas 1/7/42):** alturas
  máximas por tipo de mapa: costa 12, llanura 6, relieve 12-13, sierras 16-18; línea de roca 12,3.
  Colocaciones de un predio 3×6 con la punta a ≥ 12: costa 0, llanura 0, relieve 211-315, sierras
  1.651-4.877. Colocaciones con la punta a ≥ 10: costa ~8.000. Predio 2×6 todo sobre agua con tierra
  en las dos puntas: 0 a 9 en todos los mapas. Con una sola punta en tierra: 18 a 78 en todos los
  mapas y todas las semillas. De ahí S5.
- **L7 (decisión):** `uniqueIncome` como línea propia en vez de inflar `coastIncome`, para que la
  planilla muestre de dónde viene la plata.
- **L8 (decisión):** los cinco de gobierno quedan propuestos así, para el paquete siguiente:
  Democracia El Cabildo (+aprobación, pico en octubre, el mes de la elección); Dictadura El
  Regimiento (baja el delito, baja el valor del suelo, desfiles de aniversario); Tecnocracia El
  Planetario (rinde con universidad cerca, pico en invierno); Teocracia El Santuario (favor divino
  por mes, peregrinación en abril; ojo: `FAVOR` tiene un test que cierra
  `charity + lowTaxes + gardens = 100 - base`, la fuente nueva va fuera de esas tres); Comunismo El
  Sindicato (turismo que escala con los puestos industriales y se enciende al cumplir el plan).
- **L9 (teclas):** las veintiséis letras están tomadas o reservadas (q/e rotan, c capa, p
  presupuesto, g partidas, h ayuda, m, b, n, w/a/s/d paneo), así que los cinco únicos usan `[` `]` `/`
  `:` `*`. El test de `tests/coast.test.ts` que prohíbe las letras reservadas sigue pasando.
- **L10 (evidencia, revisión visual):** el primer pase de arte mostró las cruces del Calvario fuera
  del predio cuando el mapa se veía girado: los postes y los árboles se dibujaban con las
  coordenadas del eje largo sin mapearlas a la vista. `longPainter` ahora devuelve `uv`, y el
  Calvario y el Teatro se redibujaron. La revisión visual se hizo con el sprite dibujado sobre una
  cancha de celdas y una captura del navegador; el resto se verificó con los tests y el build.
- **L11 (corrección del usuario, 2026-11-17):** "subilo a 3x3 para mayor fidelidad, y en el puente
  fijate que el coso ese rojo queda superpuesto en el puente". El teatro pasa a 3x3 (con precio
  ajustado a los nueve lotes: $16.000, $340/mes y +5 % de turismo). En el puente la barquilla colgaba
  a 13 px del agua y con la cubierta crema tan ancha que se leía como una barcaza apoyada en el río;
  ahora cuelga a 20 px de la viga con cuatro varillas largas y visibles, la plataforma es fina con
  baranda y la cabina va angosta sobre el lado de atrás.
- **L12 (evidencia, la cúpula):** la cúpula se dibujaba como media elipse y la cara superior del
  tambor se la comía por abajo, dejando un anillo verde. Se probaron cuatro formas de rellenar media
  elipse en el navegador y todas funcionaban, así que el problema no era el `fill` sino la
  superposición; la cúpula quedó como una pila de cuatro elipses, cada una más chica y más alta.
- **L13 (corrección del usuario, 2026-11-17):** "hacé que se desbloquee a los 25k de habitantes
  todos los edificios únicos". Antes entraban repartidos en 1.000, 2.500 y 5.000; ahora los cinco
  comparten el hito `Metrópolis`, que ya existía sin desbloqueos. El test de hitos es genérico
  (`milestoneOfTool` para cada uno), así que sigue valiendo sin tocarlo.

- **L14 (pedido, verbatim):** "Te gustaria seguir haciendo los edificios unicos de tipo de gobierno?
  Segui esa logica visual con la que venimos trabajando, si queres toma inspiraciones de cosas
  reales". Se eligen cinco construcciones reales, una por gobierno: Cabildo de Buenos Aires,
  Regimiento de Campo de Mayo, Planetario Galileo Galilei, Basílica de Luján y Sindicato de la Carne
  de Berisso.
- **L15 (decisión, el interruptor):** `GOVERNMENT_UNIQUES` en `src/config.ts` filtra la barra y el
  hito: apagado, la ciudad vuelve a tener sólo los cinco compartidos sin borrar datos ni tests. Se
  deja encendido porque el paquete está completo.
- **L16 (evidencia, teclas y choques):** las originales `; , . ' \` ` chocaban con hospital (`;`),
  harbor (`.`) y airport (`,`), así que el Cabildo pasa a `{`, el Regimiento a `}` y el Planetario a
  `?`; el Santuario queda con `'` y el Sindicato con `\` (barra invertida). `tests/coast.test.ts` y
  `tests/toolgroups.test.ts` siguen pasando.
- **L17 (evidencia, arte, tres pases):** el primer pase mostró cinco problemas. El Santuario tenía
  las torres dentro del ancho de la nave y se leían como pilastras: la nave pasa a 1,5 lotes de
  ancho y las torres van afuera, con campanario, campana, aguja más clara que el techo y cruz. El
  Planetario tenía el anillo sobre la esfera (parecía Saturno) y la esfera sin luz ni sombra: el
  anillo baja al ecuador y la esfera pasa a ser una pila de elipses pintadas en dos mitades, clara y
  oscura. El Cabildo agranda la torre y el reloj y baja el techo. El Sindicato baja el pretil (que se
  comía la fachada), abre la puerta con marco y escalón y agranda el cartel. La revisión se hizo con
  el sprite a 4,2× en un tablero temporal y capturas de Chrome sin cabeza.
