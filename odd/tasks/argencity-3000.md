# ArgentinaCity 3000 — reconstrucción desde cero

Objetivo: city-builder isométrico original, jugable de punta a punta en el navegador, con identidad argentina.
Rama: `feat/vertical-slice` · Entrega: `ask-on-risk` · Runner: `vitest` (`npm test`) · Build: `vite build`
Plan legible para el usuario: `PLAN-DE-TRABAJO.txt`. Spec anterior (referencia de decisiones del usuario): `argentina-city-3000.md`.

## Specs

- **S1 — Pedido (verbatim):** "Quiero que lo armes vos, arrancá desde 0 y preguntame cualquier duda que tengas" · "la cosa es salir de acá con un juego perfectamente jugable en navegador".
- **S2 — Visión (verbatim, `PLAN.md`):** "SimCity 2000 estilo argentino para navegador. Mantener esencia isométrica SC2000. Paleta cálida, fileteado porteño sutil, mezcla porteño+conurbano." Se interpreta como convención del género (S3).
- **S3 — Originalidad (verbatim):** "la carpeta de ORIGINAL solo se usa para tomar referencias, no se usan las cosas de ahi". Ningún asset, paleta, formato ni look del original entra al juego; el arte se genera por código.
- **S4 — Copy:** español rioplatense; el jugador es **"Intendente"** (nunca "Alcalde"). Notificaciones: **"El Diario del Conurbano"**.
- **S5 — Caja inicial (verbatim, decisión previa):** "dame dinero inicial siempre".
- **S6 — Tiempo (verbatim, decisión previa):** "además no hay referencia de tiempo como para saber si pasa o no, estaria bueno eso". La fecha se ve en pantalla.
- **S7 — Alcance v1:** el detallado en `PLAN-DE-TRABAJO.txt` (terreno, cámara, herramientas, simulación, interfaz, guardado). Supuestos marcados allí como "decisiones por defecto".
- **S8 — Stack:** TypeScript + Vite + Canvas 2D + Vitest.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Base (RNG, iso, terreno) | S2, S3, S8 | inline | pendiente | — |
| T2 Render (arte, cache, cámara, picking) | S2, S3 | inline | pendiente | — |
| T3 Edición (herramientas, costos) | S7 | inline | pendiente | — |
| T4 Simulación | S5, S6, S7 | inline | pendiente | — |
| T5 Interfaz | S4, S6, S7 | inline | pendiente | — |
| T6 Guardado | S7 | inline | pendiente | — |
| T7 Balance y pulido | S1 | inline | pendiente | — |

Ruta: inline en todas, porque no hay motivo de writer. Son unidades dependientes que comparten `main.ts`, sin paralelismo real.

## Log

- **L1 (2026-11-11), pedido original (verbatim):** "Bien, la carpeta de ORIGINAL solo se usa para tomar referencias, no se usan las cosas de ahi. La idea es construir eso planteado, actualmente no hay nada asi que tenes la libertad de crearlo desde 0, la cosa es salir de acá con un juego perfectamente jugable en navegador" · "Quiero que lo armes vos, arrancá desde 0 y preguntame cualquier duda que tengas, si queres armá un .txt de lo que tenes planeado"
- **L2:** se eligió proyecto nuevo en `E:\PROYECTO_CLAUDE_ARGENCITY`, sin reutilizar `E:\proyecto_argenCity`. El plan quedó en `PLAN-DE-TRABAJO.txt`.
