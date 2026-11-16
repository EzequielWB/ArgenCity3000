# Balance de las formas de gobierno

Objetivo: un instrumento reproducible que diga si cada forma de gobierno permite jugar y llegar a
una buena ciudad —150.000 habitantes sin perder el poder— y ordenar las cinco por dificultad.
Runner: `npx vite-node scripts/gov-probe.ts [años] [--only=<gobierno>] [--seed=<n>] [--diag]`.

## Specs

### S1 — El instrumento mide alcanzabilidad, no un bot cualquiera

> "necesito test para saber mas o menos si está balanceado"

- El jugador automático tiene que jugar como jugaría alguien que entiende las reglas: si el bot no
  llega, el resultado no dice nada sobre el juego. Un resultado nulo de un instrumento malo no es
  una medición.

### S2 — El criterio es 150k y no perder

> "si los tipos de gobiernos existentes son posibles de jugarlos y alcanzar una buena ciudad (150k habitantes sin perder)"

- Buena ciudad = 150.000 habitantes (`TARGET_POP`).
- Sin perder = no perder la elección ni el Congreso del Partido.

### S3 — Cada gobierno se juega distinto

> "cada uno tiene su forma de jugarse aunque el core es el mismo"

- El bot no cambia de estrategia por gobierno más allá de lo que las reglas obligan: impuestos
  según el balance, servicios al 100 %, aprobación lo más alta posible.

### S4 — Primero las reglas, después el plan

> "verifiques como funciona el juego y en base a eso te armes un plan razonable para ir creciendo"

- El plan de crecimiento sale de las reglas leídas, no de la intuición. Las reglas que mandan están
  citadas en el Log (L3).

## Tasks

- **T1** — Instrumento de techo: ciudad terminada, sin jugar, para saber si el juego sostiene 150k.
  `scripts/ceiling-probe.ts`. Commit: pendiente.
- **T2** — Jugador con plan: reemplazar la heurística de filas por un plan de bloques + comprador
  greedy. `scripts/gov-probe.ts`. Commit: pendiente.
- **T3** — Correr los cinco gobiernos a 50 años, 3 seeds. Commit: pendiente.
- **T4** — Decidir si el resultado merece un test permanente en `npm test` (hoy la suite son 80 s).
  Con L6 el test que importa no es de gobiernos: es que la ciudad siga siendo solvente a la
  población de los hitos. Queda abierto.

## Log

**L1 — pedido original:**

> "necesito test para saber mas o menos si está balanceado, la idea es la siguiente: Necesito que
> veas, de la forma mas eficiente que encuentres, si los tipos de gobiernos existentes son posibles
> de jugarlos y alcanzar una buena ciudad (150k habitantes sin perder), claramente cada tipo de
> gobierno es distinto, algunos pueden ser mas faciles, otros mas dificiles y asi."

**L2 — corrección de rumbo.** Afirmé que "el techo no es el juego, es el bot" apoyándome sólo en que
sobra terreno. No estaba probado. Después construí dos ciudades que se caían y dije "mi ciudad es
mala", que es la excusa clásica de un instrumento roto. La posición correcta: probar los defectos
del instrumento regla por regla y no usar su resultado nulo como medición.

**L3 — evidencia del fracaso de los dos instrumentos previos:**

- El jugador por filas (`gov-probe` original) se clava en 6.357 a 19.031 según el gobierno y el seed,
  con `tránsito 172 %` y `freno blight`.
- La ciudad terminada (`ceiling-probe`) cae de 163.200 a 31.009 en 24 meses bajo los cinco
  gobiernos, con `valor del suelo 0/0` en todos los lotes.
- Causa común medida: congestión alta → `landValue` cae (`fields.ts:336`) → `levelCap` baja
  (`demand.ts:95`) → los edificios se achican → la población se desploma.
- Defectos del instrumento: calles de una celda de ancho cuando el juego cuenta carriles como celdas
  paralelas (`congestion.ts:180`); cero plazas (`landValue` base 25 y hasta +30 por plazas); 42
  usinas a gas entre las casas (polución ×0,7 sobre el valor del suelo).

**L4 — reglas que mandan el plan (leídas del código):**

- Crecimiento por tick: `GROWTH_RATE 0,01 × demanda / (1 + nivel×0,5) × jamGrowthFactor ×
  migración` (`simulation.ts:713`). `jamGrowthFactor` sólo castiga desde `slowFrom 90`.
- Equilibrio: `targetPop = (empleosC + empleosI) × 2 × apetito`; `apetito = 1,1 × (0,75 + 0,5 ×
  aprobación/100)`. Con aprobación ≤ 32 el apetito baja de 1 y la ciudad deja de crecer
  (`demand.ts`, `politics.ts:157`). Los impuestos lo apagan entre 10 % y 16 %.
- Aprobación (`politics.ts:100`): base 50; servicios por encima del 35 % suman +8 y +6, impuestos
  por debajo de 7 suman hasta +10, barrios lindos +8, progreso +6; abandonados, apagones, tránsito,
  desempleo y humo restan.
- Ingreso (`budget.ts:123`): `pop × tasa × 0,055` + `empleos × tasa × 0,075`. A 150k con 7 % son
  unos 97.000/mes.
- Nivel de un lote (`demand.ts:95`): nivel 4 pide `landValue ≥ 29`; nivel 5 pide `≥ 51`. La
  cobertura de servicios se diluye con la densidad: `efficiency = min(1, capacidad / residentes en
  el disco)` (`fields.ts:205`).
- 150k con casas de nivel 4 (60 c/u) son 2.500 lotes residenciales, 1.875 comerciales y 2.625
  industriales: 7.000 de los 16.384 del mapa.

**L5 — el nivel manda en la luz.** Un lote consume `POWER_USE[zona] × nivel` (`power.ts:17`) y aloja
`CAPACITY[zona][nivel]`. De ahí los MW por habitante: nivel 2 → 0,67; nivel 3 → 0,30; nivel 4 →
0,13; nivel 5 → 0,06. Una ciudad de nivel 2 paga **diez veces** más luz por habitante que una de
nivel 5, y cada usina son 600 MW. Densificar no es una opción estética: es la diferencia entre
pagar 80 usinas y pagar 40.

**L6 — 150.000 habitantes es imposible, y no por habilidad.** `budget.ts:137`:

    services = pop × 0,1 × (1 + pop / 9000)

Es cuadrática; el ingreso es lineal (`pop × 0,8325` a tasa 9). Se cruzan en **65.925** habitantes
antes de pagar luz, servicios y calles. Verificado: una ciudad terminada de 163.200 da ingresos
93.805 contra gastos 279.962, con ~245.000 de administración. El mejor resultado de toda la
investigación, con cualquier bot y cualquier gobierno, fue **19.031**.

**L7 — resultado con el jugador que sí juega.** 40 años, seed 7, mismo bot:

| gobierno | pico | perdió | mandatos | aprob | caja |
|---|---|---|---|---|---|
| comunismo | 13.363 | no | 8 | 47 % | +1.611.302 |
| democracia | 1.929 | SÍ | 0 | 16 % | −1.003.292 |
| tecnocracia | 1.802 | SÍ | 0 | 16 % | −1.010.856 |
| teocracia | 1.658 | no | 0 | 16 % | −896.365 |
| dictadura | 994 | no | 0 | 16 % | −907.865 |

Sólo el comunismo sobrevive, y la causa no es la migración: los otros cuatro caen a 16 % de
aprobación y ahí el apetito de crecimiento queda por debajo de 1 y la ciudad se encoge sola.

**L8 — el precipicio de la aprobación.** `appetite = 1,1 × (0,75 + 0,5 × aprobación/100)`
(`politics.ts:157`). Con apetito < 1 la ciudad pierde gente: eso pasa por debajo de **31,8** de
aprobación. No es una pendiente, es un acantilado, y los cuatro gobiernos que no son el comunismo
lo pasan y no vuelven: la deuda fuerza impuestos altos, los impuestos bajan la aprobación, la
aprobación baja corta el crecimiento y sin crecimiento no hay ingresos.

**L9 — la tabla de L7 estaba mal, y era mi instrumento.** `needPower` construía una usina sólo
cuando había apagón, mientras el portón de bandas pedía 25 % de luz libre: con el 94 % de uso la
ciudad quedaba clavada en **3 bandas de 21** y 553.939 pesos en el banco. Con la misma condición en
los dos lados (`use < capacity × 0,75`), el comunismo pasa de 13.346 a **54.650**. Tabla corregida,
40 años, seed 7:

| gobierno | pico | perdió | mandatos | aprob | caja |
|---|---|---|---|---|---|
| comunismo | 54.650 | no | 8 | 45 % | +15.440 |
| democracia | 1.966 | SÍ | 0 | 16 % | −1.113.858 |
| tecnocracia | 1.846 | SÍ | 0 | 16 % | −1.117.337 |
| teocracia | 1.393 | no | 0 | 16 % | −1.011.584 |
| dictadura | 1.212 | no | 0 | 16 % | −893.047 |

**L10 — el plan quinquenal es el motor, y es el único.** Medido sobre el comunismo con el jugador
arreglado:

| cambio | pico | aprob |
|---|---|---|
| plan apagado (premio y aplauso en 0) | 1.055 | 16 % |
| el plan paga plata pero no aplauso (`kept 0`) | 2.542 | 16 % |
| servicios sin descuento (`0,7 → 1,0`) | 54.764 | 45 % |
| `approvalStep 1 → 4` | 58.643 | 43 % |
| premio 60.000 → 40.000 y aplauso 8 → 5 | 58.031 | 44 % |
| el Congreso pide 45 % | 54.650 | 45 % |

El `nudgeApproval(+8)` de cada plan es el único feedback positivo del juego que mantiene una ciudad
arriba del precipicio de 31,8 de aprobación (L8). El descuento de servicios —lo que la ficha
publicita como pro— no mueve el pico. Los otros cuatro gobiernos no tienen nada equivalente: no
están peor balanceados, les falta motor.

**L11 — el nerf elegido: la exigencia de la meta.** `PLAN.growth` es lo único que baja el techo:

| `growth` | pico | aprob | Congresos |
|---|---|---|---|
| 1,40 | 54.650 | 45 % | 8/8 |
| **1,55 (aplicado)** | **51.359** | **45 %** | 8/8 |
| 1,60 | 56.375 | 43 % | 8/8 |
| 1,70 | 56.662 | 33 % | 8/8 |
| 1,80 | 26.750 | 16 % | 7/8 (pierde uno) |

Advertencia para quien lea la columna de población: **no es monótona** (54.650 → 56.375 → 56.662), es
caótica a estos cambios. La de aprobación sí es monótona y es la que decide: es un acantilado.
Con 1,55 el margen sigue intacto; para quitarle la red al jugador hace falta 1,70.
