# Balance, servicios de segundo nivel y Tandil

Objective: fix the balance findings of the audit, add second-level services, ship Tandil, drop the fire bubble. Branch: feat/vertical-slice. Runner: `npx vitest run`.

## Specs

- S1. "Dale acomodá 1,2 y 3": (1) the migration of Dictadura/Comunismo is a cliff, not "20 % menos de gente"; (2) the favor of God cannot reach the miracles; (3) the tax cliff above 9 %.
- S2. "tocá un poco el 5 para que no sea tan asi": the electricity takes almost half of the taxes.
- S3. "agregá servicios de segundo nivel"
- S4. "subí Tandil para que no esté en local"
- S5. "Eliminá el globo de cuando faltan bomberos, normalmente el jugador se deberia dar cuenta solo o cuando ve que se quema algo (especie de dificultad)"

## Tasks

- T1 (S5) remove the fire bubble: inline
- T2 (S4) commit Tandil: inline
- T3 (S1) migration as a slope, favor band, soft tax curve: inline
- T4 (S2) lighter power upkeep: inline
- T5 (S3) hospital and university: inline

## Log

- L1 (2026-11-15) "Dale acomodá 1,2 y 3, y tocá un poco el 5 para que no sea tan asi, agregá servicios de segundo nivel, subí Tandil para que no esté en local (no se que hace ahi). Eliminá el globo de cuando faltan bomberos, normalmente el jugador se deberia dar cuenta solo o cuando ve que se quema algo (especie de dificultad)"
- 2026-11-15 T1-T5 done: 1c364ab (fire bubble out), 9a4d602 (Tandil), 3d8746a/3355744 (balance), second-level services in this commit. Full suite green; checked the sprites, the tool menu and the budget on screen. Loading the dev city found that older saves failed on the new budget lines: fixed and pinned by a test.
