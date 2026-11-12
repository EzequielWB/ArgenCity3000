# ArgentinaCity 3000 — Feature Document

City-builder isométrico original para navegador, con identidad argentina (porteño + conurbano). Mecánicas del género (zonas, energía, presupuesto); arte, UI y estética propios (ver S0, L17).
Repositorio: `E:\proyecto_argenCity` (git local) · Rama de trabajo: `main` · Runner de tests: `vitest` · Build: `vite`

> Estado actual: **F3 completado** (T4: barra, presupuesto, consulta, diario) + guardado de la simulación (T3d). Próximo: **F4 — Arte propio** (T5). Ver `## Tasks` y `## Log`.

---

## Specs

### S0 — Originalidad (decisión L17, prevalece sobre S1–S3, S5, S13)
El juego es un city-builder **original** del género, no una recreación de un juego existente.
- Se toman solo mecánicas genéricas del género (zonas R/C/I, demanda, energía, presupuesto, crecimiento, vista isométrica con rotaciones).
- **Nada de `ORIGINAL/` entra al juego**: ni sprites (tampoco como placeholder), ni paleta, ni audio, ni formatos de archivo, ni el look o la UI del original. `ORIGINAL/` deja de ser material de consulta para el desarrollo.
- Sin import/export de formatos de otros juegos.
- Las menciones a "SC2000" en specs anteriores se leen como "convención del género".

### S1 — Visión (verbatim del usuario, `PLAN.md`)
> "SimCity 2000 estilo argentino para navegador. Mantener esencia isométrica SC2000. Paleta cálida, fileteado porteño sutil, mezcla porteño+conurbano."

Criterio de aceptación: el juego corre en navegador, la cámara y el terreno son isométricos como SC2000, y la estética usa paleta cálida con acentos de fileteado.

### S2 — Gameplay: esencia fiel + identidad argentina
Reglas del SC2000 (zonas R/C/I, demanda RCI, energía, presupuesto, crecimiento) con contenido y nombres argentinos.
No es emulación de DOS ni clon 1:1 de la UI original.

### S3 — Estrategia de arte
El objetivo final es arte propio (tiles isométricos, edificios, vegetación, vehículos) con paleta cálida y fileteado.
~~Los sprites originales de `ORIGINAL/` pueden usarse solo como placeholder de prototipado.~~ Reemplazado por S0 (L17): arte 100% propio desde el principio; los placeholders se generan por código.

### S4 — Alcance
**v1 (vertical slice jugable):** terreno procedural (agua y relieve), bulldozer, tendido de calles, zonas R/C/I, crecimiento de edificios por demanda RCI simple, energía (usinas + tendido), presupuesto con impuestos y gastos. Jugable de punta a punta.
**v2 (fuera de alcance v1):** agua potable, tránsito, contaminación, crimen, valor del suelo, desastres, audio propio. (El import/export `.SC2` se quitó por S0.)

### S5 — Stack
TypeScript + Vite + Canvas 2D. Renderer isométrico propio con 4 rotaciones (0/90/180/270), como el original. Sin dependencias pesadas de render.

### S6 — Destino
Local para desarrollo. Publicable en el futuro; nada de la v1 debe bloquear eso (ver S3).

### S7 — Copy de UI
Español rioplatense. El título del jugador es **"Intendente"** (corrección explícita del usuario; nunca "Alcalde").
Glosario de referencia: Impuestos, Zona Residencial / Comercial / Industrial, Presupuesto, Energía, Bulldozer, Intendente.

### S8 — Notificaciones
Estilo diario argentino. Nombre provisorio del diario: **"El Diario del Conurbano"**. Implementado en F3 (S26).

### S9 — Audio
v1 sin audio. Los XMI/VOC originales son material de EA y no se usan; el audio propio (si se hace) queda para v2.

### S10 — Layout del repositorio
- El código vive en la raíz de `E:\proyecto_argenCity` (`index.html`, `src/`, `tests/`, configs).
- `ORIGINAL/` queda intacto como material de referencia y fuera de git.
- `PLAN.md` y `odd/` se versionan (son la especificación viva).

### S11 — Git
Repo local, commits por unidad de trabajo en `main`. Sin push ni remotos salvo pedido explícito del usuario.

### S12 — Documentación viva
Este feature document más `odd/CONTINUIDAD.md` (minigüía de handoff para cuando el usuario cambie de modelo/agente). Ambos deben seguir siendo útiles sin leer el código: estado, fases, decisiones y cómo retomar.

### S13 — Métrica isométrica
Métrica SC2000: celda de mapa = 16×8 px en pantalla (rombo 2:1), bloque de 4×4 celdas = 64×32 px, escalón de elevación = 8 px por nivel. El terreno de v1 es de 128×128 celdas, generado proceduralmente con semilla reproducible.

### S14 — Unidad de diseño para edición (decisión L9)
Las herramientas de edición (calles, zonas, bulldozer, y en F2 los edificios) actúan sobre el **bloque completo**. Inicialmente 4×4 celdas (SC2000); el usuario solicitó poder elegir **2×2 o 4×4** según convenga (ver S15). El estado se **guarda por celda** en la grilla: la grilla es la única fuente de verdad, y los bloques son la unidad de autoría y de dibujo. Consecuencia arquitectónica: el modelo del mundo sigue siendo 128×128 celdas (`World`), y las operaciones de edición se expresan como funciones que escriben rangos de tamaño variable (2×2 o 4×4).

### S15 — Alcance de F1 (edición)
Entra en F1: bulldozer, tendido de calles y pintado de zonas R/C/I sobre bloques, con validación, y guardado/carga de la ciudad. **Tamaño de bloque seleccionable: 2×2 o 4×4** (conmutable en tiempo de edición, por tecla `B` en el prototipo v1). **Bulldozer de F1 solo limpia calles y zonas**; el aplanado de terreno del original queda para v2 junto con el deshacer (una operación irreversible sin deshacer sobre datos guardados no es aceptable todavía). La barra de herramientas visual, el panel de presupuesto y las notificaciones son T4 (F3); en F1 la selección de herramienta es por teclado y el HUD muestra la activa.

### S17 — Picking con elevación
El mouse debe caer en la celda que se **ve** bajo el cursor, con relieve incluido (antes caía ~un bloque arriba: ver L12).
- `pickCell` elige la superficie **visible** en el píxel: recorre las celdas en orden de pintura inverso (adelante hacia atrás) y devuelve la primera cuya superficie contiene el punto — cara superior, o el muro de desnivel que le pertenece.
- Sobre un muro de desnivel (donde ninguna cara superior llega) elige la celda dueña del muro; nunca una celda lejana derivada del plano z=0. El plano z=0 queda solo como fallback cuando no hay superficie visible (aire).
- Fuera del mapa devuelve `null`.
- Criterio de aceptación: para cualquier punto sobre el terreno, la celda elegida tiene su superficie visible (cara o muro) bajo el punto; el highlight no se desplaza en los desniveles; las 4 rotaciones se comportan igual.

### S18 — Simulación F2 (T3): demanda RCI simple
Entra en F2 la lógica que hace crecer la ciudad. F1 solo pinta calles y zonas; F2 es la que decide **cuánto** crece cada bloque.
- **Demanda RCI simple:** cada bloque zonado (R/C/I) pide población o puestos de trabajo según su vecindad. Una zona sin **calle en su bloque ni en los ocho bloques linderos** no recibe demanda (la gente no llega). En el juego real la calle siempre está en el bloque de al lado, porque `applyTool` no permite calle y zona en el mismo bloque: la regla es la vecindad de radio 1 **en bloques** (`hasStreetNear`, única fuente de verdad). Una zona sin **energía** no recibe demanda (sin corriente no se edifica). La demanda se calcula por bloque y por tipo, y se almacena como un número entero (sin fracciones, sin ruido).
- **Crecimiento por nivel:** un bloque zonado con demanda > 0 sube un nivel cada cierto número de ticks (simulación de tiempo). Cada nivel es un edificio más grande: nivel 0 = vacío, 1 = casita, 2 = casa, 3 = edificio de apartamentos (escala similar a SC2000). El nivel máximo por tipo es configurable (R: 3, C: 3, I: 3 en v1).
- **Sin crecimiento cuando:** no hay demanda, el bloque está en agua, el bloque está vacío de zona, o la demanda se agotó (la zona está "satisfecha").
- **Criterio de aceptación:** un bloque R con calle propia o lindera y energía recibe demanda y crece de nivel a nivel; un bloque R sin ninguna calle cerca (ni propia ni lindera) no recibe demanda y nunca crece; un bloque R cuya calle está a dos bloques de distancia tampoco recibe demanda; un bloque R en agua nunca crece. La demanda es determinista para el mismo estado del mundo (misma semilla, mismo tick).

### S19 — Simulación F2: energía y tendido
Entra en F2 la energía, el primer recurso que conecta bloques entre sí.
- **Usinas:** bloques que generan energía (una usina de carbón por defecto, en un bloque vacío y construible). La usina produce una cantidad fija de energía por tick.
- **Tendido:** la energía se propaga por **bloques adyacentes** (8 vecinos, incluyendo diagonales) mientras la usina tenga energía. Un bloque recibe energía si al menos un vecino la tiene. La propagación se calcula por BFS desde cada usina, con un radio de alcance (por defecto 16 bloques) y un coste por bloque (la energía se consume al tender).
- **Sin tendido:** un bloque sin usina ni vecino con energía no recibe energía, y por tanto no recibe demanda (ver S18).
- **Criterio de aceptación:** una usina en el centro de un mapa vacío energiza un radio de bloques; un bloque aislado (sin usina ni vecino energizado) no recibe energía; la energía es determinista.

### S20 — Simulación F2: presupuesto
Entra en F2 el presupuesto, el primer sistema que hace que las decisiones del jugador tengan costo.
- **Ingresos:** impuestos por cada bloque edificado (proporcional al nivel y al tipo: R/C/I con tarifas distintas).
- **Gastos:** coste de mantenimiento de calles (por bloque de calle) + coste de energía (por unidad de energía consumida) + coste de la usina (mantenimiento fijo).
- **Caja inicial (siempre):** > Verbatim (L16): "dame dinero inicial siempre" — toda partida **nueva** arranca con `INITIAL_CASH` (supuesto de diseño: 100000). Enmienda L17: una partida **cargada** retoma la caja que tenía al guardarse (S22), porque reiniciarla daba plata infinita con guardar/cargar; un guardado viejo (v1, sin simulación) arranca con `INITIAL_CASH`. La caja acumula el saldo de cada tick (`caja += saldo`) y se muestra en el HUD (fila **Caja**).
- **Saldo:** ingresos − gastos. El saldo puede ser negativo (déficit), en cuyo caso la ciudad sigue funcionando de sus reservas. La demanda solo se congela cuando **la caja está en rojo y el saldo sigue en rojo** durante `DEFICIT_TOLERANCE_TICKS` (60) ticks consecutivos —una crisis de caja real—, y se levanta en cuanto entre plata (caja ≥ 0) o el saldo deje de sangrar.
- **Sin fracciones:** todo en números enteros (unidades básicas de la moneda). Sin monedas fraccionarias.
- **Criterio de aceptación:** un mapa con una usina y calles tiene gastos positivos y un saldo que se calcula de forma determinista; un mapa vacío (solo calles, sin edificios) tiene ingresos cero y gastos por calles; toda partida nueva muestra la caja inicial en el HUD; una ciudad que pasa más de 60 ticks con calles y sin zonar sigue pudiendo crecer al zonar (nunca queda en crisis permanente); la demanda se congela solo con caja y saldo en rojo 60 ticks a la vez, y se descongela al sanar cualquiera de los dos; el saldo es determinista para el mismo estado.

### S21 — Referencia de tiempo en el HUD
> Verbatim (L15): "además no hay referencia de tiempo como para saber si pasa o no, estaria bueno eso"

El HUD muestra la fecha del juego para que se vea que la simulación avanza.
- La fecha es una **función pura del conteo de ticks** de simulación, sin estado nuevo persistido.
- Supuestos de diseño: 60 ticks = 1 mes (6 s reales por mes a 10 ticks/s), 12 meses = 1 año, arranque en **Ene 1990**.
- Etiquetas de mes en español rioplatense (`Ene`…`Dic`), fila **Tiempo** en el HUD junto a Saldo/Usinas.
- Criterio de aceptación: al abrir el juego el HUD muestra `Ene 1990`; con la simulación corriendo cambia a `Feb 1990` a los 60 ticks y a `Ene 1991` al cerrar el primer año.

### S22 — Guardado de la simulación (L17)
El guardado incluye el estado de la simulación para que una ciudad cargada siga exactamente donde quedó.
- Formato `SAVE_VERSION = 2`: agrega `sim` con tiempo (ticks), caja, ticks de déficit, edificios (bloque, zona, nivel, edad) y usinas (bloque). La demanda no se guarda: se recalcula en el próximo tick.
- Los guardados v1 siguen cargando: terreno, calles y zonas, con simulación limpia (sin edificios ni usinas, `INITIAL_CASH`, `Ene 1990`).
- Cargar nunca hereda edificios, usinas ni caja de la ciudad anterior.
- Un guardado con edificios o usinas imposibles (zona desconocida, nivel fuera de rango, bloque fuera del mapa) falla con error claro.
- Criterio de aceptación: guardar y cargar devuelve los mismos edificios, usinas, caja y fecha; un v1 carga; uno corrupto se rechaza.

### S23 — F3: barra de herramientas (T4)
Barra visual con un botón por herramienta (las 7 de `TOOLS`), el conmutador de bloque 2×2/4×4, y Guardar/Cargar. El botón activo se resalta. El teclado sigue funcionando igual (1–7, B, G, C) y la barra refleja el cambio. Supuesto de diseño: barra horizontal debajo del encabezado, con estética propia (paleta cálida y filete dorado).

### S24 — F3: panel de presupuesto (T4)
Panel desplegable (botón **Presupuesto** o tecla `P`) con el detalle del último tick: impuestos por tipo (R/C/I), gastos de calles, energía y usinas, totales de ingresos/gastos, saldo, caja y el estado de crisis. La suma del detalle es exactamente la de `computeBudget` (una sola regla).

### S25 — F3: consulta de bloque (T4)
Con la herramienta **Consulta**, un clic sin arrastrar sobre el mapa abre una ficha del bloque de 4×4: terreno y altura de la celda, calle, zona, edificio (nombre por nivel), demanda, luz y si hay usina. Arrastrar sigue moviendo la vista. Nombres por nivel (supuesto de diseño): R: baldío, casita, casa, edificio de departamentos · C: baldío, almacén, local, galería comercial · I: baldío, taller, fábrica, planta industrial.

### S26 — F3: El Diario del Conurbano (T4)
Titulares generados por eventos, con fecha del juego, en un panel con los últimos 5: primera usina, primer edificio, hitos de edificios (10, 25, 50, 100, 200), entrada y salida de la crisis de caja, y el comienzo de cada año con un resumen. Los titulares salen de una función pura que compara dos estados de la ciudad (determinista y testeable).

### S16 — Mapa real (overlays + recorte a cuadrícula)
Requerimiento a futuro/planeado (no bloquea F2): cargar un recorte de mapa real dentro del juego.
- Fuente: **OpenStreetMap vía Overpass API** (sin tiles raster propietarios). Local, sin API key privada obligatoria.
- Selección: el usuario elige un **tamaño** (ej. 128×128, 256×256 o configurable), lo posiciona en un mini-mapa con **overlay de baja opacidad** para ver qué se recorta, y confirma. Se obtiene el bbox (lat/lon).
- Alcance deseado: recrear lo mejor posible dentro de las limitaciones de la cuadrícula isométrica (recorte, simplificación, ajuste al tamaño elegido). Transformar datos OSM (agua/coastlines, carreteras, manzanas/edificios, nombres) a entidades del juego (terreno, calles, zonas, límites).
- En v1: **botón "Cargar mapa real"** (convive con terreno procedural). Seed como fallback. Prioritario: agua/relieve, carreteras y manzanas.
- Licenciamiento: ODbL (OpenStreetMap). No versionar dumps crudos. Usar solo para generar mapa jugable.
- Restricciones: evitar llamadas pesadas en caliente, respetar límites de Overpass, cache local.
- UI mínima: mini-mapa con overlay de tamaño configurable, posición, "Confirmar recorte", indicador de progreso y mensajes claros en español rioplatense.
- Criterio de aceptación: seleccionar tamaño, posicionar rectángulo con overlay, obtener bbox, consultar Overpass, transformar a formato interno y cargar como mapa base jugable. Seed sigue funcionando.
- **Estado:** pendiente de implementación (no bloquea F2). No se implementa aún hasta confirmación explícita.

---

## Tasks

| ID | Fase | Specs | Ruta | Estado | Evidencia |
|----|------|-------|------|--------|-----------|
| T1 | F0 — Base técnica | S1, S5, S10, S11, S13 | inline | **hecho** | commits `4deec99`, `dfa89c7`, `e75a032`; 30 tests verdes; `npm run build` OK |
| T2 | F1 — Edición (bulldozer, calles, zonas, guardado) | S2, S4, S7, S14, S15, S17 | inline | **hecho** | commits `eeeee5a` (F1), `08e79ec` (bloque 2×2/4×4), `02a5296` (picking); 69 tests verdes; `npm run build` OK |
| T3 | F2 — Simulación (RCI, crecimiento, energía, presupuesto) | S2, S4, S18, S19, S20 | inline | **hecho** | commits `c307c8f` (feat), `724fb47` (fix + wiring); 93 tests verdes en la base F2; `npm run build` OK |
| T3b | Bugfix F2 (calle lindera en demanda, picking en desnivel) + reloj S21 | S17, S18, S21 | inline | **hecho** | RED observado (5 tests nuevos en rojo); commits `aa7ad06` (fix), `5061372` (feat), `c3529b6` (docs); 113 tests / 14 suites verdes; `tsc --noEmit` 0; `vite build` OK |
| T3c | Bugfix: crisis de caja permanente al arrancar + caja inicial siempre | S20 | inline | **hecho** | RED observado (3 tests en rojo); commits feat + docs (ver L16); 117 tests / 14 suites verdes; `tsc --noEmit` 0; `vite build` OK |
| T3d | Guardado de la simulación (formato v2) + originalidad S0 | S0, S20, S22 | inline | **hecho** | commit `ecb4cbc`; RED observado (5 tests); verificador independiente PASS (L17) |
| T4 | F3 — UI (toolbar, panel, consulta, diario) | S7, S8, S23–S26 | inline (sin motivo de writer: una sola unidad que comparte main.ts/index.html) | **hecho** | RED observado (módulos `report`/`news` inexistentes); 134 tests verdes; ver L18 |
| T5 | F4 — Arte propio, primer lote | S3, S1 | — | pendiente | — |

### T1 — Criterios de aceptación (cumplidos)

- El proyecto levanta con `npm run dev` y sirve HTML + módulos TS transpilados (verificado por HTTP: 200 en `/` y `/src/main.ts`).
- Renderer isométrico con cámara: pan (arrastrar/flechas/WASD), zoom (rueda/`+`/`-`), 4 rotaciones (`R`), centrado (`Home`).
- Terreno procedural determinista (semilla), agua y relieve, con tiles generados por código (ningún asset original cargado).
- `npm test` → 30 tests verdes; `npx tsc --noEmit` sin errores; `npm run build` → 11.45 kB JS.
- HUD en español rioplatense con rotación, zoom, semilla, celda y superficie bajo el cursor.

Entregable de T1 (F0): proyecto Vite+TS que levanta, renderer isométrico con cámara (pan/zoom/4 rotaciones), terreno procedural determinista con agua y relieve, tiles placeholder generados por código, y tests que cubren la matemática isométrica y la determinación del terreno.

---

## Log

### L1 — Pedido original del usuario (verbatim)
> "Ahi en la carpeta en el plan.md está la idea, y en la carpeta ORIGINAL está el juego simcity 2000 original y un reverse engineer del mismo.
> La idea es correr en navegador ese juego pero reversionado a esa idea plasmada en el plan. te parece? haceme preguntas antes de comenzar con el proyecto."

### L2 — Preguntas y respuestas de kickoff
- **Gameplay:** "Esencia fiel + identidad argentina" — simulación con reglas SC2000 (R/C/I, demanda RCI, energía, presupuesto) y contenido argentino. No es clon 1:1.
- **Arte:** "Arte propio como meta, originales como placeholder temporal."
- **v1:** "Vertical slice jugable" — terreno + bulldozer + calles + zonas + crecimiento + energía + presupuesto. v2: agua potable, tránsito, contaminación, crimen, valor del suelo, desastres, `.SC2`, audio.
- **Stack:** "TypeScript + Vite + Canvas 2D".
- **Destino:** "Local por ahora, publicable después."
- Supuestos aceptados sin objeción: UI en español rioplatense, notificaciones estilo diario argentino ("El Diario del Conurbano"), v1 sin audio, código en la raíz con `ORIGINAL/` intacto e ignorado, git local con commits por unidad de trabajo sin push.

### L3 — Corrección del usuario (verbatim)
> "\"Intendente\" en vez de alcalde, y todo lo demas si como decis me vá."

O sea: copy de UI en español rioplatense confirmado, con **"Intendente"** en lugar de "Alcalde" (ver S7).

### L4 — Pedido de continuidad documental (verbatim)
> "Me gusta eso que vayas documentando y dejando constancia, si es posible dejá una miniguia por si voy cambiando de modelos y eso."
> "Mandale"

Acción: se mantiene este documento y se crea `odd/CONTINUIDAD.md` como guía de handoff entre modelos/agentes. Autorización explícita para arrancar con F0.

### L5 — Reconocimiento del material original (evidencia)
`ORIGINAL/` contiene: el SC2000 Special Edition DOS completo (`DOS/SC2000.DAT`, `SC2K.EXE`, `RESOURCE.URK`, `TEMPLATE.URK`, XMI/VOC/BNK), un emulador js-dos ya montado en `ORIGINAL/public/index.html`, y reverse engineering en `ORIGINAL/reverse_engineering/` con `formats.md` (índice de `SC2000.DAT`, sprites `.HED`/`.DAT`, ciudades `.SC2` con IFF+RLE, URK, XMI, VOC) y assets extraídos en `ORIGINAL/extracted/` (música, efectos, fuentes, `LARGE.DAT`/`SMALL.DAT`/`.HED`, `MINE.PAL` de 768 bytes).

Los `TILE*.RAW` extraídos del URK pesan 68 bytes: son íconos chicos, no los tiles de terreno. Por eso los tiles de F0 se generan por código (procedurales), y el pipeline queda listo para consumir assets reales con `MINE.PAL` más adelante (S3, T5).

### L6 — Arranque de F0
Creación del feature document y de la minigüía de continuidad; `git init` en la raíz; `.gitignore` que excluye `ORIGINAL/`, `node_modules/` y `dist/`. Esqueleto Vite+TS y tests de la matemática isométrica y del terreno determinista.

### L7 — F0 entregado (T1)
Entorno: Node 24.15, npm 11.12, git 2.45 Windows. Dependencias efectivamente instaladas: TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.5 (dev).

Entregado, en cuatro commits sobre `main`:

| Commit | Contenido |
|---|---|
| `8791373` | `docs:` feature document, minigüía de continuidad, `.gitignore`, `PLAN.md` |
| `4deec99` | `build:` scaffold Vite + TypeScript, `index.html` con HUD |
| `dfa89c7` | `feat:` proyección isométrica, modelo de mundo, terreno determinista + tests |
| `e75a032` | `feat:` renderer isométrico con pan/zoom/4 rotaciones + cámara, controles, bootstrap + tests |

Evidencia observada:
- `npm test` → **30 tests verdes** (4 archivos: `iso`, `terrain`, `render`, `renderer`).
- `npx tsc --noEmit` → sin errores. `npm run build` → `dist/assets/index-*.js` de **11.45 kB** (4.67 kB gzip), 12 módulos.
- Dev server (`vite --port 5199`): `GET /` → 200 con el canvas `#mapa`; `GET /src/main.ts` → 200 transpilado.
- Determinismo del terreno verificado: semilla 7 → agua 27.4% (pampa 41.0%, arena 12.9%, tierra 15.9%, roca 2.8%), alturas 0–10 con distribución natural; semillas distintas → mundos distintos.

Dos defectos encontrados por los tests nuevos, ambos corregidos antes de cerrar:
1. **Offset horizontal del bitmap corto en media celda** (`gridOffset.sx`): la punta izquierda del rombo de la celda del borde se salía 8 px del canvas. Detectado por el test de encaje `tests/render.test.ts`; corregido a `size * CELL_W / 2`.
2. **Altura del bitmap sin margen inferior suficiente**: el borde del mapa dibuja una pared de un nivel completo (`wallDrop` contra `z = -1`), así que `gridExtent` necesita `(maxZ + 1) * ELEV_STEP` de alto.

Dos errores propios de test, corregidos en el camino (no eran defectos del código): componer las rotaciones 0,1,2,3 en secuencia no es la identidad (suman media vuelta), y el repintado de cada rotación no cuesta la misma cantidad de llamadas de dibujo porque cambia la cantidad de paredes y glints.

### L8 — Verificación nativa (RDD) de T1
RDD está **on (global)**. `gentle-ai review assess` sobre el árbol limpio devuelve `unassessable` (todo commiteado), así que se evaluó por rango:

| Candidato | Resultado nativo |
|---|---|
| `--base-ref 4deec99 --committed-only` (los dos commits de código) | `risk: medium`, `review_due: false`, `review_due_reason: under_budget`, 12 paths, 1603 líneas |
| `--base-ref 8791373 --committed-only` (incluye el scaffold) | `risk: medium`, `review_due: false`, `review_due_reason: under_budget`, 17 paths, 3332 líneas |

`review_due: false` con razón `under_budget`: el slice queda **pendiente** sobre la base `4deec99`, sin review todavía, y la frontera no avanza. No se escaló a mano: F0 no toca ningún ítem de riesgo alto (ni datos almacenados, ni seguridad, ni contratos que otros consuman, ni concurrencia, ni pipeline de entrega).

Chequeo diferencial: **no aplica** (F0 es greenfield: no existe comportamiento previo que pueda regresar).
Línea de riesgo de T1: **Risk: none** (código nuevo, local, sin contrato publicado ni efectos irreversibles; cubierto por 30 tests y verificación de límites del bitmap).

### L9 — Decisión de unidad de diseño (verbatim del usuario)
Pregunta: "¿Cómo modelamos calles, zonas y edificios: por bloques de 4×4 celdas o por celdas sueltas?"
Respuesta del usuario:
> "Pintar por bloques de 4×4, guardar por celda (Recomendado)"

Se registra como **S14**: autoría y dibujo por bloque de 4×4, almacenamiento por celda. Alcanza también a los edificios de F2. Desbloquea T2 (F1) y fija la escala del arte de F4.

Se agrega **S15** acotando F1: el bulldozer de esta fase limpia calles y zonas, pero **no aplana terreno** (el original sí lo hace; sin deshacer, mutar el terreno guardado es un riesgo que no vale la pena en esta fase). La barra de herramientas visual queda para T4.

### L10 — T2 (F1) entregado
F1 implementado en commit `eeeee5a` con:
- `src/world/edit.ts`: operaciones por bloque (`blockAt`, `blockOrigin`, `canPlaceRoad/canZone`, `paintRoadBlock`, `paintZoneBlock`, `bulldozeBlock`, `applyTool`), `MAX_BLOCK_SLOPE = 3`.
- `src/world/save.ts`: serialización versionada empaquetada por celda (`SAVE_VERSION=1`), `serializeWorld/deserializeWorld`, `saveNamed/loadNamed/removeNamed`, clave `argentina-city-3000/<nombre>`.
- `src/engine/overlay.ts`: `OverlayRenderer` (calles + zonas), `traceBlockOutline`, `drawBlockHighlight`, uso exclusivo de helpers probados (`rotateCoords`, `blockAt/blockOrigin`).
- `src/main.ts`: herramientas 1-6 (consulta, calle, zona R/C/I, bulldozer), pintado click/drag, overlay invalida tras cada edición, highlight del bloque bajo cursor, teclas `G` guardar / `C` cargar con aviso en HUD, HUD muestra herramienta activa + superficie con calle/zona.
- `src/input/controls.ts`: botón izquierdo pinta cuando hay herramienta activa, botón medio/arrastre pan siempre.
- `src/art/palette.ts`, ajustes menores en `grid.ts`, `terrain.ts`, tests compartido `tests/helpers/recordingContext.ts`.

Evidencia:
- `npm test` → **64 tests verdes** (7 archivos: iso, terrain, render, renderer, edit, save, overlay).
- `npx tsc --noEmit` → sin errores. `npm run build` → `dist/assets/index-Bb_P5up5.js` de **20.46 kB**, HTML 3.45 kB.
- Dev server en `http://localhost:5199` → 200 OK.

Línea de riesgo de T2: **Risk: none** (ediciones locales sobre mundo en memoria, validaciones estrictas, serialización defensiva con rechazos explícitos; F1 no toca datos persistidos en producción ni contratos publicados). No se requiere revisión nativa (`review_due` previo a F1 fue `under_budget` y este slice sigue dentro del presupuesto acumulado; la frontera nativa permanece pendiente sobre base `4deec99`).

---

### L11 — Cambio de tamaño de bloque 2×2/4×4
Commit `08e79ec`: tamaño de colocación seleccionable entre 2×2 y 4×4 con tecla `B`. Afecta colocación (calles, zonas, bulldozer), highlight y HUD (muestra el tamaño activo). No se persiste en save: la grilla sigue siendo la fuente de verdad por celda.
Evidencia: 64 tests verdes, tsc limpio, build OK (20.70 kB JS). Docs recuperadas de `df81bd4` tras pérdida accidental de la sección Tasks/Log.

---

### L12 — Picking con elevación (S17)
El highlight y las herramientas quedaban ~un bloque "arriba" del mouse porque `screenToGrid` invierte la proyección en el plano z = 0 y el terreno real tiene relieve (la pampa está en z ≈ 3, ~24 px arriba de donde el picking cree).
Commit `02a5296`: `src/engine/picking.ts` con `pickCell` (devuelve la celda más alta cuya cara superior contiene el punto), `tests/picking.test.ts` (5 tests: plano, acantilado, relieve real ×4 rotaciones, fuera de mapa). `main.ts` reemplaza `screenToGrid` por `pickCell`.
Evidencia: 69 tests verdes (64 + 5), tsc limpio, build OK (21.11 kB JS).
Línea de riesgo: **Risk: none** (picking local, sin efectos persistentes; cubierto por tests que exigen que la cara de la celda elegida esté bajo el cursor).

### L13 — F2 — Simulación completa
Se implementaron los sistemas de demanda (S18), energía y tendido (S19), crecimiento de edificios (S20) y presupuesto (S20), junto con el motor de simulación que avanza la ciudad tick a tick. Los tests de F2 pasaron y el build quedó OK.

### L14 — Bug: el juego no se veía + cableado final de F2
Reporte del usuario: se veía la interfaz y el cursor cambiaba, pero el terreno no aparecía (canvas vacío).

Causa raíz: `main.ts` importaba `DEFAULT_PLACEMENT_SIZE`/`PlacementSize` de `./world/edit`, que solo los importa de `iso.ts` sin re-exportarlos → el navegador tiraba `SyntaxError: does not provide an export named ...` al cargar el módulo, `main()` nunca se ejecutaba → canvas vacío con HTML/CSS intactos. Además `budget.ts` y `simulation.ts` tenían exports duplicados (parse failures reales de vitest que había atribuido mal a la herramienta).

Además del arreglo de imports (tsc limpio), se corrigieron dos problemas de diseño de F2 destapados por los tests:
1. **Balance**: `totalEnergyConsumed` sumaba toda la red disponible (miles/tick) → déficit eterno; y la congelación a los 5 ticks bloqueaba el arranque (ciudad nueva sin ingresos nunca crecía). Nuevo balance: impuestos R4/C6/I8 por nivel, energía = `ENERGY_COST`(1) por nivel de edificio **con luz**, usina fijo 6, tolerancia de déficit 60 ticks.
2. **`syncBuildings`** en `tickSimulation`: reconcilia `buildings[]` con los bloques zonados (antes el array quedaba vacío y nada crecía nunca; bulldozer/repintado eliminan/actualizan edificios solos).

Cableado nuevo de F2 en interfaz: herramienta **Usina** (tecla 7, grilla fija 4×4, valida con `canZone` + no zonificado, `computePower` al agregar/quitar), `overlay.setMarkers` dibuja usinas (losa de cemento) y edificios extrudados por nivel (placeholder hasta F4), HUD con **Saldo** (ing/gastos/crisis) y **Usinas**, detalle `con luz/sin luz` en la celda consultada, ayuda actualizada, badge F2.

Evidencia: `tsc --noEmit` ✓ 0 errores; `vitest run` ✓ **105 tests / 13 suites verdes**; `vite build` ✓ 22 módulos, 26.39 kB (Rollup habría fallado con exports faltantes, que era el bug).
Línea de riesgo de T3: **Risk: none** — correcciones de balance dentro de S20 sin contratos externos; cambios de interfaz locales (HTML propio).

Commit de esta unidad de trabajo: `724fb47` (`fix(sim): restore module load and wire F2 into the UI`, 10 archivos).

### L15 — Bugs F2: no crecían casas + selector saltaba en desniveles; reloj pedido (T3b)

Reporte del usuario (verbatim, 2026-10-18):
> "No veo ninguna casita moverse la verdad ni aparecer, además no hay referencia de tiempo como para saber si pasa o no, estaria bueno eso. Tambien otra cosa que ocurre es que el selector está justo en un desnivel, este se desplaza re lejos. (Con desnivel me refiero a el 'salto' de altura que hay de una altura a otra)"

Diagnóstico (RED primero: 5 tests nuevos observados en rojo):
1. **No crecía nada:** `computeDemand` exigía una celda de calle **en el mismo bloque zonado**, pero `applyTool` no permite calle y zona en un mismo bloque (se limpian mutuamente) → la demanda era siempre 0 en una partida real; los tests existentes lo tapaban pintando calle y zona a mano sobre el mismo bloque. Además `hasNearbyStreet` solo miraba una ventana de 3×3 **celdas** alrededor del origen del bloque, no la vecindad de bloques que decía cubrir.
2. **Selector que salta en desniveles:** sobre un **muro** de desnivel ninguna cara superior contiene el punto → `pickCell` caía al fallback del plano z=0, que devolvía una celda desplazada hacia atrás (en pampa: (1,1) donde el cursor estaba en (2,2)); el highlight de bloque amplificaba el salto. Entre caras superpuestas elegía "la más alta", que no siempre es la visible.

Correcciones (GREEN):
- `demand.ts`: `hasStreetNear(world, bx, by)` — radio 1 **en bloques** (bloque propio + 8 linderos, clamp al borde del mapa) como única fuente de verdad; `computeDemand` la usa. `simulation.hasNearbyStreet` delega en ella (re-export de `STREET_RADIUS`).
- `picking.ts`: reescrito — recorre las celdas en **orden de pintura inverso** (adelante hacia atrás) y devuelve la primera superficie visible que contiene el punto: cara superior, o el muro estricto (espejo de `renderer.paintWalls`, bordes estrictos para no romper los picks de cara). El plano z=0 queda solo como fallback cuando no hay superficie visible. Orden de pintura cacheado por (size, rotation).
- Reloj S21: `src/world/clock.ts` (`dateFromTicks`, `TICKS_PER_MONTH=60`, `MONTHS` es-AR, `START_YEAR=1990`), fila **Tiempo** en el HUD, `simTicks` en el loop de `main.ts`.

Evidencia: RED observado (4 tests nuevos fallan + módulo `clock` inexistente); GREEN: `tsc --noEmit` ✓ 0 errores, `vitest run` ✓ **113 tests / 14 suites verdes**, `vite build` ✓ 23 módulos 27.04 kB, dev server 200 con `hud-tiempo` presente.

Línea de riesgo de T3b: **Risk: none** — reglas de demanda dentro de S18 (sin contrato externo), picking local con tests, reloj derivado de ticks sin estado persistido nuevo.

---

### L16 — Bug: crisis de caja permanente al arrancar + caja inicial siempre (T3c)

Reporte del usuario (verbatim, 2026-10-18):
> "No veo ningun edificio, tendráq uev er con el problema de caja? dame dinero inicial siempre"

Diagnóstico (RED primero: 3 tests nuevos observados en rojo — exactamente los escenarios del bug):
El usuario acertó con la sospecha. `advanceBudgetTick` congelaba la demanda tras 60 ticks con `saldo < 0`, y una ciudad nueva nace con cero ingresos y gastos permanentes en cuanto pone la primera calle (y la usina): la congelación se armaba en los primeros 6 s —a menudo **antes** del primer edificio— y era permanente: sin edificios no hay ingresos, y sin ingresos el saldo nunca vuelve a ser positivo. El fix de la calle lindera (L15) estaba bien, pero este deadlock lo tapaba igual.

Correcciones (GREEN):
- `budget.ts`: nuevo `Budget.caja` (stock) + `INITIAL_CASH = 100000` en `emptyBudget()` — toda partida, nueva o cargada, arranca con la reserva ("siempre": el presupuesto no se persiste en el guardado). `computeBudget` pasa a devolver solo el flujo (`BudgetFlow`: ingresos/gastos/saldo).
- Regla de congelación reescrita: crisis solo con **caja en rojo Y saldo en rojo** durante `DEFICIT_TOLERANCE_TICKS` consecutivos; se levanta en cuanto la caja vuelve a cero o el saldo deja de sangrar (recuperable, sin deadlock — los edificios existentes siguen pagando aunque la demanda esté congelada).
- `simulation.ts`: `budget.caja += budget.saldo` por tick.
- HUD: fila **Caja** (`#hud-caja`) con formato es-AR antes de Saldo; el aviso `¡crisis de caja!` sigue en la línea de saldo.

Evidencia: RED observado — 3 fallos exactos ("la caja saneada" congelaba igual, "la caja al día" no descongelaba, la ciudad real quedaba muerta antes de zonar); GREEN: `tsc --noEmit` ✓ 0 errores, `vitest run` ✓ **117 tests / 14 suites verdes**, `vite build` ✓ 23 módulos, 27.13 kB.

Línea de riesgo de T3c: **Risk: none** — cambio de balance interno de S20 (sin contrato externo), regla cubierta por tests, HUD propio.

---

### L17 — Revisión del proyecto, originalidad y guardado de la simulación (T3d)

Pedido del usuario (verbatim, 2026-11-11):
> "Me gustaria que continues con este proyecto, revisá primero lo  que hay y si hace sentido"

Revisión: 117 tests verdes y build OK. Hallazgos: (1) el guardado solo persistía la grilla, así que cargar perdía edificios y usinas, heredaba los de la sesión anterior y reiniciaba la caja (plata infinita con guardar/cargar); (2) `CONTINUIDAD.md` desactualizado; (3) posible choque entre pintar en 2×2 y edificios de 4×4 con zona mayoritaria (a verificar, sin confirmar).
Propuesta de rumbo: el agente no recrea un juego existente ni su look ni usa sus assets; se sigue como city-builder original del género (S0), sin placeholders de `ORIGINAL/` y sin import `.SC2`.

Aprobación del usuario (verbatim): > "Seguí"

Cambios:
- Specs: nuevo **S0** (originalidad), S3 y S4 ajustados, enmienda de S20 (la caja se retoma al cargar), nuevo **S22** (guardado de la simulación).
- `save.ts`: formato v2 con `sim` validado campo por campo; sigue leyendo v1.
- `session.ts` (nuevo): `snapshotOf` / `restoreSim`, el puente entre la simulación en vivo y el guardado.
- `main.ts`: guardar incluye la simulación; cargar la restaura y nunca hereda la de la ciudad anterior.

Evidencia: RED observado (5 tests nuevos de `save.test.ts` en rojo); GREEN: `tsc --noEmit` 0 errores, `vitest run` **124 tests / 15 suites verdes**.

Línea de riesgo de T3d: **Risk: item 1 (cambio de formato persistido)** — mitigado: los v1 siguen cargando (test) y la validación rechaza snapshots imposibles (tests).

Verificación independiente de T3d (riesgo alto, item 1): **PASS, sin bloqueantes**. Probó round-trip, v1, 26 guardados corruptos, bordes de bloque, independencia de referencias y que los 117 tests de la base sigan pasando contra el código nuevo. Advertencias sin impacto en specs: un v2 sin `sim` carga como v1; se aceptan edificios duplicados en un mismo bloque; `demandFrozen` no se guarda y se recalcula en el primer tick.

### L18 — F3: interfaz (T4)

Entregado según S23–S26:
- **Barra de herramientas** (`#toolbar`): un botón por herramienta generado desde `TOOLS`, más bloque 2×2/4×4, Presupuesto, Guardar y Cargar. Resalta la herramienta activa (`aria-pressed`) y el teclado sigue igual.
- **Presupuesto** (`P` o botón): `budgetBreakdown` en `budget.ts` es ahora la única regla y `computeBudget` la resume (con test de igualdad).
- **Consulta**: `Controls.onClick` (clic sin arrastrar, tolerancia de 4 px) abre la ficha armada por `describeBlock` (`report.ts`), con nombres por nivel. Se actualiza con cada tick.
- **El Diario del Conurbano**: `headlinesFor` (`news.ts`) compara el estado de la ciudad entre ticks y muestra los últimos 5 titulares. Cargar una ciudad no genera titulares.

Evidencia: RED observado (`report.test.ts` y `news.test.ts` fallaban por módulo inexistente); GREEN: `tsc --noEmit` 0 errores, `vitest run` **134 tests / 17 suites verdes**, `vite build` 33.84 kB. Smoke test del dev server: 200 en `/`, `/src/main.ts` y `/src/world/news.ts`, con los cuatro contenedores nuevos en el HTML. **Sin prueba visual en navegador** (pendiente del usuario). Sin test unitario de `Controls.onClick` (no había tests de `Controls`).

Línea de riesgo de T4: **Risk: none**. Es UI propia, sin contratos externos ni datos persistidos. `computeBudget` mantiene su contrato, cubierto por los tests de presupuesto existentes y por el test de igualdad.
