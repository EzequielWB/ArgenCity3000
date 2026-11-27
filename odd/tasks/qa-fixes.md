# QA fixes — A1/A2 (incendios y guardado) y A3 (colectivos)

## Specs
- S1 [A1]: `bigFire` sobrevive al guardado: un foco grande restaurado sigue siendo foco grande; con cobertura de bomberos la partida restaurada debe quemar el edificio igual que la original (continuación determinista idéntica).
- S2 [A2]: `stats = { firesStarted, firesSaved, buildingsBurned }` viaja en el save; un save viejo (sin el campo) abre con stats en 0 sin romper.
- S3 [A3]: una cochera de colectivos necesita una calle **conectada a la red**: una celda de asfalto suelta pegada a la cochera no activa el alivio. Las cocheras legítimas (calle en una red de verdad) siguen dando alivio completo.
- Checks: RED observado → GREEN → REFACTOR; `npx vitest run` completo verde al cerrar.

## Tasks
- T1 [S1,S2] tests RED en `tests/save.test.ts` (foco grande + stats round-trip) → serializar `bigFire` y `stats` en `src/save/save.ts` (versión 22, lectura tolerante de ≤21). HECHA: RED observado (2 fallos) → GREEN; pines de versión actualizados en government/roadtier/tendido.
- T2 [S3] test RED en `tests/colectivos-global.test.ts` (calle suelta no da alivio) → `servedStreet()` en `src/world/transport.ts`, usada por `src/sim/transit.ts` y la ficha en `src/sim/report.ts`. HECHA: RED observado → GREEN; 2 tests viejos llevados al mundo con vecinos (la regla necesita a quién servir).
- T3 suite completa verde + re-correr `qa-save.ts` y `qa-adversarial.ts` para evidencia. HECHA: 1478 tests verdes, tsc limpio.

## Log
- L1 (pedido, verbatim): "Dale, queres arreglar A1, A2 y A3?" — aceptación del usuario sobre el informe QA.
- L2: versión de save 21 → 22; los saves ≤21 se leen igual (bigFire vacío: mismo comportamiento de hoy, se documenta).
- L3: la regla de A3 es «la red de la cochera toca un lote ocupado (edificio construido)»; un lote zonificado sin edificio no alcanza. `roadAccess` no se usa como señal porque no está calculado en mundos sin simulación (tests).
- L4: mientras cazaba una divergencia fantasma en `legacy.sim.fireStats`, el bug era del test: `delete old.fireStats` borraba una clave que no existe (vive en `old.sim.fireStats`). El código de save estaba bien.
