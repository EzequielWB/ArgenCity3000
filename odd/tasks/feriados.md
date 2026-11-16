# Feriados con fecha fija y tres salidas

Los seis feriados del año dejan de ser un efecto pasivo del mes: son casos con fecha fija, como los
eventos que ya existen. Tres por año piden una decisión, y los seis salen en el diario.

Rama: `feat/vertical-slice` · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit`

## Specs

- **S1 — El feriado es un caso con fecha (verbatim):** "yo entiendo que las fechas patrias podrian ser
  como eventos aleatorios mecanicamente hablando pero con fecha fija (Hasta la ventana emergente se
  podria personalizar un poco para diferenciarlo)". El caso se dispara por el mes del reloj, no por la
  tirada de dados, y el copete de la ventana dice que es un feriado.
- **S2 — Tres salidas, no dos (verbatim):** "se me ocurre que se puedan tomar 3 decisiones en vez de
  dos, una muy buena, un poco buena y la mala, es decir las buenas siempre van a tener una consecuencia
  en produccion/caja/etc.. pero traen agrado o traen turismo o beneficios". Las dos buenas cuestan caja
  y producción; la mala no cuesta nada y se paga en aprobación. La muy buena cuesta **2,5 veces** lo
  que la buena (verbatim: "Yo diria que la buena sea 2,5 veces mas"), o sea dos semanas y media de
  recaudación contra una (ver `casos-en-semanas.md`: los importes fijos se fueron), y además
  frena la obra un mes.
- **S3 — Uno por año, uno por mes (verbatim):** "por año SOLO se festejan 3 feriados y solo UN feriado
  por mes (Todos los feriados se anuncian en el diario, con festejar me refiero a tomar decisiones)".
  **Corregido después, dos veces:** "Tambien que los festejos por año se bajen a 1, 3 son demasiados",
  y después "que los feriados sean cada 2-3 años nada mas (lo de elegir festejar)".
  `CELEBRATED_PER_YEAR = 1` y `isCelebrationYear(year)`: se camina desde el año de fundación con pasos
  de dos o tres años, todo función pura del año, así que una partida guardada repite las mismas
  celebraciones. En 31 años de partida hay 12 decisiones. Cuál de los seis feriados sale también se
  decide con la semilla del año. Los demás se anuncian igual, sin ventana. La tabla tiene un feriado
  por mes como máximo, así que no hay dos el mismo mes.
- **S4 — Las seis fechas.** Año Nuevo (enero), Carnaval (febrero), 25 de Mayo (mayo), 20 de Junio
  (junio), 9 de Julio (julio) y Navidad (diciembre). El carnaval queda clavado en febrero aunque en la
  realidad se mueve con la Pascua (verbatim: "Carnaval dejalo en febrero no pasa nada"). Las fechas de
  memoria quedan afuera: el 24 de Marzo y el 2 de Abril no dan aprobación ni plata.
- **S5 — Qué devuelven.** Las dos buenas dejan al pueblo gastando: un `fiesta` de tres meses en la muy
  buena y de dos en la buena, que multiplica lo que la ciudad recauda un quinto más (`incomeFactor`,
  el mismo lugar donde entra la sequía). La muy buena suma 10 de aprobación y la buena 5; la mala
  resta 3.
  **Corregido después:** "hace mas determinantes las dos opciones buenas y no tanto la mala... la idea
  seria que cada cierto tiempo tengas una Oportunidad que con una buena inversión puedas mejorar tu
  ciudad (util si venis medio mal)". Antes eran 6 y 3 de aprobación, un `fiesta` de 1,12 y la mala
  restaba 5. El motivo, textual del jugador: "estoy 100% de aprobación y casi no pierdo dinero".

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Tabla de feriados y el del año | S3, S4 | `src/sim/calendar.ts` | hecho | `tests/feriados.test.ts`: un feriado por mes, exactamente 1 por año, el mismo para un año dado y distinto entre años |
| T2 Los seis casos con tres salidas | S1, S2, S5 | `src/sim/events.ts` | hecho | `tests/feriados.test.ts`: tres opciones por caso, etiquetas distintas, la muy buena 2,5 veces la buena |
| T3 Tres opciones en el motor y en la ventana | S2 | `src/sim/simulation.ts`, `src/ui/panels.ts` | hecho | `answerEvent` acepta cualquier índice válido; el copete de la ventana dice "Feriado" |
| T4 Fecha fija y anuncio en el diario | S1, S3 | `src/sim/events.ts`, `src/sim/news.ts` | hecho | `tests/feriados.test.ts`: el caso sale en el mes que toca sin importar la tirada, y no sale en un feriado no festejado; los seis se anuncian |

## Log

- **L1 (2026-11-19), el pedido.** Venía de la propuesta de identidad argentina: "me gustaria dar mas
  identidad Argentina, que se te ocurre?" y después "Los feriados como decis de plantearlos?". La
  primera propuesta era un efecto pasivo del mes; el usuario la cambió a casos con decisión.
- **L2 (2026-11-19), lo que ya estaba.** La ventana de eventos ya dibuja un botón por opción
  (`src/ui/panels.ts`), así que tres salidas no necesitaron interfaz nueva; lo que bloqueaba era el
  tipo `readonly [EventOption, EventOption]` y la guarda `index === 0 || index === 1` de `answerEvent`.
  Los feriados quedan fuera de `EVENTS` para no romper el catálogo aleatorio ni el test que exige dos
  opciones por caso.
- **L3 (2026-11-19), sin estado nuevo.** Los tres del año se calculan del año con `hash2`, y el caso se
  dispara cuando el mes del reloj coincide, así que no hubo que tocar el formato de guardado. Un
  feriado que cae mientras hay otro caso pendiente o una promesa en curso se pierde hasta el año
  siguiente: es preferible a encadenar dos ventanas.
- **L4, la card se viste.** Un caso común abre la ventana verde con el borde dorado de siempre; el
  feriado abre una bordó (`data-shape='feriado'`, `--bordo` `#5e1725`) con el mismo borde y el mismo
  título dorados, para que se reconozca sin leer. Verbatim del pedido: "Habia pensado mas en un
  bordó, con las letra del titulo en dorado y el borde tambien". Antes de eso había ido a celeste y
  blanco de bandera y no le gustó.
- **L5, uno por año y los números a la vista.** Dos cambios pedidos juntos: los festejos bajan a uno
  por año, y el detalle de cada opción vuelve a decir los pesos ("prefiero que el usuario sepa que le
  va a salir X dinero que imaginar cuanto seria el impacto en caja"). `EventOption.detail` ahora puede
  ser una función de la simulación: la ventana abre con el número que se va a cobrar, no con las
  semanas. La card, además, pasó de bordó a celeste claro de bandera con el marco y las tarjetas en
  dorado.
- **L6, la celebración es una oportunidad.** Con una decisión cada dos o tres años el caso dejó de ser
  un trámite: lo que devuelve subió (un quinto más de recaudación por tres meses, 10 de aprobación) y
  lo que quita la salida gratis bajó a 3. La aprobación a 100 % no puede subir, y ahí lo que se cobra
  es la recaudación: por eso la `fiesta` ahora es 1,2 y no 1,12.
