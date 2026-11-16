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
- **S3 — Tres por año, uno por mes (verbatim):** "por año SOLO se festejan 3 feriados y solo UN feriado
  por mes (Todos los feriados se anuncian en el diario, con festejar me refiero a tomar decisiones)".
  Cuáles tres salen del año mismo (una cuenta con la semilla del año), así que una partida guardada
  siempre juega los mismos tres. Los otros tres se anuncian igual, sin ventana. La tabla tiene un
  feriado por mes como máximo, así que no hay dos el mismo mes.
- **S4 — Las seis fechas.** Año Nuevo (enero), Carnaval (febrero), 25 de Mayo (mayo), 20 de Junio
  (junio), 9 de Julio (julio) y Navidad (diciembre). El carnaval queda clavado en febrero aunque en la
  realidad se mueve con la Pascua (verbatim: "Carnaval dejalo en febrero no pasa nada"). Las fechas de
  memoria quedan afuera: el 24 de Marzo y el 2 de Abril no dan aprobación ni plata.
- **S5 — Qué devuelven.** Las dos buenas dejan al pueblo gastando: un `fiesta` de dos meses en la muy
  buena y de uno en la buena, que multiplica lo que la ciudad recauda (via `incomeFactor`, el mismo
  lugar donde entra la sequía). La muy buena suma 6 de aprobación y la buena 3; la mala resta 5.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Tabla de feriados y los tres del año | S3, S4 | `src/sim/calendar.ts` | hecho | `tests/feriados.test.ts`: un feriado por mes, exactamente 3 por año, estables para un mismo año y distintos entre años |
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
