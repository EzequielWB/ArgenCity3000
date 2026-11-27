# QA Headless — Balance, Economía y Bugs

## Specs
- S1: Auditoría headless de las 5 formas de gobierno (viabilidad, balance, que cada una sea una forma distinta de jugar). Medición con la matriz de `scripts/gov-probe.ts` + semillas extra.
- S2: Cadena del Campo (Lote → Silo → Feria): soja pura (risk 100) vs trigo puro (risk 0) vs mixto, contra precios estacionales ($120 cosecha / $180 invierno) y merma 4 % mensual. Pregunta: ¿la soja arruina la partida o acumula capital desbalanceado?
- S3: Gestión de deuda y subsidio provincial: los 3 créditos ($10k/$25k/$50k) bajo déficit estructural; verificar que la cuota en `monthlyBudget()` no genere bucle infinito de refinanciación. Subsidio: una sola vez por partida, sin doble cobro.
- S4: Soak 50–100 años: NaN/Infinity/drift en presupuesto, tasas, indicadores; determinismo por semilla (misma semilla → mismo resultado exacto).
- S5: Serialización y carga en medio de eventos activos (cosecha en curso, incendio, paro, préstamo): el estado restaurado debe continuar la ejecución determinista idéntica.
- S6: Adversarial: explotar red eléctrica (cobertura/peso mínimo), alivio de colectivos sin conectividad (techo BUS.share 35 %), saturación de tránsito y avenidas.
- S7: Informe final en `INFORME-QA.md` en la carpeta raíz, con hallazgos rankeados.

Checks: los scripts QA viven en la raíz (`qa-*.ts`) y corren con `npx vite-node qa-<tema>.ts`. Pruebas E2E/visión (picking isométrico, responsive móvil) quedan para una fase posterior con navegador.

## Tasks
- T1 [S1] Matriz de gobiernos ampliada: 40 corridas (5 gobs × 2 estilos × 2 mapas × 2 semillas) → `qa-gobiernos.txt`. HECHA: sólo comunismo tiene motor; los otros cuatro mueren igual.
- T2 [S2] `qa-campo.ts`: risk 0/50/100 × minPrecio 0/160 × 3 climas. HECHA: soja 1,86× trigo en esperanza; minPrecio 160 domina; campo sin ciudad imprime plata.
- T3 [S3] `qa-deuda.ts`: los 3 créditos exactos, sin bucle de refinanciación, subsidio único. HECHA.
- T4 [S4] `qa-soak.ts`: 100 años × 2 instancias: sin NaN/Infinity, sin drift, determinismo exacto. HECHA.
- T5 [S5] `qa-save.ts`: continuación idéntica tras guardar; 2 bugs: `bigFire` no se serializa (resultado del fuego cambia) y stats de fuego no viajan. HECHA.
- T6 [S6] `qa-adversarial.ts`: exploit de colectivos con calle suelta CONFIRMADO; luz sin red OK; avenidas según diseño; Ctrl+Z exacto. HECHA.
- T7 [S7] `INFORME-QA.md` con hallazgos rankeados. HECHA.
- T8 [S7] Tránsito extendido a pedido del jugador (su ciudad se atasca con avenidas cada 2 manzanas): `qa-transito.ts` + `qa-transito.txt`, sección «Tránsito» en `INFORME-QA.md` (hallazgos T1–T4). HECHA.

E2E/visión (picking en relieve, responsive móvil): pendiente, requiere navegador; queda como próxima fase.

## Log
- L1 (pedido original, verbatim): "La idea es hacer un QA del juego. Todo lo que armes dejamelo en la carpeta raiz del juego para poder leer. Por ahora vamos a pruebas Headless de Balance y Dinamica Economica, junto con busqueda de bugs. ... [gobiernos, cadena del campo, deuda/subsidio, soak 50-100 años, save/load en eventos, adversarial: red eléctrica, colectivos, deshacer, tránsito] y otras cosas que vos veas necesarias a la hora de armar un QA"
- L2: suite base 1473 tests verdes antes de tocar nada. Los artefactos van en la raíz según pedido. Nota: el clima del campo usa hash del NOMBRE de la ciudad (`settleHarvest` con `hashString(cityName)`), no la semilla de partida — dos ciudades con el mismo nombre comparten dado climático (observación, no bug).
- L3: sin Engram disponible en esta sesión (no hay herramientas mem_*): progreso local en este documento, espejo pendiente.
- L4: tránsito — la ruta del viajero es única (BFS al destino más cercano, sin redistribución por congestión) y el alivio de colectivos es proporcional global con tope 35 %: los dos hechos explican por qué avenidas cada 2 manzanas y más líneas no arreglan la captura del jugador.
