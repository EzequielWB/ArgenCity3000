# Aprobación → crecimiento

La aprobación de los vecinos deja de ser solo la puerta de las elecciones: también decide cuánta
gente quiere venir. Así el número del HUD paga algo (o cobra) todos los meses, y el tope de la
dictadura deja de ser un adorno.

## Specs

- **S1 Convicción del jugador (pedido, verbatim).** "yo creo que la idea está buena, a mayor
  aprobación mejor todo o no? me parece razonable y es un incentivo para estar por encima de 50% y
  no quedarte rondando ese nivel para maximizar". Hoy la aprobación solo decide si sobrevivís con
  50: nada paga estar en 80, así que la estrategia óptima es clavar 55 y no pagar servicios.
  El cambio tiene que romper esa estrategia.
- **S2 Banda acotada, neutra en 50.** El apetito de crecimiento pasa a ser
  `GROWTH_APPETITE × gov.migration × (0.75 + 0.5 × aprobación / 100)`, con la aprobación recortada
  a 0..100.
  - **En 50 el factor es 1,00**, así que en la línea de las elecciones el balance de hoy no cambia.
  - 0 % → ×0,75; 100 % → ×1,25; monótono en el medio.
  - La ciudad trabada (`stall`: apagones, tasas altas, abandono) queda exactamente en 1, como hoy:
    el freno duro manda sobre el humor.
- **S3 El techo del gobierno muerde de verdad.** Una forma de gobierno con `approvalCap` 60 no
  puede pasar de ×1,05: la dictadura pierde contra una democracia que llega a ×1,25. Es la contra
  que la tarjeta ya promete ("La aprobación no pasa de 60").
- **S4 La ventana de aprobación lo explica (pedido, verbatim).** "al apretar en aprobación, en el
  menu contextual que aparece explique esto nuevo (Sin numeros ni nada, sino algo sencillo como que
  a mayor aprobación se mejora x cosa)". Texto llano, sin porcentajes ni fórmulas.
- **S5 Nada que ya funcionaba se rompe.** Los tests de `government.test.ts` (0,8 y 0,95 de la
  migración), el de abandono (`appetite === 1` trabado) y el probe de balance siguen midiendo lo
  mismo, con los números nuevos.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Constante y función pura del factor | S2 | `src/sim/politics.ts`, `tests/approval-growth.test.ts` | hecho | neutro 1,00 en 50, ×0,75 en 0, ×1,25 en 100, recorte fuera de rango |
| T2 El apetito usa el factor | S2, S3 | `src/sim/simulation.ts` | hecho | 90 % crece 33 % más que 30 %; trabado sigue en 1; dictadura tope 60 → ×0,84 justo |
| T3 La ventana lo cuenta en palabras | S4 | `src/ui/panels.ts` | hecho | texto sin números en el modal de aprobación |
| T4 Probe y cierre | S5 | `scripts/balance-probe.ts` (medición), este documento | hecho | corrida antes/después sobre la semilla 7 |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`, `npm run probe`.

## Log

- **L1 (2026-11-13), origen.** El padre planteó que el tope de aprobación de la dictadura no hace
  nada (verificado: `s.approval` solo se lee en el HUD, en la encuesta y en la puerta de las
  elecciones), y propuso multiplicar el apetito por la aprobación. El jugador corrigió el rumbo:
  "a mayor aprobación mejor todo... es un incentivo para estar por encima de 50%".
- **L2, la objeción del padre y por qué se cayó.** El padre objetó "estarías contando dos veces la
  calidad". Se verificó en `demand.ts:51`: la demanda sale de trabajos, población, tasas y apetito;
  salud, educación, delito, humo y valor del suelo **no** la tocan (solo entran en `computeApproval`).
  La aprobación es el primer puente entre calidad y cantidad de gente, no un duplicado.
- **L3, por qué el lazo no explota.** `computeApproval` ya tiene realimentación negativa atada al
  tamaño: falta de trabajo (-20), apagones (-30 sobre los oscuros), tránsito (-15), abandonados
  (-12). Agrandarse sube esos castigos solos.
- **L4, la elección de la banda.** Se eligió que en 50 el factor sea exactamente 1,00 para no
  rebalancear el juego desde cero: arriba y abajo del punto de elección todo es delta. `APPROVAL.start`
  es 55, así que una partida nueva arranca en ×1,025, apenas por encima del neutro.
- **L5, verificación y números del probe** (semilla 7, 15 años, mismo jugador automático):
  | Escenario | Pop. año 15 | Elecciones |
  |---|---|---|
  | Antes del cambio (factor 1,00) | 8.508 | perdió en el año 4 |
  | Después, el mismo jugador (aprobación 32 %) | 5.494 | perdió en el año 4 |
  | Aprobación forzada a 75 % | 13.992 | ganó 3 mandatos |
  | Aprobación forzada a 90 % | 14.066 | ganó 3 mandatos |
  - **No hay bola de nieve**: el 75 % y el 90 % empatan. La ciudad se estanca por tránsito (255 %,
    90 % atascados), o sea el techo pasa a ser la infraestructura, no el humor. El factor corre el
    punto de equilibrio, no lo rompe.
  - El jugador mediocre del probe (aprobación 32 %) pierde 35 % de población contra la línea base:
    es el castigo que el pedido busca, y queda anotado por si se considera excesivo.
  - 561 tests verdes (6 nuevos en `tests/approval-growth.test.ts`), `tsc` limpio, build en 1 s y el
    modal mirado en el navegador con Chromium headless: el texto nuevo aparece sin números y sin
    errores de consola.
