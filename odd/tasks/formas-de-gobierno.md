# Arranque de la partida: reloj en pausa y forma de gobierno

Dos cosas del arranque. Una: la partida nueva espera al jugador en vez de correr sola.
Dos: al fundar la ciudad se elige el partido y la forma de gobierno, con pros y contras.

## Specs

### S1 — El reloj arranca con la primera obra

> "que el juego en si arranque cuando pones el primer edificio, me refiero a arrancar a que pase el tiempo, empiece a moverse el dinero etc"

- Una partida **nueva** entra en pausa (velocidad 0) y así se queda hasta la primera obra.
- Cuenta como primera obra **cualquier plan aplicado**: calle, puente, tendido, zona, plaza, usina, servicio, obra de costa o topadora con algo que demoler. Consultar no cuenta.
- Con la primera obra la velocidad pasa a **Normal** una sola vez; después el jugador manda con los controles de siempre.
- **Cargar** una partida guardada no pausa ni cambia la velocidad.
- El aviso de bienvenida lo dice: el tiempo arranca con la primera obra.

### S2 — Al fundar se elige partido y forma de gobierno

> "al arrancar la partida uno pueda 'elegir' su forma de gobierno, con pros y contras... que aparezca una ventana donde puedas poner el nombre de tu partido y debajo puedas elegir distintos tipos"

- La ventana de fundación **aparece una vez adentro del mundo**, ni bien se entra a la partida nueva: el mapa se ve atrás, el reloj está en pausa y la ciudad no arranca sin firmar.
- Tiene el campo **Nombre del partido**, que es **obligatorio**: el botón "Asumir el cargo" está deshabilitado hasta que haya un nombre, y si se cierra la ventana sin firmar, vuelve a abrirse.
- Las tres formas van con sus pros y sus contras a la vista; viene **Democracia** marcada por defecto.
- La tarjeta y sus textos respetan la estética del resto de la interfaz (panel verde, borde dorado, bisel, tipografía del juego).
- Las partidas guardadas abren con la forma y el partido que tenían.

### S3 — Los números

| Forma | Elecciones | Umbral | Migración | Subsidios de la Provincia | Aprobación |
|---|---|---|---|---|---|
| **Democracia** | cada 4 años (la primera en 1993) | ≥ 50 % | ×1,0 | sí | sin tope, se mueve 4 puntos por mes |
| **Dictadura** | nunca | — | ×0,8 | **no** (gira $0) | tope 60, se mueve 4 |
| **Tecnocracia** | cada 6 años (la primera en 1995) | ≥ 40 % | ×0,95 | sí | sin tope, se mueve **2** |

- "Migración" multiplica el apetito de crecimiento de la ciudad: con dictadura llega un 20 % menos de gente nueva.
- "Subsidios" multiplica lo que gira la Provincia al alcanzar un hito; con dictadura el hito se alcanza igual y se desbloquea lo mismo, pero no entra plata.
- "Aprobación" cambia el paso mensual hacia la aprobación merecida y el techo: con dictadura nunca pasa de 60.
- Perder una elección sigue dejando la ciudad en modo libre, como hoy.

### S4 — Guardado formato 10

- `government` (`democracia` | `dictadura` | `tecnocracia`) y `party` (texto, hasta 32) en la simulación.
- Las partidas 1 a 9 abren como **democracia** y sin partido.
- Se rechaza una partida con una forma de gobierno desconocida o un partido que no sea texto.

### S5 — Dónde se lee

- Panel de política: nombre del partido y forma de gobierno; con dictadura no muestra "próximas elecciones" sino que no hay.
- El diario, al fundar, dice el partido y la forma.
- Ayuda en pantalla y README.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 El reloj arranca con la primera obra | S1 | `src/game.ts` | hecho | partida nueva a velocidad 0, la primera obra aplicada la pone en Normal; cargar no pausa |
| T2 Gobierno y partido en el estado y en el guardado (formato 10) | S4 | `src/config.ts`, `src/sim/simulation.ts`, `src/save/save.ts`, `tests/government.test.ts` | hecho | ida y vuelta en el guardado; una partida v9 abre como democracia sin partido; una forma desconocida se rechaza |
| T3 Elecciones, umbral, tope y paso de la aprobación por gobierno | S3 | `src/sim/politics.ts`, `src/sim/simulation.ts`, `tests/government.test.ts` | hecho | elecciones 1993/1997 con democracia y 1995 con tecnocracia, ninguna con dictadura; tope 60 y paso 2 donde corresponde |
| T4 Migración y subsidios por gobierno | S3 | `src/sim/simulation.ts`, `src/sim/milestones.ts`, `tests/government.test.ts` | hecho | apetito ×0,8 y ×0,95 medido sobre la simulación; con subsidios ×0 el hito se alcanza y la caja no se mueve |
| T5 Ventana de fundación dentro del mundo, panel de política y diario | S2, S5 | `src/main.ts`, `src/ui/government.ts`, `src/ui/panels.ts`, `src/sim/simulation.ts`, `src/game.ts`, `src/sim/mayor.ts`, `src/ui/style.css` | hecho | tarjetas generadas por una función pura y probada (`governmentCardsHtml`); el nombre es obligatorio y la ventana vuelve si se cierra sin firmar; el panel de política dice partido y forma, y con dictadura no promete elecciones |
| T6 Documentación: README, plan, ayuda | S1, S5 | `README.md`, `PLAN-DE-TRABAJO.txt`, `src/ui/panels.ts` | hecho | — |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`. Balance: `npm run probe`.

## Log

- **L1 (2026-11-13), pedido original (verbatim):** "al entrar a la partida me gustaria dos cosas. Primero que el juego en si arranque cuando pones el primer edificio, me refiero a arrancar a que pase el tiempo, empiece a moverse el dinero etc,... Otra cosa es que al arrancar la partida uno pueda "elegir" su forma de gobierno, con pros y contras, que opinas? Yo pensaba en que aparezca una ventana donde puedas poner el nombre de tu partido y debajo puedas elegir distintos tipos, que opinas? estilo "Democracia" que sea el generico actual, "Dictadura" no hace falta releección, y algun otro, que pensas?"
- **L2:** el padre propuso tres formas con números atados a lo que ya existe (elecciones, aprobación, migración, subsidios de los hitos) y avisó del riesgo de que la dictadura fuera modo fácil. El usuario respondió: "Me gustan esas tres formas, queres implementar esos cambios?" — aprobado tal cual, sin cambios de números.
- **L3:** decisión de alcance: la elección va en la **pantalla de fundación** (que ya es una ventana con el nombre del Intendente y el mapa) en vez de un modal aparte, para no meter un paso más entre el jugador y el mapa.
- **L4 (2026-11-13), implementación.** El reloj: `Game` arranca en velocidad 0 cuando `tick === 0` y la primera obra aplicada llama a `setSpeed(2)` una sola vez. El gobierno: `GOVERNMENTS` en `src/config.ts` guarda los números; `SimState` lleva `government` y `party`; `politics.ts` recibe la forma en `electionDue`, `monthsToElection`, `nextElectionYear` y `stepApproval` (tope incluido); la migración multiplica `GROWTH_APPETITE`; `advanceMilestones` acepta el factor de subsidios. `serialize` guarda la simulación entera, así que los campos nuevos viajaron solos; `parseSim` los valida. Guardado 10, partidas 1 a 9 como democracia sin partido.
  - Decisión de UI: la elección va en la pantalla de fundación, no en un modal aparte. Las tarjetas se generan con `governmentCardsHtml` (`src/ui/government.ts`), una función pura, para poder probar que están las tres formas, sus pros y contras y la recomendada sin necesitar un DOM.
- **L5 (2026-11-13), verificación.** 554 tests verdes (37 archivos; 8 nuevos en `tests/government.test.ts`), `tsc` limpio y `build` en 1,26 s. Lo que **no** quedó verificado con los ojos es la pantalla de fundación: la automatización del navegador de la app sigue dando timeout, así que del picker se probó el HTML y no la pinta. Al abrir el juego conviene mirar que las tres tarjetas entren en la tarjeta de inicio y que el radio de Democracia venga marcado.
- **L6 (2026-11-13), corrección del usuario (verbatim):** "Intentá respetar la estetica general, además pone "subsidies" en vez de subsidios. La idea es que el elegir le tipo de gobierno aparezca una vez dentro del mundo, ni bien entras. El nombre tiene que ser obligatorio". Tres cosas: (1) la ventana se mudó de la pantalla de inicio al mundo: `launch()` abre `openGovernment(game)` cuando `tick === 0` y no hay partido, con el mapa atrás y el reloj en pausa; (2) el nombre es obligatorio: el botón arranca deshabilitado, el aviso lo dice, no hay botón de cerrar y si la ventana se cierra igual (Escape o clic afuera) vuelve a abrirse; (3) la estética: las tarjetas usan los tokens del juego (`--base`, `--deep`, `--line`, `--gold`, bisel, `--font-title`) en vez de tarjetas genéricas.
  - Al firmar, `Simulation.found(government, party)` reemplaza el titular de fundación que se había publicado sin partido (no quedan dos noticias), recalcula el apetito con la migración de la forma elegida y `Game.found` refresca el HUD.
- **L7 (2026-11-13), la palabra "subsidies".** Buscando el término apareció la causa: **una de las tarjetas decía "La Provincia no gira subsidies"**, en inglés, por un error del padre al escribir `GOVERNMENTS`. Se corrigió a "subsidios", que es lo que dice el resto del juego (las otras dos tarjetas, la ayuda y el README). Queda anotado acá porque el pedido se podía leer al revés ("poné subsidies en vez de subsidios"); si el usuario realmente quiere el término en inglés, es un cambio de una línea por aparición (cuatro en total).
- **L8 (2026-11-13), cierre y verificación visual.** Lo que L5 y L6 no habían podido mirar quedó mirado: la ventana de fundación se abre sola al entrar al mundo (mapa atrás, reloj en pausa, `Sem 1 · Ene 1990`), el botón de cerrar no existe mientras los papeles están sin firmar, Escape y el clic afuera la vuelven a abrir, el botón duerme hasta la primera letra del partido y al firmar la ventana se va, el titular del diario pasa a "por el partido Movimiento del Sur" y el HUD dice "vota en oct 1993". Cero errores de consola. Medido con Chromium headless sobre `vite preview`: el navegador que trae la app sigue dando timeout en el snapshot, así que se usó Playwright suelto, fuera del repo.
  - **Ventana baja:** en 1180×640 la tarjeta mide 771 px de contenido contra 602 visibles, scrollea (`overflow-y: auto`, `max-height: calc(100vh - 32px)`) y "Asumir el cargo" se alcanza bajando. No hay callejón sin salida, pero el botón no se ve de entrada en pantallas de menos de ~800 px de alto; un pie pegajoso lo resolvería si molesta.
- **L9 (2026-11-13), "subsidies" va en inglés.** L7 había leído el pedido al revés y había devuelto la palabra al español. Se aplica la lectura literal del pedido del usuario: el término queda **"subsidies"** en las tres tarjetas (`src/config.ts`), en la ayuda (`src/ui/panels.ts`) y en el README. Cuatro apariciones en la interfaz, una en la ayuda y una en el README; `PLAN-DE-TRABAJO.txt` sigue diciendo "subsidios" porque es el plan de trabajo, no copy del juego. Si el usuario quería lo contrario, es la misma operación al revés.
  - `.vite/` quedó en `.gitignore`: es caché de `vitest`/Vite y estaba apareciendo como sin trackear.
