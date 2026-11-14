# Hitos grandes: 50k, 100k y 200k

La escalera de hitos hoy termina en "Metrópolis", 25.000 habitantes. Se agregan tres peldaños
arriba: 50.000, 100.000 y 200.000.

## Specs

- **S1 Pedido (verbatim).** "Ahora quiero agregar nuevos hitos, actualmente quedamos en 25k
  habitantes como maximo no? me gustaria hacer 50k, 100k, 200k".
- **S2 Tres peldaños, en orden.** `MILESTONES` suma 50.000 "Gran metrópolis", 100.000 "Megaciudad"
  y 200.000 "Área metropolitana", con subsidio de la Provincia de 50.000, 80.000 y 120.000 pesos
  (cada peldaño paga más que el anterior). Ninguno desbloquea herramientas, porque las 22 ya tienen
  su hito: son meta, plata y categoría, igual que "Metrópolis" hoy.
- **S3 La etiqueta de la ciudad acompaña.** `settlementType` (`src/core/format.ts`) hoy se queda en
  "metrópolis" para siempre: pasa a "metrópolis" hasta 50.000, "gran metrópolis" hasta 100.000,
  "megaciudad" hasta 200.000 y "área metropolitana" de ahí en más.
- **S4 El diario lo canta bien.** `news.ts` ya publica "ya supera los N habitantes" para 50.000 y
  100.000; se agrega 200.000. Y el artículo tiene que concordar: "una gran metrópolis", "una
  megaciudad", pero "un área metropolitana" (el sustantivo empieza con a tónica).
- **S5 Nada de lo que ya andaba se mueve.** Agregar al final no corre ningún índice: las
  herramientas siguen colgando del mismo hito y las partidas viejas siguen abriendo con su hito.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Los tres hitos nuevos | S2 | `src/sim/milestones.ts` | hecho | 200.000 es el último peldaño; subsidios siempre crecientes; una partida con hito 9 abre |
| T2 Categorías de la ciudad | S3 | `src/core/format.ts` | hecho | etiqueta por tramo, probada en los bordes (49.999 / 50.000 / 199.999 / 200.000) |
| T3 Diario: artículo y 200.000 | S4 | `src/sim/news.ts`, `tests/hitos-grandes.test.ts` | hecho | "una gran metrópolis" / "una megaciudad" / "un área metropolitana" / "supera los 200.000" |
| T4 Los índices y el guardado no se movieron | S5 | `tests/hitos-grandes.test.ts` | hecho | `milestoneOfTool` igual que antes para cinco herramientas; un hito viejo conserva lo suyo |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`.

## Log

- **L1 (2026-11-13), verificado antes de prometer.** Los peldaños son alcanzables: un lote
  residencial de nivel 4 aloja 160 vecinos (`CAPACITY`), así que 200.000 habitantes son 1.250 lotes,
  menos del 2 % de un mapa grande (256 × 256 = 65.536 celdas). Ninguna regla del motor topa la
  población.
- **L2, el tránsito no es un tope.** `computeCongestion` solo alimenta la aprobación (factor
  "Tránsito", hasta -15) y una noticia; no frena el crecimiento por sí mismo. Con el cambio de
  aprobación de la feature anterior, embotellarse cuesta crecimiento **vía** aprobación, que es lo
  que se buscaba. Consecuencia honesta: llegar a 200.000 exige calles que respiren, y eso no está
  medido con un jugador real — el probe actual, con su grilla torpe, se estanca en 14.000.
- **L3, por qué no hay herramientas nuevas.** Las 22 herramientas del juego ya tienen su hito
  asignado; el techo hoy es "Metrópolis" sin desbloqueos, así que los peldaños nuevos siguen el
  mismo molde.
- **L4, el detalle del artículo.** `article()` tenía la lista de femeninos escrita a mano
  (`metrópolis`, `ciudad`, `gran ciudad`): con los nombres nuevos decía "un gran metrópolis" y "un
  megaciudad". Se pasó a un conjunto, y "área metropolitana" queda con "un", que es lo correcto en
  castellano.
- **L5, verificación.** 569 tests verdes (8 nuevos), `tsc` limpio y build. La placa de bronce se
  miró pintada con los tres nombres en el navegador: "ÁREA METROPOLITANA" entra en los 430 px del
  cartón sin desbordar (`scrollWidth` = `clientWidth`).
