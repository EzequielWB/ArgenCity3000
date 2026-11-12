# ArgentinaCity 3000 — reconstrucción desde cero

Objetivo: city-builder isométrico original, jugable de punta a punta en el navegador, con identidad argentina.
Rama: `feat/vertical-slice` · Estado: **v1 jugable** · Entrega: `ask-on-risk` · Runner: `vitest` (`npm test`) · Build: `vite build`
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
- **S9 — Deshacer (verbatim):** "Exacto, el deshacer". Ctrl+Z deshace la última construcción o demolición y devuelve lo pagado.
- **S10 — Bug de autos (verbatim):** "los autos que pasan medio que desaparecen y se bugean, además que se ven por encima de las casas en caso de tener que pasar por detras de estas". Los autos se mueven de forma continua por las calles y quedan tapados por lo que esté delante.
- **S11 — Dificultad (verbatim):** "es muy facil, ,me gusta tus ideas y estaria bueno una investigación sobre como los juegos de gestionar ciudades afrontan esos problemas". Primero se investiga; el cambio de diseño sale de la investigación.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Base (RNG, iso, terreno) | S2, S3, S8 | inline | hecho | `14d2f84`; RED observado (módulos inexistentes) |
| T2 Edición (mundo, herramientas, costos) | S7 | inline | hecho | `14d2f84`; RED observado |
| T3 Simulación | S5, S6, S7 | inline | hecho | `8681e5b`; RED observado |
| T4 Render (sprites, cache, picking) + guardado | S2, S3, S7 | inline | hecho | `4a77c89`; RED de `save` observado; picking escrito junto con el test (sin RED previo) |
| T5 Interfaz | S4, S6, S7 | inline | hecho | `33cb6f6`; prueba en Chrome headless (puppeteer-core en scratch) |
| T6 Balance y pulido | S1 | inline | hecho | `848dba4`; sonda de 15 años + partida en Chrome |
| T7 Deshacer | S9 | inline | hecho | RED observado (`world/history` inexistente, después reembolso parcial); Chrome: demoler un bloque y Ctrl+Z restauran la población exacta (1318 → 1188 → 1318) |
| T8 Tránsito continuo con oclusión | S10 | inline | hecho | RED observado (`Traffic` inexistente); 147 autos en Chrome sin errores; tapados por los sprites de adelante |
| T9 Investigación de dificultad | S11 | delegado (investigación web, solo lectura) | hecho | informe con fuentes; resumen en L5 |

Ruta: inline en todas, porque no hay motivo de writer. Son unidades dependientes que comparten `main.ts`, sin paralelismo real.

## Log

- **L1 (2026-11-11), pedido original (verbatim):** "Bien, la carpeta de ORIGINAL solo se usa para tomar referencias, no se usan las cosas de ahi. La idea es construir eso planteado, actualmente no hay nada asi que tenes la libertad de crearlo desde 0, la cosa es salir de acá con un juego perfectamente jugable en navegador" · "Quiero que lo armes vos, arrancá desde 0 y preguntame cualquier duda que tengas, si queres armá un .txt de lo que tenes planeado"
- **L2:** se eligió proyecto nuevo en `E:\PROYECTO_CLAUDE_ARGENCITY`, sin reutilizar `E:\proyecto_argenCity`. El plan quedó en `PLAN-DE-TRABAJO.txt`.
- **L3 (2026-11-11), entrega v1:** juego jugable de punta a punta. Evidencia:
  - `npm test`: 71 tests en 9 archivos, todos verdes. `npm run build` OK (JS de 82 kB, 31 kB con gzip).
  - Partida en Chrome headless: se fundó la ciudad, se construyeron usina, calles, zonas, plaza y tendido, y un año a velocidad rápida terminó con unos 1.000 habitantes, titulares en el diario, ficha de consulta, rotación, capas, presupuesto y guardar → volver al inicio → cargar. Sin errores de consola.
  - Rendimiento medido: redibujado completo de 104 ms (solo al rotar), frame de 0,05 ms y tick de 0,2 ms.
  - Balance (`npm run probe`, 15 años con un jugador automático): el primer año es ajustado (+$87/mes) y aparecen torres desde el año 2. Se agregó el gasto "Servicios municipales", que crece más que lineal con la población, porque sin él la caja explotaba (unos $2,5 M en 15 años).
- **Decisiones por defecto tomadas** (listadas en `PLAN-DE-TRABAJO.txt`, a confirmar por el usuario): edificios de 1 celda, la usina de 2×2, el bloque 2×2/4×4 como opción de pintado, puentes automáticos sobre el agua, caja inicial de $30.000 y sin game over.
- **Pendiente para v2:** agua potable, tránsito simulado (el actual es solo visual), servicios (policía, bomberos, escuelas), desastres, audio y mapa real de OpenStreetMap.
- **L4 (2026-11-12), pedido del usuario (verbatim):** "Exacto, el deshacer y es muy facil, ,me gusta tus ideas y estaria bueno una investigación sobre como los juegos de gestionar ciudades afrontan esos problemas. Otra cosa, los autos que pasan medio que desaparecen y se bugean, además que se ven por encima de las casas en caso de tener que pasar por detras de estas"
  - Diagnóstico de S10: cada auto se dibujaba por celda con su propia fase, sin continuidad entre celdas, y por encima de toda la cache. El parche de ocultarlos detrás de edificios de nivel 3 o más los hacía desaparecer. Solución: autos como agentes sobre la red de calles, intercalados en el orden de pintor con los sprites que tienen delante.
- **L5 (2026-11-12), investigación de dificultad (resumen):** CS1 recibió críticas de prensa por "dinero demasiado fácil" (Expert Reviews, bit-tech, TechSpot). CS2 Economy 2.0 quitó los subsidios y subió el mantenimiento por lo mismo (diario de desarrollo de Paradox). SC4 genera presión con servicios de radio limitado y presupuesto por edificio, topes de demanda y abandono por crimen, viaje y valor del suelo, pero se lo critica por opaco. Ranking recomendado: 1) crecimiento condicionado y topes de demanda; 2) abandono en lugar de congelar; 3) servicios con radio y capacidad; 4) presupuesto por servicio e impuestos por zona; 5) préstamos con interés. Para deshacer, el patrón del género es reembolso completo solo en una ventana corta: se aplicó 100 % dentro del mes y 50 % hasta un año.
