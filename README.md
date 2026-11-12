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

### Primeros pasos

1. **Usina** (tecla `9`): sin luz no crece nada.
2. **Calles** (`3`): se trazan arrastrando. Los lotes necesitan una calle a 3 lotes o menos.
3. **Zonas** residencial (`5`), comercial (`6`) e industrial (`7`): todo tiene que tocar la red, porque la luz viaja por calles, zonas y tendido eléctrico (`4`).
4. Mirá la **demanda R C I** arriba y la **caja**. Con la caja en rojo no se construye.
5. Las **plazas** (`8`), el agua y los árboles suben el valor del suelo, y eso permite edificios más altos. La industria contamina.

En el juego, `H` abre la ayuda completa con todos los controles.

## Qué tiene

- Mapa procedural de 128×128 a partir de una semilla: lomas, la costa de un río ancho, un arroyo y arboledas de jacarandás, palos borrachos, ombúes y eucaliptos.
- Cámara isométrica con 4 rotaciones, zoom de 0,25× a 3×, minimapa y picking que respeta el relieve.
- Herramientas: consulta, topadora, calles (con puentes), tendido eléctrico, zonas R/C/I, plazas y usinas, con costo visible antes de soltar el mouse, bloques de 1×1, 2×2 o 4×4 y deshacer (`Ctrl+Z`): devuelve todo lo pagado dentro del mes de la obra y la mitad hasta un año después.
- Simulación: red eléctrica con capacidad y apagones, acceso a calles, contaminación, valor del suelo, demanda R/C/I, crecimiento en 4 niveles por zona, tasas ajustables y presupuesto mensual.
- Edificios: casitas, chalets, casas chorizo, PH con tanque de agua, torres, kioscos y almacenes con toldo, galerías, oficinas, talleres, galpones, fábricas y plantas industriales. También hay humo animado y tránsito con taxis negros y amarillos y colectivos.
- Interfaz con fileteado, El Diario del Conurbano, panel de presupuesto con historia, capas de luz, humo y valor del suelo, y ficha de cada lote que explica por qué crece o no.
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
