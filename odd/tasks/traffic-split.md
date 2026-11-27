# Reparto de rutas de tránsito (T1 del informe de tránsito)

## Specs

- S1 (pedido, verbatim): "Aplicá el primero y dame un ejemplo visual de dos lineas, como era antes y despues y como el crecimiento hace que antes se congestionara y ahora no" — el "primero" es el reparto de destinos de la propuesta anterior: "cada manzana divide sus viajeros entre sus 2–3 comercios más cercanos".
- S2: un lote con dos o más calles empatadas como salida reparte sus viajeros entre todas (empate = misma distancia mínima a calle). Un lote con una sola salida sigue mandando todo ahí.
- S3: los destinos de cada tipo (comercio, industria) se parten en `TRAFFIC.split` (3) grupos por índice round-robin; cada grupo manda su parte según peso inverso a la distancia del grupo. Con un solo destino del tipo, el resultado es idéntico al de hoy.
- S4: determinista (sin azar); `w.jam` de un lote con varias salidas toma la peor de sus calles.
- Checks: RED observado para S2 y S3; suite completa verde; `npx tsc --noEmit` limpio.

## Tasks

- T1 [S1] capturar números ANTES (corredor + paralela, 8/12/16 torres) con un probe desechable. HECHA (valores en Log L2).
- T2 [S2,S3] tests RED en `tests/congestion.test.ts`: la paralela lleva carga y el destino más lejano recibe viajeros. commit:
- T3 [S2,S3,S4] implementar en `src/sim/congestion.ts` + `TRAFFIC.split` en `src/config.ts`. commit:
- T4 suite completa verde + re-corrida de `qa-transito.ts` + visual HTML antes/después con números del motor.

## Log

- L1: pedido verbatim en S1. Elección de diseño: el reparto de destinos por grupos no alivia la calle de salida del lote (el origen queda clavado a una calle por el empate del BFS de `nearestStreet`), así que S2 (empate de salidas) es parte necesaria del "reparto": sin eso, la avenida paralela seguiría en 0 %.
- L2: números ANTES (corredor y=10 con paralela y=12, comercios al este): 8 torres: pasillo 67/80/93/107/107/107 %, paralela 0/0/0/0/0/0 %.
