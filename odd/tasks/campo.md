# El campo

La ciudad tiene casa, comercio, fábrica, costa, monumentos y desastres. No tiene **campo**: la tierra que
la rodea no produce nada. Esta feature agrega la cadena agrícola —lote, silo, feria— con su calendario, su
precio y su plata entrando de golpe una vez al año en vez de pareja todos los meses.

El eje no es "una zona más". Es que **la cosecha cobra en un pico y el gasto sale todos los meses**: el
presupuesto deja de ser una suma y pasa a ser un problema de caja.

## Specs

### S1 — El campo no tiene distrito propio; lo ubica el jugador
- No hay cinturón agrícola, ni suelo reservado, ni regla que prohíba plantar en el centro. *"no creo que
  sea necesario 'definir' un lugar sinó que el jugador mismo termina definiendolo a la hora de colocarlo
  lejos, de igual forma que se coloca la industria medio afuera"*.
- El alejamiento sale del **costo**, no de una prohibición: un lote de cultivo se conecta con **calle de
  tierra** ($3, mantiene $0.5/mes, `ROAD_TIERS[DIRT]`) y **no pide tendido eléctrico**. Ponerlo donde ya hay
  asfalto y luz es pagar infraestructura urbana para una chacra que no la usa.
- La **superficie** empuja en la misma dirección: el lote es 2×2 y no entra entre dos casas.
- Si la ciudad crece y lo rodea, no se rompe nada: el campo sigue produciendo adentro del ejido. *"Si por
  expansión termina dentro no pasa nada pero que esté un poco alejado"*.

### S2 — La cadena: nada se vuelve plata sin pasar por la feria
- Tres piezas, en orden: **lote** (produce toneladas) → **silo** (las guarda) → **feria** (las convierte en
  pesos).
- Un lote **no vende**. Un silo **no vende**. Sólo la feria cobra. Sin feria, el campo produce y la ciudad
  no ve un peso: es la diferencia entre tener campo y tener plata.
- La feria tiene tope de conversión por mes: un silo lleno y una feria chica dejan toneladas esperando.
- Criterio de aceptación: cosechar sin feria deja el stock subiendo y el ingreso del campo en cero.

### S3 — El calendario manda: una cosecha al año
- Cada cultivo tiene su mes de siembra y su mes de cosecha. El trigo del corte 1: **siembra en mayo,
  cosecha en diciembre** (`dateOf(tick).month`).
- Sembrar no es una acción: el lote se planta una vez y entra solo en su ciclo. Lo que el jugador elige es
  **qué** cultivo y **dónde**.
- La cosecha se resuelve en `endOfMonth`, cuando el mes que terminó es el de cosecha.
- Criterio de aceptación: en los once meses que no son diciembre el stock no sube por cosecha; en diciembre
  sube de golpe.

### S4 — El precio tiene forma, no es ruido
- El precio de la tonelada **cae en cosecha** (todos venden) y **sube en invierno** (nadie tiene nada). Sin
  forma predecible, vender es una lotería y el silo es un adorno caro.
- El precio del mes es visible antes de decidir, y el panel muestra el histórico para que la caída de
  diciembre se lea como estación y no como castigo.
- Rango del corte 1 (a calibrar con `npm run probe`): base $120/t en cosecha, hasta $180/t en invierno.
- Criterio de aceptación: el precio de diciembre es el más bajo del año y el de junio/julio el más alto.

### S5 — La orden: el jugador fija la política, el sistema vende
- *"Prefiero la (b), siento que va con la idea de estos juegos?"*. El jugador **no** aprieta "Vender" cada
  mes: fija dos umbrales y el sistema ejecuta.
- Los dos campos: **precio mínimo** ("vendé sólo si la tonelada pasa de $X") y **toneladas a retener**
  ("nunca bajes de N").
- Es el mismo idioma que ya habla el juego, donde el jugador fija un umbral y el sistema lo ejecuta solo:
  `funding`, `strikeBelow`, `overthrowBelow`, `fireFrom`.
- Criterio de aceptación: con la orden en $200 el silo no vende un kilo y el stock no baja; bajando la orden
  a $100 vende hasta la retención y se detiene justo ahí.

### S6 — Guardar cuesta, o la orden es obvia
- Si esperar fuera gratis, la jugada óptima sería pedir el precio máximo y no vender nunca. Guardar tiene
  que tener precio.
- Tres costos, todos baratos de implementar: **capacidad finita** del silo (si no vendés, la cosecha del año
  que viene no entra), **mantenimiento mensual** del silo y de la feria (vendan o no), y **merma** (un
  porcentaje del stock se estropea cada mes).
- La merma sola ya alcanza para que el óptimo no sea "esperá siempre": si se come la diferencia, esperar
  deja de convenir.
- Criterio de aceptación: con la orden en el máximo durante doce meses, el stock termina **menor** que al
  principio por merma, y la plata cobrada es menor que la que se habría cobrado vendiendo en el pico.

### S7 — La plata del campo entra por la misma caja que el impuesto
- La venta de la feria es **ingreso del mes** en `monthlyBudget`, junto al impuesto y a la costa: la misma
  caja, el mismo balance, el mismo rojo cuando no alcanza.
- El mantenimiento del campo es **gasto del mes**, como el de las usinas.
- Se calcula en una función que lee el mundo y el mes, igual que `coastBudget(w, month)`, para no meter
  estado nuevo en el presupuesto.
- Criterio de aceptación: `monthlyBudget` con campo devuelve `farmIncome` y `farmUpkeep` no nulos, y
  `income - expenses` sigue cerrando con las cuatro semanas.

### S8 — Alcance del corte 1
- Entra: **trigo, silo, feria, precio con forma, orden de venta, merma, presupuesto**.
- No entra todavía, y queda anotado para las vueltas siguientes: maíz y soja (misma pieza, otro
  calendario), **tambo y ganadería** (producen todos los meses: rompen el molde del pico y merecen su
  propia vuelta), **retenciones** (la Provincia se queda un porcentaje; une campo, presupuesto y política,
  pero es una palanca de gobierno y va aparte), y los **eventos** (sequía, granizo, peste, paro de
  camioneros, precio internacional).
- *"tambien hay que agregar eventos aleatorios al respeto, presupuesto y eso"*: quedan en el alcance de la
  feature, no del corte.

## Tasks

- **T1** — `src/sim/campo.ts`, módulo puro: calendario por cultivo, precio del mes, merma, y la decisión de
  cuánto vende la feria. Sin tocar nada más. `S3 S4 S5 S6`
- **T2** — Estado del campo en `World` (`farms`, `silos`, `markets`) con su serialización y `SAVE_VERSION`.
  Un guardado viejo crece, no se rompe. `S2`
- **T3** — Colocación y costos: lote 2×2, silo, feria en `COSTS`, herramientas en `tools.ts`, y el requisito
  de calle de tierra sin tendido. `S1`
- **T4** — `endOfMonth`: cosecha en el mes que corresponde, merma, y la venta que decide la orden. `S3 S5 S6`
- **T5** — `monthlyBudget`: `farmIncome` y `farmUpkeep` en `BudgetReport`, con su línea en el panel de
  presupuesto. `S7`
- **T6** — Panel del campo: precio del mes, stock por silo, y los dos campos de la orden. `S4 S5`
- **T7** — Arte pixel: lote de trigo (2×2, con el rastrojo del mes), silo y feria, con su fila en el board y
  su test de estructura. `S2`

## Log

- **L1** — Pedido original, verbatim: *"Escucha, deshabilita el tornado en el codigo, lo dejamos parado por
  ahora al desarrollo de eso. Quiero agregar la idea de "campo" cosas de campo, terreno cultivado, ganado,
  tampo, silos, etc... como se te ocurre? es un cambio grande, asi que hay que irlo hablando, tambien hay
  que agregar eventos aleatorios al respeto, presupuesto y eso"*.
- **L2** — El tornado se apagó con un interruptor y no borrando (`88b53fa`, `DESASTRE.tornadoEnabled`): la
  maquinaria queda entera para cuando se retome el embudo.
- **L3** — El usuario descartó el distrito agrícola: *"La idea es que el campo viva afuera de la ciudad (Si
  por expansión termina dentro no pasa nada pero que esté un poco alejado) pero no creo que sea necesario
  "definir" un lugar sinó que el jugador mismo termina definiendolo a la hora de colocarlo lejos, de igual
  forma que se coloca la industria medio afuera"*. Eso fijó S1.
- **L4** — Se le ofrecieron dos formas del campo (plata sola al cosechar, o cadena por mercado) y eligió la
  cadena: *"La 2da"*. De ahí sale S2.
- **L5** — Se le ofrecieron dos formas de vender (botón mensual, o precio mínimo con venta automática) y
  eligió la segunda, con una duda: *"Prefiero la (b), siento que va con la idea de estos juegos? o no?"*. La
  respuesta fue que sí, porque en estos juegos el jugador **regula y no opera**, y porque el juego ya está
  hecho de umbrales que el jugador fija y el sistema ejecuta. De ahí sale S5.
- **L7** — **T1 hecho**: `src/sim/campo.ts` con `CROPS`, `PRICE_RANGE`, `MERMA`, `harvestMonth`,
  `priceOf`, `priceTable`, `tonsToSell` y `spoil`. Trece tests en `tests/campo.test.ts`, escritos antes del
  módulo (RED: el import no existía). La curva quedó: diciembre $120 (piso, cosecha), junio $180 (techo),
  subiendo y bajando sin escalones. Un lote 2×2 rinde $3.600 en cosecha y $5.400 esperando a junio.
- **L8** — Riesgo anotado para T5: el precio es **exógeno** —sólo lo mueve el calendario—, así que no
  responde a la oferta. A escala chica el campo pierde por el costo fijo del silo y la feria; a escala
  grande podría ser una máquina de plata. Hay que decidir en T5 si el precio baja cuando la ciudad vende
  mucho, o si eso se resuelve con el tope de la feria y el mantenimiento.
- **L6** — Al aceptar la (b) se agregó la condición que la salva de ser obvia: si esperar es gratis, la
  jugada óptima es pedir el máximo y no vender nunca. Guardar tiene que costar (capacidad, mantenimiento,
  merma). De ahí sale S6.
