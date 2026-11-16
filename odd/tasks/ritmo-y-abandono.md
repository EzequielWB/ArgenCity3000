# Ritmo y abandono

Objetivo: un retoque chico de la economía, que el abandono tarde más en aparecer y que la velocidad
rápida sea un poco más lenta. Runner: `npx vitest run`.

## Specs

### S1 — Un retoque sutil de los números

> "Hacé un retoque sutil de los numeros."

- `UPKEEP.servicesScale` sube lo justo para que el techo solvente de la ciudad pase de ~23.000 a
  ~36.000 habitantes, sin reescribir la economía. No busca hacer 150k viable todavía: eso pide el
  valor que quedó medido en `balance-de-gobiernos.md` (L6).

### S2 — El abandono tarda más en aparecer

> "hace que el abandono tarde mas en aparecer, actualmente a la minima que pasa algo malo abandona mucha gente muy rapido"

- Un corte de luz sigue vaciando la ciudad, pero en meses, no en semanas: es comportamiento probado
  (`tests/abandon.test.ts`) y no se rompe.
- A los dos meses de un apagón la mayoría de los edificios siguen en pie.
- Los edificios abandonados se vuelven a ocupar más rápido de lo que se abandonan.

### S3 — La velocidad rápida, un poco más lenta

> "tambien que el modo mas rapido sea un poquito mas lento"

- Un 17 % menos de ticks por segundo en la velocidad rápida. Lento y Normal no se tocan.

## Tasks

- **T1** (S1) `servicesScale` 9000 → 14000. `src/config.ts`. Commit: pendiente.
- **T2** (S2) bajar las tasas de `abandonRisk`. `src/sim/simulation.ts`. Commit: pendiente.
- **T3** (S3) `SPEEDS` rápida 30 → 25. `src/game.ts`. Commit: pendiente.
- **T4** (S2) test del ritmo del abandono. `tests/abandon.test.ts`. Commit: pendiente.

## Log

**L1 — pedido original:**

> "Hacé un retoque sutil de los numeros. Lo que si, hace que el abandono tarde mas en aparecer,
> actualmente a la minima que pasa algo malo abandona mucha gente muy rapido. Y tambien que el modo
> mas rapido sea un poquito mas lento"

**L2 — por qué no "dos problemas a la vez".** La primera idea fue exigir dos problemas simultáneos
para abandonar, así un apagón solo no vacía nada. Se descartó: el apagón que vacía la ciudad es
comportamiento documentado y probado, y cambiarlo convierte el corte de luz en un aviso sin
consecuencia. Bajar las tasas deja el mismo comportamiento con otro ritmo.

**L3 — medido después del cambio.**

- Ciudad de 163.200 (instrumento `ceiling-probe`, nivel 5): gastos 233.563 contra 279.962 antes, saldo
  −135.017 contra −186.167, abandonados en el primer mes 26 contra 81.
- Techo solvente: de ~23.000 a ~49.000 habitantes. 150k sigue fuera de alcance: para eso
  `servicesScale` tendría que valer ~58.000 (ver `balance-de-gobiernos.md`, L6).
- Los cinco gobiernos, 40 años: comunismo 13.346 (8 mandatos, +1,9 M), los otros cuatro siguen
  cayendo a ~1.200–1.900 con ~−900.000. El abandono más lento no los salva porque no mueren de
  abandono: mueren del acantilado del apetito (L8 del otro documento) — con 16 % de aprobación el
  apetito queda por debajo de 1 y los edificios BAJAN de nivel por demanda negativa, no se abandonan.
- Velocidad rápida: 30 → 25 ticks por segundo; una semana pasa de 0,5 s a 0,6 s. Lento y Normal
  siguen en 4 y 10.
