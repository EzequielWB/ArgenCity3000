# ArgentinaCity 3000

City-builder isométrico para navegador con identidad argentina: fundás una ciudad, trazás calles, llevás la luz, zonificás barrios y la ves crecer mientras El Diario del Conurbano cuenta lo que pasa. Las mecánicas son las del género (zonas, demanda, energía, presupuesto), y el arte, la interfaz y los textos son propios: todo el arte se genera por código.

## Cómo jugarlo

```bash
npm install
npm run dev        # http://localhost:5273
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Tests de la lógica (Vitest) |
| `npm run build` | Typecheck y build de producción en `dist/` (se abre con cualquier servidor estático) |
| `npm run probe` | Simula 15 años de una ciudad sin navegador e imprime el balance año por año |
| `npm run bake-maps` | Vuelve a preparar los mapas reales (`public/maps/`); necesita internet. `npm run bake-maps -- mar-del-plata` prepara uno solo |

### Primeros pasos

1. **Usina** (tecla `9`): sin luz no crece nada.
2. **Calles** (`3`): se trazan arrastrando. Los lotes necesitan una calle a 3 lotes o menos.
3. **Zonas** residencial (`5`), comercial (`6`) e industrial (`7`): todo tiene que tocar la red, porque la luz viaja por calles, zonas y tendido eléctrico (`4`).
4. Mirá la **demanda R C I** arriba y la **caja**. Con la caja en rojo no se construye.
5. Las **plazas** (`8`), el agua y los árboles suben el valor del suelo, y eso permite edificios más altos. La industria contamina.
6. **Servicios públicos** (necesitan luz y cubren un radio): sin **salita** (`U`) las casas no pasan de chalet y sin **escuela** (`Y`) no hay torres ni oficinas. La **comisaría** (`I`) baja el delito y los **bomberos** (`O`) apagan incendios.

En el juego, `H` abre la ayuda completa con todos los controles.

## Qué tiene

- Mapas reales preparados de antemano (por ahora Mar del Plata): relieve, costa, agua y arboledas reales, con o sin las calles reales ya trazadas. Se preparan con `npm run bake-maps` a partir de OpenStreetMap y de datos abiertos de elevación, y quedan en `public/maps/`. Para sumar una ciudad se agrega a `CITIES` en `scripts/bake-maps.ts` y a `PRESETS` en `src/world/presets.ts`.
- Mapas inventados a partir de una semilla, de cuatro tipos (`src/world/mapkinds.ts`): **Con salida al mar** (lomas suaves, la costa de un río ancho al este y un arroyo), **Llanura** (casi llano, con arroyo y laguna), **Con gran relieve** (cerros y valles por todo el mapa) y **Sierras** (cordones de montañas con valles anchos para construir), todos con arboledas de jacarandás, palos borrachos, ombúes y eucaliptos.
- Tamaños: Chico (128×128), Mediano (192) y Grande (256) están definidos en `src/config.ts`, y los generadores, los guardados y la simulación ya los manejan. `PLAYABLE_SIZES` lista los habilitados y hoy es solo Chico: el mapa se dibuja en un único lienzo y, medido en Chrome sin GPU, redibujarlo entero tarda unos 0,6 s a 128, 1,4 s a 192 y 2,5 s a 256. Habilitar los otros requiere dibujar el mapa en pedazos. En celulares y Safari, que limitan un lienzo a unos 16,7 millones de píxeles, los tamaños grandes tampoco entrarían.
- Cámara isométrica con 4 rotaciones, zoom de 0,25× a 3×, minimapa y picking que respeta el relieve.
- Herramientas: consulta, topadora, calles (con puentes), tendido eléctrico, zonas R/C/I, plazas, usinas, escuelas, salitas, comisarías y cuarteles de bomberos, con costo visible antes de soltar el mouse, bloques de 1×1, 2×2 o 4×4 y deshacer (`Ctrl+Z`): devuelve todo lo pagado dentro del mes de la obra y la mitad hasta un año después.
- Simulación: red eléctrica con capacidad y apagones, acceso a calles, contaminación, valor del suelo, demanda R/C/I, crecimiento en 4 niveles por zona, una tasa por zona (cada una mueve la demanda de su zona), presupuesto por servicio (financiar al X % cuesta y cubre el X %) y presupuesto mensual. En los mapas reales, las calles que trae el mapa solo se cobran cuando hay edificios a su alcance.
- Tiempo y plata: el tiempo corre por semanas (4 por mes; una semana dura 1,5 s en velocidad Normal) y la plata se cobra y se paga cada semana. El diario, los incendios, el gráfico y el autoguardado siguen siendo mensuales. Al lado de la Caja se ve el saldo estimado del mes y, si la caja no va a durar un año, cuántos meses alcanza (ámbar con menos de 12, rojo con menos de 6). Los servicios públicos pagan una parte fija (`FIXED_SHARE`, 25 %) y el resto según cuántos vecinos atienden. `npx vite-node scripts/early-probe.ts` reproduce una primera ciudad con los cuatro servicios desde el principio.
- El Diario del Conurbano publica la fundación y recién sale a la calle, con una noticia de apertura, cuando hay al menos dos viviendas, dos comercios y dos fábricas construidas. Hasta entonces los avisos de plata están solo en la barra superior.
- Avenidas: las calles pegadas una al lado de la otra forman una franja que se dibuja como avenida (2 = doble línea amarilla, 3 o más = más carriles, veredas solo en los bordes). Es solo visual: cada celda sigue siendo una calle común, con el mismo costo, luz y acceso. La lógica está en `src/render/avenue.ts`.
- Terreno prolijo: el relieve generado (inventado o real) no tiene escalones sueltos, y al zonificar o poner un servicio la manzana se rellena hasta quedar plana (nunca más de 2 niveles por vez y sin tocar costas); las calles alrededor hacen de rampa. Deshacer devuelve el terreno. Servicios con radio y capacidad, delito según la densidad, incendios que se propagan sin bomberos y edificios que quedan abandonados cuando faltan luz, calle o seguridad.
- Edificios: casitas, chalets, casas chorizo, PH con tanque de agua, torres, kioscos y almacenes con toldo, galerías, oficinas, talleres, galpones, fábricas y plantas industriales. También hay humo animado y tránsito con taxis negros y amarillos y colectivos.
- Interfaz con fileteado, El Diario del Conurbano, panel de presupuesto con historia, capas de luz, humo, valor del suelo, delito, educación, salud y bomberos (la de cada servicio se muestra sola al elegirlo), y ficha de cada lote que explica por qué crece o no.
- Sonido generado en el navegador (sin archivos): murmullo de ciudad y tránsito que crecen con la ciudad, bocinas y pajaritos, y efectos al construir, demoler, deshacer, salir el diario o arrancar un incendio. Se silencia con el botón "Sonido" o la tecla `M`, y la elección se recuerda.
- Guardado en 3 ranuras más un autoguardado anual, y exportar o importar como archivo `.json`.

## Arquitectura

```
src/
  config.ts          números de balance (costos, mantenimiento, capacidades)
  core/              rng con semilla, matemática isométrica, formato de números
  world/             terreno procedural, grilla de la ciudad, herramientas (planificar y aplicar)
  sim/               energía, campos (calles, contaminación, valor), demanda, presupuesto,
                     calendario, diario, ficha de consulta y el bucle de simulación
  render/            sprites procedurales, cache isométrica del mapa, vista, minimapa, tránsito
  save/              serialización validada y ranuras en localStorage
  input/             mouse, rueda y touch
  ui/                estilos, íconos, paneles (presupuesto, partidas, ayuda)
  game.ts            una partida en curso: une simulación, render, entrada y HUD
  main.ts            pantalla de inicio, teclado y ciclo de vida de la partida
tests/               Vitest, solo lógica pura (sin DOM)
scripts/             sonda de balance
```

Algunas decisiones que conviene conocer:

- **La simulación es determinista.** Todo azar sale de un `Rng` cuyo estado se guarda en la partida: misma semilla y mismas acciones dan la misma ciudad.
- **El mapa se dibuja una vez** en un canvas grande por rotación. Después solo se redibujan las regiones que cambiaron (`MapRenderer.update`), en orden de pintor. Lo animado (humo, autos, avisos de corte de luz) va por encima en cada frame.
- **Las herramientas tienen dos pasos.** `planTool` calcula qué celdas cambian y cuánto cuesta sin tocar nada (la previsualización usa lo mismo), y `applyPlan` lo ejecuta.
- **El guardado se valida campo por campo** y rechaza partidas imposibles con un mensaje para el jugador.
- La carpeta `ORIGINAL/` es solo material de referencia, está fuera de git y nada de ahí entra al juego.

## Continuidad (para retomar con otro modelo o persona)

- Especificación viva y bitácora: `odd/tasks/argencity-3000.md`. El plan legible para el jugador está en `PLAN-DE-TRABAJO.txt`.
- Antes de cambiar algo: `npm test` y `npm run build` tienen que pasar.
- El balance se ajusta en `src/config.ts`, `src/sim/demand.ts` (demanda y techo de niveles) y `src/sim/budget.ts` (tasas). Después de tocarlo, correr `npm run probe`.
- Para agregar un edificio: un nivel en `CAPACITY` (`config.ts`), su dibujo en `src/render/sprites.ts` y su nombre en `src/sim/report.ts`.
- Copy de la interfaz: español rioplatense. El jugador es **"Intendente"**, nunca "Alcalde".
