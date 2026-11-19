# Los tres únicos de gobierno, en píxel

Los tres que quedaron para el final a propósito: **Regimiento (4×3)**, **Santuario (3×4)** y
**Sindicato (3×2)**. Son los más parecidos entre sí, así que el último lote se hace con todas las
lecciones de los siete anteriores ya juntas. Cuando estén, `sprites.ts` baja a `rectPainter` y
`routeSignSpriteFor` y el canvas deja de existir en el arte.

## Specs

- **S1.** El pedido es el mismo de toda la migración: el edificio tiene que verse **como es**, en
  píxel a 1×, con la disciplina de siempre — buffer de píxeles, píxeles duros, la única transparencia
  parcial permitida es la sombra del lote (α ≤ 96).
- **S2.** El `vw`/`vh` que llega es el lote **como lo ve la cámara**; el painter dibuja el eje largo en
  `u`, igual que el Cabildo y el Teatro, y no inventa orientaciones.
- **S3.** El contrato del renderer no cambia: `penRect(vw, vh, MAX_Z)`, mismo ancla, misma sombra, y
  la simulación intacta (costo, mantenimiento, tamaño y el efecto de gobierno de cada uno).
- **S4.** Lo que canvas dibujaba se **borra**, no se deja detrás de una condición: `tsc` con
  `noUnusedLocals` es el árbitro.
- **S5.** Cada uno lleva su prueba, y la prueba cuenta **estructura** (planta, alturas, masas,
  materiales por temperatura), no "hay tinta".

## Tasks

- **T1.** Regimiento: painter de píxel + `paintRegimiento`/`regimientoPixelSprite` + `regimientoArt`
  borrado + `tests/regimiento-pixel.test.ts`. Hecho.
- **T2.** Santuario 3×4: painter de píxel + `paintSantuario`/`santuarioPixelSprite` + `santuarioArt`
  borrado + `tests/santuario-pixel.test.ts`. Hecho.
- **T3.** Sindicato 3×2: painter de píxel + `paintSindicato`/`sindicatoPixelSprite` + `sindicatoArt`
  borrado + `tests/sindicato-pixel.test.ts`. Hecho. Con este se va también el resto del canvas:
  `Painter.box/left/right/windows/hipRoof/gableRoof/cylinder/tree/crown/post/bench`, `rectPainter`,
  `TREE` y `BENCH` quedan sin uso y se borran. `sprites.ts` 611 → **240** líneas.

## Log

- **L1.** Pedido: *"Dale, hacelo al regimiento"*, después de que quedaran listados los tres.
- **L2.** La planta es el edificio. Un cuartel **no es un edificio alto**: es un cerco con un campo
  adentro. Por eso el painter arranca por el **patio de armas** —tierra apisonada con las manchas del
  uso, porque liso se lee como una cancha de cemento— y las cuadras se dibujan **alrededor**, en ele,
  contra las dos aristas del fondo. El patio queda abierto del lado de la cámara, que es lo único que
  lo deja ver.
- **L3.** Lo que lo identifica, en orden: el patio vacío, la **torre de vigilancia**, la **bandera** y
  el **muro del perímetro**. Sin el muro el patio es un descampado con dos cuadras.
- **L4.** Tres trampas de lectura, las tres encontradas mirando la pantalla:
  1. La torre de 21 px **no se leía como torre**: al lado de una cuadra de 18, eran seis píxeles de
     diferencia. Va de 30, casi el doble que la cuadra.
  2. Contra la **cal del fondo** una torre de cal no tiene contorno y se lee como una caseta: va
     adelante, **sobre la tierra del patio**, donde la silueta sí se recorta.
  3. Su capuchón en teja verde **se perdía** contra el techo verde de atrás: el capuchón va en
     **zinc** (gris frío), que es el único gris frío del edificio.
- **L5.** La bandera: el mástil va **adelante y no alto** (22 px, no 27) para que el celeste y el
  blanco queden contra la tierra. Contra la cal se lavan y la bandera parece pintada en la pared.
  Seis filas de franjas (dos celestes, dos blancas, dos celestes) con el sol de un píxel y la punta
  que ondula: sin la punta es un rectángulo pegado al palo.
- **L6.** El portón empezó **debajo de la torre** y la torre lo tapaba: quedaba un hueco en el muro sin
  explicación. Pasó al muro de adelante, con dos pilares y una hoja de reja oscura —en una pared de
  cal, un paño oscuro a la altura del muro se lee como portón— y las varillas de la textura `sheet`.
- **L7.** `tests/regimiento-pixel.test.ts` (7 pruebas): el patio es la superficie más grande y su
  centro está vacío; las cuadras lo cierran en ele **y no lo cierran por abajo** (`roof.maxY <
  dirt.maxY`: si el techo bajara más que el patio, el edificio sería una caja con un pozo adentro); la
  torre es una columna de cal de más de 16 px con el capuchón de zinc macizo; la bandera tiene **dos**
  tramos celestes separados por el blanco y el mástil baja hasta el piso; el muro corre por el frente;
  los árboles y el camión están; y la simulación no se toca.
- **L8.** Trampa de la prueba: el helper del capuchón medía la **distancia entre el primer y el último**
  píxel de zinc de la fila, y el mástil de la bandera —un gris parecido, a 28 píxeles de distancia—
  hacía que una fila de tierra "midiera 29". Se mide la **corrida contigua** más larga: el capuchón es
  una pieza maciza y un cable de un píxel no es un capuchón. Y el predicado pide `b - r ≥ 8` para
  quedarse con el gris **frío** y no con el gris verdoso de la reja.
- **L9.** Evidencia: **1185 / 74** verdes · `tsc --noEmit` limpio · tablero regenerado · el regimiento
  mirado en el tablero a 1× y en detalle a 4×.
- **L10.** El Santuario, primera lección: **la nave corre hacia el fondo, no a lo ancho**. Dibujada a lo
  ancho, la aguja de la torre de la derecha se montaba sobre la silueta del techo y la basílica se leía
  con **una sola** aguja. Con la nave en profundidad, las dos torres quedan en el frente y cada una
  recorta su aguja contra el cielo.
- **L11.** Los tres tonos del ladrillo van a mano (`#c07a5c`/`#9c5a44`/`#7d4433`): el `0.69/0.59`
  automático dejaba el ladrillo casi negro, que a 1× es una pared de carbón.
- **L12.** **La campana va antes que el vano del campanario en la lista de parches**, y lo mismo en la
  cara lateral: el primer parche que toca un píxel gana, y con el vano primero la campana desaparecía y
  el campanario quedaba como un agujero negro.
- **L13.** El **frontis** de piedra entre las torres se sacó: a 1× iso es una astilla blanca que no dice
  nada. La cornisa de piedra se pinta **dentro** de la pared (dos fajas de `STONE_LIGHT`), no como losa.
- **L14.** Las agujas no se recortaban contra el cielo: la torre de la derecha quedaba **dos píxeles por
  debajo** de la cumbrera del techo y la prueba la encontraba contra la pizarra. Se arregló con las dos
  cosas que son verdad en la basílica: **la nave va baja** (`NAVE_H = 14`) y **las torres van altas**
  (cuerpo 31 + aguja 19). La prueba ahora pide, por torre, que la punta esté **por encima de la pizarra**
  (`tip < slateTop - 3`) y no que haya cielo: es la afirmación que importa —una aguja que pasa el techo— y
  no depende de dónde cayó el redondeo.
- **L15.** La cruz **arranca en la punta de la aguja**, no dos píxeles arriba: colgada en el aire no es
  una cruz, es un signo flotando sobre la torre. Se vio en la captura, no en la prueba.
- **L16.** El Sindicato: el pedido es **el salón de un pueblo obrero**, no una torre gremial. Un bloque
  de hormigón con el portón ancho, el estandarte rojo encima y la bandera en la azotea; el rojo es lo
  único rojo del edificio y por eso alcanza para nombrarlo.
- **L17.** Dos masas y no una: el **salón adelante** (22) y las **oficinas atrás** (29), que le sacan una
  cabeza. Con una sola masa de hormigón el edificio era un galpón. La faja de vidrio de las oficinas va
  en los últimos cinco píxeles visibles de su cara —lo único que asoma— y por eso se lee como un borde
  de vidrio bajo el pretil, que es exactamente como se ve un bloque de oficinas de los cincuenta desde
  abajo.
- **L18.** Tres trampas, las tres de la captura:
  1. El **portón no existía**: el parche del marco de piedra iba primero y cubría de `k0: 0` a `k1: 9`,
     así que la madera nunca tocaba un píxel. La puerta va **primero** en la lista.
  2. A 1× el portón negro es **un agujero**: va en madera clara (×1.45) con la junta de las dos hojas
     en el medio. Se mide además que el promedio del rojo de la madera pase de 95.
  3. El **árbol** se contaba como puerta en la prueba: el tronco (`#61472d`) entraba en el predicado de
     la madera. Se separó pidiendo `b > 55`.
- **L19.** `tests/sindicato-pixel.test.ts` (6 pruebas): el hormigón es la superficie más grande; el
  portón es ancho, está en el medio del estandarte y no es un pozo; el estandarte cuelga **sobre** el
  portón (`estandarte.minY < door.minY - 2`) y la bandera está más arriba que el estandarte; la bandera
  corona la azotea con cielo arriba; hay **columnas con dos fajas de vidrio a dos alturas** —la prueba de
  las dos masas, medida donde se ve y no donde uno supone—; y la simulación no se toca.
- **L20.** Trampa de la prueba de las dos masas: primero se intentó partir el sprite por la mitad en `x`
  y comparar la mediana del borde de arriba de cada mitad. **No sirve**: las dos masas se proyectan
  encima, así que la mitad izquierda también tiene oficinas. La prueba que sí dice algo es la de las
  columnas con dos tiradas de vidrio separadas.
- **L21.** Con los dos últimos, el canvas se va del arte: se borran `rectPainter`, los métodos de dibujo
  del `Painter` que ya nadie llamaba (`box`, `left`, `right`, `windows`, `hipRoof`, `gableRoof`,
  `cylinder`, `tree`, `crown`, `post`, `bench`), `TREE`, `BENCH`, `shade` y las constantes `TOP/LEFT/
  RIGHT`. `sprites.ts` queda en **240 líneas**: el cartel de la ruta y nada más.
- **L22.** Evidencia: **1197 / 76** verdes · `tsc --noEmit` limpio · tablero regenerado · los dos
  mirados en el tablero a 1× y a 6×.
