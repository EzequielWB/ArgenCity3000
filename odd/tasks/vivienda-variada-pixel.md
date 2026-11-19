# La vivienda de nivel alto, con variedad de modelos

Hoy el nivel 5 de residencial tiene **un solo edificio**: `tower()` cambia la altura entre tres valores y
el color entre ocho, pero la masa es siempre la misma —podio ancho, fuste prismático, bandas de vidrio,
sala de máquinas y antena—. En una ciudad con veinte torres eso se lee como la misma torre repetida ocho
veces. El pedido es **modelos distintos**, no colores distintos.

## Specs

- **S1.** *"Los edificios de Residencia de más alto nivel... que haya más variedad, actualmente hay un solo
  edificio de distintos colores, me gustaría que tenga más variedad de modelos."*
- **S2.** La variedad se tiene que ver **en la silueta**, no sólo en la fachada: a 1× una torre mide 32 px
  de ancho y lo que la distingue de otra es el contorno —podio, escalones, ala baja— antes que el color.
- **S3.** No se toca la simulación ni el contrato del renderer: siguen siendo `paintResidential(level,
  variant)` y los ocho variantas que la partida ya guarda. La variante elige el **modelo** y la paleta.
- **S4.** Cada modelo nuevo lleva prueba propia en `tests/residencial-pixel.test.ts`: lo que se cuenta es
  la estructura de cada silueta (escalones, ala baja, franjas verticales, remate), no "hay tinta".

## Tasks

- **T1.** Cuatro modelos para el nivel 5, elegidos por variante, con las alturas dentro de
  `HEIGHT.residential[5]`. Commit `—`: `towerPodium`, `towerSteps`, `towerWing` y `towerSlab`, con el
  despacho en `tower()` por `v & 3` y la paleta por `v`.
- **T2.** Pruebas de estructura de los cuatro modelos + tablero regenerado y mirado. Commit `—`:
  `tests/residencial-variado.test.ts` (6 pruebas).

## Log

- **L1.** Pedido del usuario, junto con el ajuste del Sindicato: *"me gustaría que saques ese coso rojo en
  el frente del sindicato... en caso de querer dejarlo hacé que esté igual de angulado que el edificio"*.
  El estandarte se deja, pero como paño **pegado al muro** (parche de la cara), no como rectángulo de
  píxeles absolutos: es lo que lo hacía flotar.
- **L2.** El reparto: el modelo sale de `v & 3` y la paleta de `v`, así que con las ocho variantes que la
  partida ya guarda cada modelo aparece **con dos colores distintos** (`TOWER_WALLS[v]` y
  `TOWER_WALLS[v + 4]`, que están lejos en la lista). El basamento sale de `(v >> 2) % 4`: dos
  basamentos por modelo. No se toca ninguna interfaz ni la simulación.
- **L3.** Los cuatro, por lo que los distingue en el mapa a 1×:
  1. **Podio y fuste** (`towerPodium`): el de antes. Basamento de dos plantas, más ancho que la torre.
  2. **Escalones** (`towerSteps`): tres cuerpos que se achican en altura. Es la torre de los setenta, la
     que en Buenos Aires se ve en hilera, y la que más se separa de las otras en el contorno.
  3. **Torre con ala baja** (`towerWing`): la torre sobre la esquina del fondo y un ala de dos plantas
     cruzando el frente. La planta es una ele y el skyline gana un cuerpo bajo que ninguna otra tiene.
  4. **Prisma de franjas verticales** (`towerSlab`): sin podio, el vidrio hundido entre tabiques de
     hormigón. Se distingue por el remate que vuela y por las columnas de vidrio.
- **L4.** La variedad se mide en la **silueta**, no en el color, y la prueba lo hace con dos números que
  salen del propio dibujo: la **esbeltez** (la anchura mediana del fuste sobre la del cuerpo bajo, medida
  en las bandas de arriba y de abajo del sprite) y el **corrimiento del eje** de la torre respecto del
  ala. Podio 0,71 y eje centrado; escalones 0,36; ala 0,61 con **4,5 px** de corrimiento; prisma 1,00.
  Los cuatro umbrales salen de esos valores, no de lo que uno supone.
- **L5.** Trampa de la prueba: contar **saltos del borde izquierdo** entre filas consecutivas no sirve.
  En iso un prisma vertical mueve ese borde un píxel cada dos filas, y un escalón de 5 px se reparte en
  dos filas de 2 y 3, así que **ningún salto llega al umbral** y la torre escalonada daba cero escalones.
  Lo que sí mide el escalón es la diferencia de **anchura entre bandas**, que es invariante al redondeo
  fila por fila. Y las franjas verticales se cuentan como **tiradas de vidrio por fila**: el prisma da
  seis, cualquier otro una o dos.
- **L6.** El remate de todas las torres parecía una **cruz**: `antenna()` dibujaba un solo travesaño a un
  píxel de la punta, y a 1× eso no es una antena de TV, es una cruz, y una cruz en lo alto de una torre de
  oficinas es una iglesia. Ahora lleva dos travesaños, el de arriba más corto. Arregla también el edificio
  de renta y dos industriales, que arrastraban el mismo signo.
- **L7.** Evidencia: **1203 / 77** verdes · `tsc --noEmit` limpio · `npm run arte` regenerado · las cuatro
  torres miradas en el tablero a 1× y a 1,7×.
- **L8.** Mirados los ocho en el tablero, el **ala** era el más débil de los cuatro: la torre medía 0,44 del
  lote y 54 de alto, o sea 14 píxeles de ancho contra 54 —una chimenea cuadrada, no una torre— y solo se
  leía cuando la paleta separaba la torre del ala. La torre pasa a 0,56 del lote (de 0,10 a 0,66) y a 50 de
  alto: misma altura relativa, masa de torre. Los números nuevos: esbeltez 0,70, corrimiento del eje 3,5 px.
- **L9.** El tablero mostraba cuatro variantes por nivel, y con ocho la fila quedaba en dos colores: el
  nivel 5 del residencial es el único que pide las ocho, porque ahí cada variante es un modelo distinto y
  no un color. `scripts/arte-board.ts` lo hace con una condición sobre la zona y el nivel, no con un
  parámetro nuevo.
