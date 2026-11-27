# Red eléctrica: aviso de isla corta + usina nuclear

## Specs

- S1 (pedido, verbatim): "Estaria bueno que en caso asi avise de alguna forma que no necesariamente es de la cantidad total sino que ahí falta" — con la captura de la tarjeta que decía "la ciudad pide 11.800 MW y hay 12.785 · faltan 0 MW" sobre un edificio sin luz: la red de esa celda está corta aunque a la ciudad, en total, le sobra energía.
- S2 (pedido, verbatim): "Tambien me gustaria añadir una planta nuclear como usina de mayor nivel" — una usina mucho más cara, sin humo, que rinde varias térmicas. Reescrito con la foto de referencia: "Me gustaria que fuera algo asi, con las tipicas torres y eso, además tiene que pedir al menos 15 mil habitantes, ser de 3x3 y generar MUCHA energia a cambio de un gran costo de $$".
- S5: la nuclear es 3×3 (los otros tipos siguen en 2×2) y se desbloquea en Metrópolis (25.000 vecinos, el primer hito de 15 mil hacia arriba).
- Checks: RED observado para el aviso de isla, la usina nuclear y el paso a 3×3; suite completa verde; `npx tsc --noEmit` limpio.

## Tasks

- T1 [S1] RED en `tests/luz-causas.test.ts`: dos redes aisladas (una corta, una con sobrante); el consultar del edificio apagado tiene que dar los números DE ESA RED y el sobrante de la ciudad, y proponer tendido, no solo "otra usina".
- T2 [S1] `computePower` numera las redes (`powerNet[i]` = id de red, no 0/1) y devuelve `nets: { capacity, use }[]`; `noLightHint` usa los de la red de la celda.
- T3 [S2] Usina nuclear: `PlantKind` + `PLANTS.nuclear` (2×2, 2400 MW, sin humo), herramienta `plantNuclear` (tecla n), desbloqueo en Gran ciudad (5000), icono, pintor propio, save via `PLANT_KINDS`.
- T4 suite verde + tsc.
- T5 [S5] tamaño por tipo: `PLANT_SIZES` + `plantSizeOf` (nuclear 3, resto 2); plantFootprint/plantAt/bulldoze/plantHeight/save/mapRenderer dejan de usar la constante única.
- T6 [S5] nuclear 3×3: 6.000 MW, $48.000, $3.800 de mantenimiento; hito Metrópolis; pintor con torres hiperboloides (cintura y campana) y sala de turbinas al frente.

## Log

- L1: pedidos verbatim en S1/S2. La captura del jugador: fábrica I con "Sin luz", "pide 11.800 MW y hay 12.785 · faltan 0 MW" y "Enjo del barrio: 8 % · se vacía en ~23 meses".
- L2: la causa raíz de S1: `noLightHint` mezcla los totales de la ciudad (`sim.power.use/capacity`) con la marca por red (`powerShort`). El arreglo numera las redes para poder decir "tu red pide X y tiene Y; en el resto sobran W".
- L3: decisiones de la nuclear: 2×2 como las demás (PLANT_SIZE es única para todas), 2400 MW = 4 térmicas, $24.000 / $1.600, sin contaminación; desbloquea con Gran ciudad (5.000 vecinos), misma edad/decadencia que el resto.
- L4: suite completa: 1488 tests verdes (105 archivos), tsc limpio. Teclas: la 'n' está reservada (movimiento) y la "'" la usa el santuario; la nuclear quedó con '_'.
- L5: pedido S2 reescrito con la foto: torres hiperboloides, 3×3, 15 mil+ (va a Metrópolis, 25.000, el primer hito ≥ 15 mil), 6.000 MW = 10 térmicas por $48.000. PLANT_SIZE era una constante única usada en 7 archivos: se reemplaza por PLANT_SIZES por tipo.
- L6: el pintor de torres: probé fajas de boxes (escalonadas) y discos apilados con blob (anillos); la versión que quedó es silueta continua fila a fila (rect por fila con flanco al sol y en sombra) + boca con canto claro y hueco oscuro, como el montículo de carbón. Dos torres de base 1.9 y 36 de alto, solapadas como en el predio real.
