# El nivel 5 del comercio: cuatro modelos

## Header

El comercio tiene un edificio por nivel y eso funciona: kiosco, verdulería, peluquería, bar y casa de
ropa son cinco cosas distintas. El problema está en el último: **la casa de ropa es un solo modelo con
ocho colores**, y con una avenida entera de comercios de nivel 5 se lee como la misma caja repetida. El
residencial ya tuvo el mismo problema y se resolvió con cuatro modelos (`vivienda-variada-pixel.md`);
acá se hace lo mismo, con un lenguaje que es de comercio y no de vivienda.

## Specs

- **S1.** *"Si dale, el mismo tratamiento"* — el pedido, sobre la pregunta de si al nivel 5 del comercio se
  le da el mismo tratamiento que al del residencial: **cuatro modelos**, elegidos por la variante, con la
  paleta saliendo también de la variante.
- **S2.** Un local de nivel 5 no es una torre de oficinas: es **una casa de ropa de avenida**. Los cuatro
  modelos se distinguen por la **silueta** y no por una fachada de vidrio más o menos alta: el techo a dos
  aguas de la casona, las columnas de la galería, la torre de fajas con el cartel de azotea y la nave baja
  con el cartel en un mástil.
- **S3.** La interfaz no cambia: `paintCommercial(level, variant)` sigue recibiendo los cinco niveles y
  las ocho variantes, y `HEIGHT.commercial[5] = 62` sigue siendo el techo del sprite.
- **S4.** La variante 0 a 3 son los cuatro modelos; de la 4 a la 7 se repiten con otra pared y otro color
  de cartel. La simulación no se toca.
- **S5.** Se escribe una prueba de estructura por modelo, con lo que lo distingue dibujado y no "hay
  tinta": la punta triangular del techo, la arcada en sombra, las fajas apiladas de la torre y el cartel
  sobre el mástil.
- **S6.** *"Bien, hace que vidriera, galeria y ventanal sea distinto, deja solo el galeria y hacer que los
  otros dos sean distintos"* — de los tres primeros, que eran la misma caja con vidrio abajo, **se queda
  la galería**; la vidriera y el ventanal se rehacen con siluetas que no se parezcan a ella ni entre sí.

## Tasks

- **T1.** Cuatro modelos para el nivel 5 del comercio, despachados por variante, dentro de
  `HEIGHT.commercial[5]`. Commit `—`: `storeWindow`, `storeArcade`, `storeAtrium` y `storeShed`, con el
  despacho en `clothingStore()` por `v & 3` y la pared y el cartel por `v`.
- **T2.** `tests/comercio-variado.test.ts`: cuatro siluetas distintas y una prueba por modelo (6 pruebas).
  Commit `—`.
- **T3.** Tablero regenerado y mirado a 1× y a 3×, modelo por modelo, con el tablero mostrando las ocho
  variantes del nivel. Commit `—`.

## Log

- **L1.** *"Si dale, el mismo tratamiento"* — el pedido original, verbatim.
- **L2.** Los cuatro, por lo que los distingue desde la vereda:
  1. **Vidriera de piso a techo** (`storeWindow`): dos plantas, la planta baja entera de vidrio con los
     maniquíes, la banda del cartel encima y arriba las ventanas de la planta alta. El local clásico.
  2. **Galería con arcada** (`storeArcade`): la planta baja se mete y queda un pórtico de columnas sobre la
     vereda, con los locales en sombra adentro. Tres plantas arriba. La silueta es la de un hueco abajo.
  3. **Ventanal en doble altura** (`storeAtrium`): el frente con un vidrio de dos plantas en un extremo,
     enmarcado en hormigón, y el resto muro con ventanas. El local moderno de esquina.
  4. **Nave baja con cartel parante** (`storeShed`): una sola planta alta y ancha, con el **cartel vertical
     sobre el techo**, que es lo que se ve desde la otra cuadra. La silueta baja, la única de las cuatro.
- **L3.** Las alturas quedaron 41, 45, 47 y 37 píxeles de sprite, y el ancho 28, 30, 29 y 31: el nivel 5
  del comercio sigue siendo el más alto de la zona sin que ninguno de los cuatro supere
  `HEIGHT.commercial[5] = 62`.
- **L4.** **El orden de los parches.** En el ventanal de dos plantas pinté primero el marco de hormigón como
  un bloque y el vidrio después: el marco ganó —el primer parche que toca un píxel gana— y el ventanal
  quedó en un rectángulo gris de veinte píxeles de alto. El marco ahora son cuatro bandas que no se pisan
  entre sí ni pisan el vidrio. La misma trampa en la galería: la sombra del fondo pintada antes se comía
  las vidrieras de los locales.
- **L5.** **La sombra de la galería va en gris, no en el marrón del interior.** Con `INSIDE`, los tres
  huecos entre los pilares se leían como puertas de madera y la arcada como una hilera de locales
  cerrados; en gris se leen como pórtico.
- **L6.** **La nave al revés de como la pensé.** El depósito más alto que el frente se comía el dibujo, y
  el playón de estacionamiento atrás no se veía: la nave lo tapaba entero. Queda al revés: el depósito
  tres píxeles más alto que la nave para que la silueta escalone hacia el fondo, y el playón **al costado
  y sobre la calle**, con los dos autos. El toldo del modelo 0 también se fue: sobre la banda se leía como
  un dentado amarillo pegado en el medio de la fachada, y el cartel ya nombra el local.
- **L7.** **La prueba de la arcada, después de dos intentos fallidos.** Contar tramos de píxeles claros en
  una fila no distingue nada: la vidriera del modelo 0 tiene el reflejo y los maniquíes y da tres tramos
  claros igual que la arcada. Y medir columnas claras en una franja "de la planta baja" contaba el pasto
  del lote abajo y la losa del techo arriba, según la altura del modelo. Lo que sí distingue: **la tirada
  vertical de sombra**. La galería tiene un hueco de diez píxeles seguidos por debajo de 80 de luminancia;
  el local común no pasa de dos.
- **L8.** Los cuatro, para la prueba: vidriera de 8 píxeles de alto, hueco de galería de 10, ventanal de 18
  (contra 8 del común) y nave con una punta 10 píxeles arriba del cuerpo (el cartel) y las otras tres
  parejas, más baja y más ancha que las demás.
- **L9.** Evidencia: **1209 / 78** verdes · `tsc --noEmit` limpio · `npm run arte` regenerado · los cuatro
  mirados a 3× y en la fila del tablero.
- **L10.** Los tres primeros eran la misma caja: dos o tres plantas, vidrio abajo, banda de color y
  ventanas arriba. A 728 píxeles en el tablero se veían como el mismo local con tres carteles distintos, y
  el único rasgo propio de la galería —las columnas— quedaba tapado por el parecido de los otros dos. La
  vidriera y el ventanal se rehacen; la galería y la nave se quedan.
- **L11.** **La casona** (reemplaza a la vidriera): dos plantas, la baja de vidrio, la banda, las ventanas
  de la casa con su alféizar y **un techo a dos aguas de chapa**. La silueta termina en un triángulo, que
  es lo único de la zona que no es una losa ni una caja. La casa de avenida reciclada en local es un tipo
  real de Buenos Aires y es lo contrario del prisma moderno.
- **L12.** **La torre** (reemplaza al ventanal): cuatro plantas, angosta, con las fajas de vidrio apiladas
  y **la caja del cartel sobre la azotea**. Es la única que crece en vez de extenderse, y la única cuyo
  remate es una caja de color y no una losa.
- **L13.** El cartel del techo de la casona se fue dos veces: pintado en el faldón era un rectángulo
  amarillo flotando sobre la teja, y colgando del alero, una franja de color atravesada. A 1× un cartel
  sobre un techo inclinado no se lee como cartel: se lee como un error de pintura. La banda de la pared
  ya nombra el local y el techo es el rasgo del modelo.
- **L14.** **Las pruebas cambiaron con el dibujo**, y eso cambia qué significa "correcto": el ventanal de
  18 píxeles ya no existe, así que la prueba del modelo 2 pasó a medir **las fajas apiladas** (cuatro
  tiradas de vidrio en la misma columna) y la altura, y la del modelo 0 pasó a medir **la punta
  triangular** (la fila más alta mide un píxel y cinco filas abajo el techo mide más de diez). La de la
  nave dejó de exigir "la más baja de las cuatro" —la casona mide 36 y la nave 37, y eso está bien porque
  las dos son bajas— y pasa a exigir que sea la más ancha y que la punta sea un rectángulo de ancho
  parejo, que es el paño del cartel y no una punta.
- **L15.** Medidas finales, de arriba abajo del sprite: casona 36 de alto y 28 de ancho, galería 45 y 30,
  torre 55 y 26, nave 37 y 31.
