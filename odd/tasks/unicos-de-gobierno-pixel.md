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
- **T2.** Santuario 3×4: pendiente.
- **T3.** Sindicato 3×2: pendiente.

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
