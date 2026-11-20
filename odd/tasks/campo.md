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

### S4 — El precio tiene forma **y responde a la oferta**
- El precio de la tonelada **cae en cosecha** (todos venden) y **sube en invierno** (nadie tiene nada). Sin
  forma predecible, vender es una lotería y el silo es un adorno caro.
- Rango del corte 1 (a calibrar con `npm run probe`): base $120/t en cosecha, hasta $180/t en invierno.
- **Y la oferta lo mueve**: lo que la ciudad vuelca al mercado deja una presión que ablanda el precio, y esa
  presión decae sola con los meses. Es el mecanismo que en la realidad hunde el precio en cosecha, y el que
  evita que el campo sea una máquina de plata a escala grande.
- La presión **decae**: un diciembre de volquete no arruina el junio siguiente. Si no decayera, una cosecha
  grande castigaría para siempre y el jugador no tendría cómo recuperarse.
- El precio del mes es visible antes de decidir, y el panel muestra el histórico para que la caída de
  diciembre se lea como estación y no como castigo.
- Criterio de aceptación: (a) el precio de diciembre es el más bajo del año y el de junio el más alto;
  (b) vender lo mismo repartido en tres meses paga más que venderlo todo en uno.

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

- **T1** — `src/sim/campo.ts`, módulo puro: calendario por cultivo, precio del mes **con la presión de
  oferta**, merma, y la decisión de cuánto vende la feria. Sin tocar nada más. `S3 S4 S5 S6`
- **T2** — Estado del campo en `World` (`farms`, `silos`, `markets`) con su serialización y `SAVE_VERSION`.
  Un guardado viejo crece, no se rompe. `S2`
- **T3** — Colocación y costos: lote 2×2, silo, feria en `COSTS`, herramientas en `tools.ts`, y el requisito
  de calle de tierra sin tendido. `S1`
- **T4** — ~~`endOfMonth`: cosecha en el mes que corresponde, merma, y la venta que decide la orden.~~ **Hecho.**
  `settleHarvest` + el ingreso en `monthlyBudget` + la noticia del diario. `S3 S5 S6` `ae4fa08`…
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
- **L12** — **T3 hecho**: las tres herramientas (`farm` `<`, `silo` `>`, `market` `%`), el grupo **Campo** en
  la barra con su ícono, los costos en `COSTS` ($30, $300, $600), y la demolición que se lleva la pieza
  entera. Las tres se desbloquean juntas en el hito de Caserío (100 habitantes): un lote sin silo ni feria
  produce y no cobra, y esa trampa no se le hace a un jugador que recién arranca. Las teclas son símbolos
  porque las letras están todas tomadas por las herramientas viejas o por los atajos globales (`g` guardar,
  `h` ayuda, `m` sonido).
- **L13** — **Referencias para el arte** (pedidas por el usuario: *"busca referencias en internet de como son
  esas cosas acá"*). De Wikimedia Commons, categorías `Silos in Argentina` y `Grain elevators in Argentina`:
  `Silo de cereal en Eduardo Castex.JPG`, `JUNIN Campo 001.jpg`, `Planta de Silos - panoramio.jpg`,
  `Elevador de granos de San Pedro (1).jpg`. Lo que dicen, y que cambió el dibujo: en el campo argentino lo
  que se ve de lejos **no es el silo de tambo cilíndrico** sino la **planta de acopio** — una torre de chapa
  rectangular y alta con las virolas horizontales— más la **noria** todavía más alta que sube el grano, el
  **tinglado de chapa a dos aguas** (azul en la de Junín) y la **playa de maniobras de ripio**. El primer
  intento dibujó dos cilindros y se leyó como dos latas: por eso el silo pasó a ser la torre.
- **L17** — **T4 hecho**: `settleHarvest(w, month, order)` en `src/sim/campo.ts` cierra el mes del campo en
  tres pasos y **en este orden**, que es el de la realidad: primero la **merma** sobre lo que ya estaba
  guardado (lo viejo se estropea, no lo que entra hoy), después la **cosecha** repartiendo los lotes entre los
  silos y perdiendo lo que no entra, y al final la **venta**, que es lo único que convierte toneladas en
  pesos. El precio se lee **antes** de anotar la presión de esta venta: el jugador cobra el mercado que
  encontró, y el que vuelca mucho lo ablanda para el mes que viene.
  `SimState` gana `order` (la política del jugador) y `harvest` (el recibo del cierre); los dos se guardan y
  un guardado viejo abre vendiendo todo y sin recibo. La cosecha se resuelve **antes** del presupuesto, así
  el ingreso entra por la misma caja que el impuesto. `BudgetReport` gana `farmIncome` y `farmUpkeep`, y el
  diario publica la noticia del campo: un salto de miles de pesos sin explicación es peor que un impuesto
  caro. 21 tests en `tests/campo-cosecha.test.ts`.
- **L18** — Dos cosas que aparecieron escribiendo T4 y que quedan dichas:
  1. **Un bug propio, cazado por los tests**: la venta era `Math.min(tonsToSell(...), takeTons(w, Infinity))`,
     y `takeTons` se ejecuta antes del `Math.min`, así que vaciaba los silos aunque la orden no vendiera
     nada. Ahora se calcula `want` y después se saca.
  2. **La merma corre antes de la venta**, y eso mueve todos los números de los tests: 100 t con la retención
     en 70 venden 26, no 30. Las expectativas se corrigieron con la cuenta a la vista, no al revés.
- **L19** — **El campo está desbalanceado y hay que decidirlo en T5**, con el número: un lote cuesta **$30** y
  da **30 t × $180 = $5.400 por año**: se paga en **dos días** de juego. Una feria trabajando a full pide 48
  lotes (205 celdas con el silo y la feria) y rinde **$1.262 por celda y año**, contra los ~$328 que deja una
  celda de torres. O sea: hoy llenar el mapa de trigo es la jugada óptima, y S1 quería que el campo fuera una
  pieza de borde, no la ciudad entera. La palanca es `CROPS.trigo.tons` —no el precio—: bajarlo a **8** deja
  el payback en ~7 meses y el campo en ~$337/celda/año, en línea con los edificios. **No se cambió todavía.**
- **L20** — **El nerfeo** (decisión del usuario: *"Metamos nerfeo entonces si es muy bueno"*). Primero se
  midió en serio, porque el número de L19 estaba a ojo y **estaba mal**: el impuesto real de una celda de
  nivel 5, medido con `monthlyBudget`, es **$739** residencial, **$756** industrial y **$631** comercial, no
  $328. O sea el campo con 30 t rendía $1.262/celda contra $739: **1,7 veces** una torre, no cuatro.
  `CROPS.trigo.tons` baja de **30 a 20**. El campo a pleno queda en **$607 por celda y año** aguantando la
  cosecha hasta junio (contra $739 de una torre, que además paga luz, agua, calles y los seis servicios) y
  **$516** vendiendo en diciembre. La cadena sigue teniendo sentido —una feria pide 48 lotes y la cosecha de
  un solo mes obliga a **cinco silos**— y el campo deja de ser la jugada obvia. El payback de un lote sigue
  en tres días porque **la tierra es barata a propósito** (S1): lo caro de verdad son el silo y la feria.
- **L15** — **Verificación antes de probar local**, y trajo un bug: el `footprint` de las tres piezas **recortaba**
  contra el borde del mapa en vez de correr el ancla para adentro como la usina, el depósito y los servicios.
  Una feria puesta en la esquina pisaba **una** celda y se cobraban los $600 enteros, con el dibujo de 3×3
  colgado fuera del mapa. Corregido en `src/world/farms.ts` y con tres tests nuevos que fallaban antes.
  Los tests viejos no lo veían porque probaban centros, no bordes.
- **L16** — El primer silo se leyó como **una torre de oficinas gris**: era una caja con virolas y un techo a dos
  aguas, sin nada redondo. Se rehizo con la pieza que la referencia muestra y el primer intento no tenía:
  **dos cilindros de chapa** con el cono encima, la noria fina al costado y la casilla de mando en ocre. El
  cilindro se hace con dos franjas en sombra en las esquinas verticales y las virolas, no con una curva: a 1×
  no hay curva. El óvalo de la tapa se probó y se sacó, se leía como un parche claro flotando en el borde.
- **L14** — Deudas del arte, para T7: el lote está siempre con el trigo crecido porque el sprite no sabe en
  qué mes está la partida (el rastrojo de mayo y el rastrojo después de cosechar quedan pendientes); el techo
  del galpón de la feria tiene la textura de chapa demasiado marcada y a 1× se lee como azulejo; y el lote no
  avisa en el dibujo si le falta el silo o la feria para vender.
- **L10** — **T2 hecho**: el campo existe en el mundo y en el archivo. Tiles nuevos `TILE.FARM`,
  `TILE.SILO` y `TILE.MARKET` (23, 24 y 25); listas `World.farms`, `World.silos`, `World.markets` y
  `World.farmPressure`; helpers en `world/farms.ts` (`storeTons` devuelve lo que no entró, en vez de
  perderlo en silencio). Tamaños y capacidades en `config.ts` (`FARM_SIZE`, `SILO_SIZE`, `MARKET_SIZE`,
  `SILO_CAPACITY`, `MARKET_THROUGHPUT`). `CROPS` se mudó de `sim/campo.ts` a `config.ts` — es un catálogo,
  como `PLANTS` y `HUBS`, y `world.ts` no debe importar de `sim/` — y `campo.ts` lo reexporta.
  `SAVE_VERSION` no se movió: un archivo viejo carga con las tres listas vacías y la presión en cero.
- **L11** — El test de la costa tenía clavado `MAX_TILE === TILE.UNIQUE`. Con el campo el último id pasó a
  ser el de la feria: el test cambió para decir lo que sigue siendo cierto —el plano se valida contra el
  último tile— y no lo que era cierto cuando se escribió.
- **L9** — **La oferta implementada** (T1 reabierta y vuelta a cerrar): `PRICE_OFFER = { saturate: 2000,
  drop: 0.45, keep: 0.5 }` y `nextPressure(prev, sold)`. La presión se cuenta por tonelada **con la venta
  incluida**: el que vuelca cobra el mercado que él mismo ablandó. Con la presión del mes anterior, volcar
  todo de una vez cobraba el precio tranquilo y repartir no tenía ninguna ventaja — el primer test lo
  mostró en rojo y obligó a corregir el modelo, no el test. Números: 900 t de una vez pagan $86.400 y las
  mismas 900 repartidas en tres meses, $102.600 (+18,8 %). Mercado saturado, el precio cae 45 % en todos
  los meses menos en su piso, que es 66.
- **L7** — **T1 hecho**: `src/sim/campo.ts` con `CROPS`, `PRICE_RANGE`, `MERMA`, `harvestMonth`,
  `priceOf`, `priceTable`, `tonsToSell` y `spoil`. Trece tests en `tests/campo.test.ts`, escritos antes del
  módulo (RED: el import no existía). La curva quedó: diciembre $120 (piso, cosecha), junio $180 (techo),
  subiendo y bajando sin escalones. Un lote 2×2 rinde $3.600 en cosecha y $5.400 esperando a junio.
- **L8** — Se anotó que con el precio **exógeno** —sólo movido por el calendario— el campo podría ser una
  máquina de plata a escala grande. Se le ofrecieron dos cierres: el precio responde a la oferta, o el freno
  son los topes del silo y la feria. Eligió el primero: *"Me gusta lo de la oferta"*. De ahí sale el tramo
  nuevo de S4, y T1 se reabre.
- **L6** — Al aceptar la (b) se agregó la condición que la salva de ser obvia: si esperar es gratis, la
  jugada óptima es pedir el máximo y no vender nunca. Guardar tiene que costar (capacidad, mantenimiento,
  merma). De ahí sale S6.
