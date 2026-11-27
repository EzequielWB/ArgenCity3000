# Red eléctrica: aviso de isla corta + usina nuclear

## Specs

- S1 (pedido, verbatim): "Estaria bueno que en caso asi avise de alguna forma que no necesariamente es de la cantidad total sino que ahí falta" — con la captura de la tarjeta que decía "la ciudad pide 11.800 MW y hay 12.785 · faltan 0 MW" sobre un edificio sin luz: la red de esa celda está corta aunque a la ciudad, en total, le sobra energía.
- S2 (pedido, verbatim): "Tambien me gustaria añadir una planta nuclear como usina de mayor nivel" — una usina de 2×2 mucho más cara, sin humo, que rinde varias térmicas.
- Checks: RED observado para el aviso de isla y para la usina nuclear; suite completa verde; `npx tsc --noEmit` limpio.

## Tasks

- T1 [S1] RED en `tests/luz-causas.test.ts`: dos redes aisladas (una corta, una con sobrante); el consultar del edificio apagado tiene que dar los números DE ESA RED y el sobrante de la ciudad, y proponer tendido, no solo "otra usina".
- T2 [S1] `computePower` numera las redes (`powerNet[i]` = id de red, no 0/1) y devuelve `nets: { capacity, use }[]`; `noLightHint` usa los de la red de la celda.
- T3 [S2] Usina nuclear: `PlantKind` + `PLANTS.nuclear` (2×2, 2400 MW, sin humo), herramienta `plantNuclear` (tecla n), desbloqueo en Gran ciudad (5000), icono, pintor propio, save via `PLANT_KINDS`.
- T4 suite verde + tsc.

## Log

- L1: pedidos verbatim en S1/S2. La captura del jugador: fábrica I con "Sin luz", "pide 11.800 MW y hay 12.785 · faltan 0 MW" y "Enjo del barrio: 8 % · se vacía en ~23 meses".
- L2: la causa raíz de S1: `noLightHint` mezcla los totales de la ciudad (`sim.power.use/capacity`) con la marca por red (`powerShort`). El arreglo numera las redes para poder decir "tu red pide X y tiene Y; en el resto sobran W".
- L3: decisiones de la nuclear: 2×2 como las demás (PLANT_SIZE es única para todas), 2400 MW = 4 térmicas, $24.000 / $1.600, sin contaminación; desbloquea con Gran ciudad (5.000 vecinos), misma edad/decadencia que el resto.
- L4: suite completa: 1488 tests verdes (105 archivos), tsc limpio. Teclas: la 'n' está reservada (movimiento) y la "'" la usa el santuario; la nuclear quedó con '_'.
