# Más ciudades reales y edificios de costa

Objetivo: poder empezar a jugar en varias ciudades argentinas reales, y tener cosas para construir sobre el agua.
Rama: `feat/vertical-slice` · Entrega: commits por unidad en la rama (sin PR pedido) · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit` · Mapas: `npm run bake-maps`
Antecedente: los mapas reales (Mar del Plata) están descritos en `odd/tasks/argencity-3000.md`, S15 y L11.

## Specs

- **S1 — Más ciudades (verbatim):** "te gustaria implementar mas ciudades para empezar a jugar? esta Mar del Plata ahora nada mas." → propuesta de seis, elegidas para que jueguen distinto: "Buenos Aires (centro y puerto): llano, río ancho. Rosario: barranca sobre el Paraná. Córdoba: el río Suquía cruzando la ciudad. Mendoza: pie de monte, con pendiente. Bariloche: lago y montaña, poco lugar llano. Ushuaia: canal y cerros." → respuesta: "Bien, implementá esas zonas". Cada una se prepara con el mismo script que Mar del Plata, viene incluida en el juego, aparece en la pantalla de inicio con su nombre y una línea de descripción, y se puede jugar solo con la geografía o también con las calles. Mar del Plata no cambia. Supuestos: el tamaño (128, 192 o 256 lotes) y los metros por nivel de altura se eligen por ciudad para que el mapa sea jugable (en las de montaña cada nivel representa más metros que en la costa); se mantiene la atribución de OpenStreetMap y del relieve.
- **S2 — Puertos y cosas de mar (verbatim):** "lo que si sabes que falta? antes de seguir con lo de los mapas, falta que haya puertos y cosas de mar para colocar". Propuesta: "Puerto de carga: mejora las tasas de las fábricas conectadas y la demanda industrial; contamina y carga las calles. Muelle de pescadores: chico y barato, da empleos. Costanera: sube el valor del suelo y la aprobación. Balneario: turismo fuerte en verano, casi nada el resto del año. Faro: uno por ciudad, como edificio único." Respuesta: "Me gusta la idea de los edificios de la costa". Reglas (supuestos del padre, a confirmar jugando); la lista de edificios, de herramientas, de umbrales y de precios es cerrada:
  - **Dónde se colocan:** son lotes de un solo casillero, sobre tierra libre (no agua). "Junto al agua" = alguno de los 8 casilleros vecinos es agua. Puerto, muelle, costanera y balneario exigen estar junto al agua; el balneario además exige playa (tierra con alguna esquina a nivel del mar o más baja, `hmin <= SEA_LEVEL`, la misma regla con la que se dibuja la arena en `mapRenderer.ts`); el faro puede estar en tierra a 2 casilleros o menos del agua. En un mapa sin agua no se puede colocar ninguno y el cartel dice que tiene que estar sobre la costa. Ninguno nivela el terreno ni conduce la luz.
  - **Funcionan** si tienen calle a 3 lotes o menos (`roadAccess`). No necesitan luz. La costanera y el faro no necesitan nada.
  - **Muelle de pescadores** (herramienta `fishing`, tecla Z): $400, mantenimiento $30 por mes, se habilita en Caserío (100). Funcionando: 12 empleos industriales y $80 por mes de ventas de pescado.
  - **Costanera** (`promenade`, tecla X): $25 por lote y se arrastra como la plaza, mantenimiento $2 por lote, se habilita en Pueblo (200). Sube el valor del suelo como una plaza pero más fuerte (radio 4, fuerza 20, contra 14 de la plaza). Suma al apoyo de los vecinos un factor "Costanera" de 1 punto cada 8 lotes, hasta 5.
  - **Puerto de carga** (`port`, tecla V): $2.500, mantenimiento $200 por mes, se habilita en Ciudad (1.000). Funcionando: 40 empleos industriales; las tasas industriales rinden un 15 % más por puerto funcionando, hasta un 45 %; contamina (radio 4, fuerza 25); cuenta como destino de trabajo industrial en la congestión (así las calles que llegan se cargan).
  - **Balneario** (`resort`, tecla L): $1.800, mantenimiento $120 por mes, se habilita en Ciudad (1.000). Funcionando: 30 empleos comerciales; turismo de $450 por mes en diciembre, enero y febrero, $120 en noviembre y marzo, y $20 el resto del año. Los presupuestos de esos meses usan la temporada del mes que corresponde (hemisferio sur); el estimado del presupuesto sin mes usa el promedio anual.
  - **Faro** (`lighthouse`, tecla F): $1.500, mantenimiento $60 por mes, uno solo por ciudad, se habilita en Gran ciudad (5.000). Suma 3 puntos a la aprobación (factor "Faro") y valor del suelo (radio 6, fuerza 12).
  - **Interfaz:** una categoría nueva "Costa" en la barra con las cinco herramientas, íconos y sprites propios, minimapa, ficha de consulta que dice qué hace, si funciona y por qué no, y la temporada en el balneario; líneas nuevas en el presupuesto ("Costa" en gastos, "Pesca y turismo" en ingresos); titulares: el primer puerto, el comienzo de la temporada (diciembre) y la temporada baja (marzo) cuando hay al menos un balneario; ayuda actualizada.
  - **Guardado:** formato 7 (los casilleros nuevos; las partidas 1 a 6 siguen abriendo).
- **S4 — Las Flores como mapa jugable (verbatim):** "ahora te pido si podes agregar "Las Flores" (Pueblo de la
  provincia de Buenos Aires, no te lo confundas con "Flores") como mapa jugable? es bastante chico el
  pueblo yo creo que se puede agarrar todo". Se hornea con el mismo script que las otras ocho y se suma
  al final de `PRESETS`, así que aparece en la pantalla de inicio y se juega con o sin las calles
  reales. Decisiones: es el pueblo de la provincia (`-36.0143, -59.0999`, Partido de Las Flores), no el
  barrio porteño; su ejido mide 4,9 por 6,2 km, así que se toma 256 lotes de 25 m (6,4 km de lado) para
  que entre entero con margen; 5 metros por nivel de altura, que es una llanura. El horneado encontró
  agua real: la laguna La Blanca y la del Difunto Manuel.
- **S3 — Elegir una zona en un mapa (verbatim, pedido anterior):** "lo que queria implementar de mirar un mapa, elegir una zona y transformarlo para poder jugar". Queda para después de S2, por pedido del usuario.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Seis ciudades reales | S1 | delegado (Sonnet, relevado dos veces por cortes: límite de uso y reinicio) | hecho | commit `feat(maps): …`; RED observado (24 pasan y 3 fallan sin Ushuaia ni las entradas de la lista); 45 tests de mapas, terreno y guardado verdes; hash de Mar del Plata idéntico (mismo archivo y re-horneado en una carpeta aparte) |
| T2 Edificios de costa | S2 | delegado (writer H, Sonnet; superficies separadas de T1) | hecho; verificación independiente PASS (L6) | commit `feat(coast): …`; RED observado (`sim/coast` inexistente, después herramientas y casilleros); 65 tests nuevos; verificación del padre: `tsc` limpio y 449 tests; sonda de 15 años idéntica antes y después; Chrome headless del agente: Costa con cinco filas, bloqueos, colocación y rechazos, fichas, presupuesto y deshacer, sin errores |
| T3 Elegir una zona en un mapa | S3 | a definir | pendiente | — |
| T4 Las Flores jugable | S4 | `scripts/bake-maps.ts`, `public/maps/las-flores.json`, `src/world/presets.ts` | hecho | `npm run bake-maps -- las-flores`: agua 4 %, 9.743 lotes de calle, 1.104 árboles, altura máxima nivel 6; `tests/realmap.test.ts` en 32 verdes con la ciudad en la lista |

## Log

- **L1 (2026-11-13), pedido (verbatim):** "Ehhh, te gustaria implementar mas ciudades para empezar a jugar? esta Mar del Plata ahora nada mas. Aparte lo que queria implementar de mirar un mapa, elegir una zona y transformarlo para poder jugar, que onda? muy dificil?" y después "Bien, implementá esas zonas, lo que si sabes que falta? antes de seguir con lo de los mapas, falta que haya puertos y cosas de mar para colocar".
- **L2 (2026-11-13):** dicho al usuario sobre S3: el conversor ya existe (`scripts/bake-maps.ts`, `scripts/mapgen/geo.ts`); faltaría un mapa navegable para elegir el recuadro, pedir los datos desde el navegador (los servidores públicos de calles tardan y a veces están saturados) y confirmar que el servidor de relieve acepta pedidos desde una página; el juego pasaría a depender de internet para esa opción y nadie revisa el resultado.
- **L3 (2026-11-13), el usuario aprobó los cinco edificios (verbatim):** "Me gusta la idea de los edificios de la costa". El padre fijó las reglas de S2 (precios, umbrales, teclas, hitos) sin consultar cada número; son el primer punto a revisar jugando. Se prefirió que ninguno necesite luz y que todos sean de un lote, para no tocar la red eléctrica ni agregar huellas nuevas.
- **L4 (2026-11-13):** T1 pasó a un agente con Sonnet (pedido del usuario) porque el anterior se cortó por el límite de uso; Buenos Aires ya estaba generada cuando se lanzó T2.
- **L5 (2026-11-13), T2 costa, reporte del writer H verificado por el padre.** Implementado según S2: `src/sim/coast.ts` (reglas de colocación y mensajes, temporada, si funciona, empleos, presupuesto, aumento del puerto), casilleros 12 a 16, herramientas Z X V L F en la categoría "Costa" (seis categorías), líneas "Costa" y "Pesca y turismo" en el presupuesto (el estimado anual usa el promedio del año), `monthlyBudget` con mes opcional, la semana y el cierre del mes usan la temporada del mes que corresponde (al cerrar el mes `state.tick` ya avanzó: el mes que terminó es `dateOf(tick - 1)`), titulares de la primera usina portuaria, "Arranca la temporada" (diciembre) y "Terminó la temporada" (marzo), guardado 7.
  - Decisiones que el spec dejaba abiertas y tomó el writer: el faro usa la misma distancia de 8 direcciones que "junto al agua"; el puerto solo contamina si funciona; solo el puerto es destino de trabajo en la congestión (el muelle y el balneario suman empleos al total pero no son destinos de viaje); el faro "uno por ciudad" toma solo el primer lote válido de un trazado; la costanera no necesita calle; el estimado de saldo anual dejó de usar el mes actual para que un balneario en verano no lo infle; temporadas "alta (verano)", "entretemporada" y "baja".
  - Sin verificar por el writer: el menú desplegable con las herramientas ya desbloqueadas (solo con tests unitarios y los avisos de bloqueo) y los sprites de cerca; el muelle es el sprite menos legible. En el mapa de semilla fija toda la costa es arena, así que los rechazos "sin playa" y "barranca" están probados en `tests/coast.test.ts` y no en el navegador.
- **L6 (2026-11-13), verificación independiente de `82ad5c2` (ítem 1, formato de guardado 7), contra la base `88ebd69`:** PASS, sin bloqueantes (Sonnet, copia exportada, 227 comprobaciones; la única falla fue una expectativa errónea de la propia sonda sobre el borde del faro, el código está bien). Cuatro ciudades guardadas como v6 por el código base cargan idénticas salvo las dos claves de presupuesto nuevas en 0; las versiones 1 a 5 también; ida y vuelta estable con los cinco casilleros; un casillero 17 y valores no enteros en `coast`/`coastIncome` se rechazan; presupuesto, red eléctrica, humo, valor del suelo, congestión, aprobación y 300 ticks de simulación idénticos a la base en ciudades sin costa; las cuatro cuotas semanales de cada mes suman el saldo del mes para los doce meses de inicio, incluso en los cambios nov→dic y feb→mar, y una partida guardada a mitad de mes y retomada termina con la misma caja. Advertencias, sin cambios: (1) el guardado solo valida el rango de los casilleros, no su ubicación, así que un archivo editado a mano con un balneario en el agua o dos faros abre; (2) un v7 sin las claves `coast` se carga con 0 en vez de rechazarse (por indulgencia heredada de v6); (3) el mensaje de rechazo del faro dice "Ya hay un faro" aunque el lote además esté lejos del agua.
- **L7 (2026-11-13), T1 ciudades, reporte del writer verificado por el padre.** Seis mapas nuevos junto a Mar del Plata (sin cambios, mismo hash `3663b9d8…`), todos con su entrada en `PRESETS`, y cada uno carga con y sin calles (con calles, las heredadas no pagan mantenimiento hasta que se usan). Tabla (tamaño · metros por casillero · metros por nivel · agua · llano · calles · archivo): Buenos Aires 256 · 20 · 9 · 34 % · 52 % · 11.610 · 263 kB; Rosario 192 · 20 · 4 · 32 % · 47 % · 7.049 · 148 kB; Córdoba 192 · 20 · 8 · 2 % · 75 % · 13.351 · 148 kB; Mendoza 256 · 25 · 25 · 1,3 % · 90 % · 22.065 · 263 kB; Bariloche 192 · 25 · 30 · 35 % · 57 % · 8.115 · 148 kB; Ushuaia 192 · 20 · 20 · 19 % · 74 % · 6.364 · 148 kB. Opciones nuevas por ciudad en `scripts/bake-maps.ts` (`size`, `waterLevelM` para el lago de Bariloche, `waterwayMaxM` para Mendoza, caché de descargas y unión de contornos para lagos y ríos grandes). El writer miró una imagen aérea de cada una: el río y las dársenas de Buenos Aires, la barranca sobre el Paraná, el Suquía cruzando Córdoba, el piedemonte y el lago del Parque San Martín en Mendoza, el Nahuel Huapi y el cerro Otto en Bariloche, el canal Beagle y la bahía en Ushuaia.
  - Reservas: Mendoza tiene solo 1,3 % de agua (el piso del test es 1 %): el agua es el lago del parque y las acequias, no un río; no se probó en el navegador (solo por la carga de los datos y las imágenes); los mapas reales no reciben la ruta provincial y un test lo fija.
- **L7 (2026-11-19), Las Flores.** Pedido (verbatim): "ahora te pido si podes agregar "Las Flores" (Pueblo
  de la provincia de Buenos Aires, no te lo confundas con "Flores") como mapa jugable? es bastante chico
  el pueblo yo creo que se puede agarrar todo". Se verificó primero cuál es: Nominatim devuelve el
  pueblo como `Las Flores, Partido de Las Flores, Buenos Aires` en `-36.0143, -59.0999`, con un ejido de
  4,9 por 6,2 km, muy lejos del barrio de Flores de la ciudad. Con 256 lotes de 25 m el pueblo entra
  entero y sobran unos 100 m de cada lado. El horneado necesitó un reintento porque Overpass respondió
  502 la primera vez. Resultado: agua 4 % (laguna La Blanca, 1.368 lotes, y laguna del Difunto Manuel,
  1.053), 9.743 lotes de calle, 1.104 árboles y altura máxima nivel 6, o sea que el test de mapas reales
  pasa sin tocarle ningún umbral.

## Corrección: el puerto de carga dejaba de pagarse solo

> "Hay que nerfear los puertos y seguramente el aeropuerto, que propones?"

Medido en una ciudad madura (recaudación $870.509, impuestos industriales $309.645, el 36 % del
ingreso): tres puertos de carga daban **+$139.340 por mes, el 16 % de todo lo que entraba**, por tres
celdas de costa y $7.500 de obra. Se pagaban solos en 0,05 meses.

El problema es estructural: el bono es un porcentaje de una base que crece con la ciudad, y el puerto
cuesta siempre lo mismo. `PORT_TAX_BOOST` pasó de `{ perPort: 0.15, max: 0.45 }` a
`{ perPort: 0.05, max: 0.15 }`: los mismos tres puertos ahora aportan $46.447, el 5,3 % del ingreso.

Consecuencia buscada: con $600 de mantenimiento, tres puertos necesitan unos $12.000 de impuestos
industriales para cubrirse. En una ciudad chica trabajan a pérdida; en una grande son una buena
inversión. Un puerto necesita escala, que es lo razonable.

El aeropuerto y el puerto de paseos quedaron como estaban: medidos, rinden $42 y $80 netos por celda
contra $66 de una zona nivel 5, o sea que no están fuera de escala.
