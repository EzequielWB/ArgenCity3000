# Comercio: dos modelos por nivel en la calle baja

Los niveles 1 a 4 del comercio tienen **una silueta cada uno** y cuatro variantes que la repintan. En el
tablero, el nivel 3 son cuatro veces la misma peluquería con otro color de pared: el jugador no ve un
barrio, ve una caja repetida. El nivel 5 ya se ganó sus cuatro modelos. La calle baja merece dos.

## Specs

- **S1.** Cada nivel del comercio 1–4 tiene **dos modelos**, no uno. El modelo sale de
  `model = (v >> 1) & 1`, así que cada uno aparece con **cuatro paletas**: el juego guarda ocho
  variantes por lote y repartirlas 4/4 mantiene las dos siluetas presentes en cualquier calle.

- **S2.** Los dos modelos de un mismo nivel tienen que distinguirse **por la silueta antes que por el
  color**, que es la lección del nivel 5: el jugador reconoce el tipo de negocio por el techo, por cómo
  trata la vereda y por lo que tiene arriba, no por el tono de la pared.

- **S3.** El segundo modelo de cada nivel, por barrio argentino y por silueta:

  | Nivel | Modelo 0 (existente) | Modelo 1 (nuevo) | Lo que cambia |
  |---|---|---|---|
  | 1 · local mínimo | kiosco: caja baja, toldo plano, cajón en la vereda | **panadería**: techo a dos aguas, canastos en la vereda | la caja se vuelve triángulo |
  | 2 · local de barrio | verdulería: abierta a la calle, cajones de fruta, toldo verde | **carnicería**: cerrada, vidriera grande, toldo recto | abierta contra cerrada |
  | 3 · local de avenida | peluquería: poste de barbero, banda, parapeto | **farmacia**: cruz verde sobre la fachada, dos pisos | el poste contra la cruz |
  | 4 · local de noche | bar: madera, toldo, tanque en la azotea | **pizzería**: toldo a rayas, campana de chapa en el techo | tanque contra chimenea |

- **S4.** Nada de lo que se agregue puede romper lo que ya se lee: el kiosco conserva su toldo y su cajón,
  la verdulería sus frutas, la peluquería su poste y el bar su madera. El segundo modelo **se suma**.

- **S5.** La prueba de cada nivel es la **diferencia estructural entre los dos modelos**: techo triangular
  contra techo plano, fachada cerrada contra fachada abierta, cruz contra poste, chimenea contra tanque.
  Ninguna prueba puede apoyarse en "hay tinta" ni en un color de marca que cambie con la variante.

- **S6.** Checks: `npx vitest run` verde · `npx tsc --noEmit` limpio · captura del tablero con los dos
  modelos de cada nivel, leída.

## Tasks

| ID | Tarea | Specs | Archivo | Commit |
|---|---|---|---|---|
| T1 | El modelo por variante y la panadería | S1, S2, S3, S4 | `src/render/pixelArt.ts` | `1c7e0f5` |
| T2 | La carnicería | S2, S3, S4 | `src/render/pixelArt.ts` | `1c7e0f5` |
| T3 | La farmacia | S2, S3, S4 | `src/render/pixelArt.ts` | `1c7e0f5` |
| T4 | La pizzería | S2, S3, S4 | `src/render/pixelArt.ts` | `1c7e0f5` |
| T5 | Las pruebas de los cuatro pares | S5 | `tests/comercio-variado.test.ts` | `1c7e0f5` |
| T6 | Tablero con los dos modelos por nivel | S6 | `scripts/arte-board.ts` | (sin cambio) |

## Log

- **L1.** *"Ah pero está pusheado y todo? joya. Queres hacer lo que me decias de los comerciales?"* — sí:
  lo que ofrecí fue que los niveles 1 a 4 del comercio dejaran de ser la misma caja repintada.
- **L2.** El tablero ya mostraba cuatro variantes por nivel, y como el modelo sale de `(v >> 1) & 1`, esas
  cuatro son **los dos modelos con dos paletas cada uno**: no hubo que tocar `arte-board.ts`. La fila del
  nivel 5 sigue mostrando las ocho porque ahí el reparto es 4 × 2.
- **L3.** Cuatro correcciones que pidió el dibujo, todas del mismo tipo —el detalle se pierde cuando lo tapa
  la masa que va encima—:
  - La panadería: el alero del techo a dos aguas se comía la banda del cartel. La pared subió a once y el
    techo bajó de rise seis a cuatro; recién ahí se ven la vidriera, las hogazas y el cartel.
  - La carnicería: tres filas de azulejo blanco sobre trece dejaban la fachada blanca. Dos alcanzan, y el
    toldo de chapa pasó de claro a gris oscuro para no confundirse con el azulejo ni con el parapeto.
  - La farmacia: la cruz **en la pared** se leía como una mancha verde entre las ventanas —cinco píxeles con
    el escorzo de la isométrica encima—. Va en el **techo**, sobre un pie de hierro: una pieza de nueve de
    alto que se ve desde la esquina, que es lo que una cruz de farmacia hace.
  - La pizzería: campana y chimenea de bandas juntas se leían como dos tarros de pintura. Quedó la campana
    con su **ducto de chapa**, una sola masa.
- **L4.** La prueba de la lona necesitó **dos predicados y no uno**: la lona del kiosco es `#f4ece0` y la
  franja blanca del toldo de la pizzería `#f2ede0`, y con una tolerancia ancha el **marco de la vidriera de
  la panadería** (`#e6e9e2`) entraba como toldo. A diez de distancia cada una, cero del vecino.
- **L5.** Y la de la pizzería no puede ser la de las rayas: la marquesina del bar también da saltos de tono
  —es de dos tonos de la marca—, así que medía lo mismo en los dos. La prueba quedó en la lona blanca.
- **L6.** Evidencia: `npx vitest run` **1214 / 78 archivos** verdes · `tsc --noEmit` limpio · captura del
  tablero leída, cuatro filas con los dos modelos. Medido: nivel 1 alto 20 vs 25 · nivel 2 hueco del frente
  37 vs 0 · nivel 3 verde de la cruz 13 vs 0 y alto 28 vs 41 · nivel 4 lona 0 vs 27 y alto 32 vs 36.
