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
- **S7.** *"la casona y la torre no parecen locales, y estamos hablando de zonas de Comercio, yo diria que
  la casona sea una heladeria grande y la torre sea una cafeteria premium"* — en una zona de comercio un
  local se lee por lo que **atiende en la vereda**, no por su silueta de edificio: la casona pasa a ser
  **heladería** con el toldo a rayas de punta a punta, y la torre pasa a ser **cafetería premium**, de dos
  pisos, con la vidriera de bar abajo y los balcones corridos arriba. El techo a dos aguas y las fajas de
  oficinas se van.
- **S8.** *"La cafeteria no parece una heladeria, hacela un poco mas baja y arriba hacele una taza de café
  o algo asi como para que se entienda. La hleaderia hacela de colores mas llamativos, rosa con verde,
  amarillo con violeta, y asi"* — la cafetería baja de altura y lleva **una taza de café sobre la azotea**
  como remate; la heladería se pinta con **pares de colores que no comparten nada** —rosa con verde,
  amarillo con violeta, celeste con naranja, verde con rosa— en el toldo y paredes pastel.

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
- **L16.** Dos detalles del dibujo aparecieron recién en el zoom de 1,9×, y los dos son de la casona y de
  la torre. Las ventanas de la planta alta de la casona iban corridas con `glazed` y a cuatro píxeles de
  paso: se veían como **una franja de vidrio** pegada al techo, no como ventanas —ahora son tres `pane`
  con su alféizar y la casa ganó cuatro píxeles de alto para que el techo no las toque—. Y el cartel de
  azotea de la torre, de seis píxeles y con una sola franja clara en el medio, parecía un **moño rojo**
  apoyado en la losa: ahora es una caja alta y angosta con dos renglones.
- **L17.** La casona y la torre estaban bien dibujadas y no eran locales. Una casa con techo de chapa y un
  prisma con fajas de vidrio son dos edificios; en una zona de comercio los dos se leen como otra cosa. Lo
  que los vuelve locales es lo de abajo: el toldo, la vidriera de bar y la gente.
- **L18.** **La heladería**: se va el techo a dos aguas, que era justamente lo que la hacía pasar por casa.
  Queda una caja baja y ancha, toda vidriera, con el **toldo a rayas** de punta a punta y el cartel de la
  marca arriba. El toldo es lo más grande del dibujo, y así se lee.
- **L19.** El toldo necesitó tres intentos y cada uno enseñó una regla. El `canopy` del bar, con franjas
  de seis píxeles, se leía como una banda manchada: hizo falta un `toldo()` propio, de rayas de dos. Con
  cinco píxeles de caída el plano medía nueve de alto sobre una fachada de veinte y las rayas parecían
  columnas de mármol: la caída baja a uno más el festón. Y con las rayas del color de la marca, toldo y
  cartel se leían como una sola masa amarilla: el verde del toldo es ahora un color propio, que no sale de
  la marca.
- **L20.** **La cafetería premium**: dos pisos, la planta baja de vidrio oscuro con la carpintería de
  hierro y el reflejo de dos rayas, el cartel con el renglón claro y **los dos balcones corridos** con los
  ventanales altos detrás. Es la más alta y la más angosta de las cuatro, que es lo que un café notable de
  esquina es.
- **L21.** Se fueron dos cosas más, las dos por la misma razón —a 1× no se leen—: la **marquesina volada**
  de la cafetería, que salía de la fachada como un ala suelta, y las **mesas en la vereda**, con sombrilla
  de catorce píxeles y sillas de dos, que eran manchas blancas flotando delante del local. Lo que se lee
  de una vereda con gente, a esta escala, es el toldo, no las sillas.
- **L22.** **El orden de los parches volvió a morder**: el vidrio es la masa de fondo de una fachada y hay
  que pintarlo **último**, porque el primer parche que toca un píxel gana. Pintado primero se comía el
  mostrador, los montantes y los reflejos, y las dos fachadas quedaban un vidrio liso. La heladería y la
  cafetería se dibujaron enteras al revés hasta que se vio.
- **L23.** **Las pruebas siguieron al dibujo**: la punta triangular del techo a dos aguas ya no existe, así
  que la heladería se mide por **las rayas del toldo** —tres tramos verdes en la misma fila, y cero en las
  otras tres fachadas— y la cafetería por ser la más alta y la más angosta, que era el test de la torre y
  sigue siendo cierto con otro edificio. El vidrio de la heladería baja de ocho a seis porque el mostrador
  lo cruza a la altura de la cintura y lo parte en dos.
- **L24.** **La taza de café** es el remate de la cafetería y su nombre. Vista de frente, de once píxeles
  —el ancho del techo— y **con contorno oscuro**: sin línea, la porcelana blanca sobre el techo gris es
  una mancha. Lleva el borde, el café, el asa con el hueco abierto y dos columnas de vapor que nacen en la
  boca. Es lo único de las cuatro fachadas que se sale del volumen hacia arriba.
- **L25.** Las dos primeras versiones de la taza fallaron por lo mismo: la primera era un cuerpo de tres
  filas vistas desde arriba, sin asa y con el vapor flotando dos píxeles más arriba, y se leía como una
  mancha con dos ojos; la segunda tenía el vapor todavía suelto. El vapor tiene que **tocar la boca** o no
  es vapor, y la taza tiene que tener contorno o el techo se la come.
- **L26.** La heladería se pinta en **pares que no comparten nada**: rosa con verde, amarillo con violeta,
  celeste con naranja, verde con rosa. El verde oscuro fijo de antes era correcto y aburrido; una heladería
  de barrio se nombra desde la esquina por el par de colores, y a 1× dos tonos opuestos se leen a veinte
  píxeles. La pared va pastel y saturada para aguantar el toldo, y el cartel toma el color del par que no
  domina, así la fachada tiene tres tonos.
- **L27.** El toldo se pinta **por las dos caras**, la del frente y la del costado: por una sola, el dibujo
  parecía medio toldo y la esquina quedaba desnuda.
- **L28.** **La variante elige dos veces**: el par de colores por el modelo y la pared por el bloque de
  ocho. Con `v % 4` en las dos, la variante 0 y la 4 —las dos heladerías— salían idénticas.
- **L29.** **Las pruebas siguen al dibujo**, otra vez: el verde fijo del toldo ya no existe, así que la
  heladería se mide por los **saltos de tono entre píxeles vivos de una misma fila** —quince con el toldo a
  rayas, seis o menos en cualquier otra fachada— y la cafetería por **los píxeles de porcelana** de la taza
  (treinta y uno, contra diez de la nave y cero de la heladería). La cafetería deja de ser la más alta
  —empata con la galería, y con la taza la pasa— y la nave deja de ser la más ancha: la heladería, que se
  ensanchó para que el toldo luzca, la supera.
- **L30.** *"Mas baja la cafeteria premium, que sea un solo piso y aprovechá ese espacio para hacer una taza
  mejor, un estilo como el de la imagen"* — la cafetería baja de 26 a **15 píxeles**: planta baja con la
  vidriera de bar, la puerta de madera, el cartel y la losa. Los dos pisos altos y los balcones se van
  enteros, y todo el volumen que se le sacó al edificio se fue a la taza.
- **L31.** **La taza de porcelana**, dibujada como la de la foto: el plato, el cono del cuerpo, la boca en
  elipse con el café adentro y el asa redonda. Cuatro correcciones hasta que se leyó:
  - Con una sola franja de café la boca era una raya: ahora son **tres filas** de marrón, con el cobre del
    reflejo, entre los dos bordes de la porcelana.
  - El cono tenía dos filas visibles entre el plato y la boca: la taza se veía sentada sobre su propia
    boca. Ahora son cinco.
  - El asa, de dos píxeles de grosor y separada del cuerpo, parecía una **C de neón colgada al costado**;
    ahora es un anillo angosto que **nace del borde del cuerpo**, de la fila de la boca para abajo.
  - Y el asa, dos filas más arriba, flotaba en una fila donde no había taza.
- **L32.** *"no me gusta como quedó, no hagas el plato, solo la taza y sin el cafe dentro, vas encaminado
  pero le falta todavía"* — la taza queda **sin plato y con la boca vacía**: lo que la nombra es la
  silueta, no lo que tiene adentro, y el plato le comía cuatro filas abajo y la dejaba pegada al techo.
  Se va también el café: la boca es una elipse de porcelana con el hueco adentro y el borde delantero, que
  es lo que hace que se lea abierta y no una tapa.
- **L33.** Y el cuerpo se estiró: **diez filas de cono esbelto, de seis píxeles abajo a once arriba**. Con
  ocho filas y doce de ancho parecía un bowl; la taza de porcelana es más alta que ancha, y esa es la
  diferencia entre una taza y un cuenco. El asa creció a seis filas con el hueco abierto.
- **L34.** La prueba de la taza pasa a la **porcelana** —setenta y ocho píxeles contra uno de la galería—
  porque el marrón del café ya no existe. Es el cambio de qué significa "correcto" otra vez: la taza sigue
  siendo el remate de la cafetería, y ahora se mide por su propio material y no por el contenido.
- **L35.** *"sacale la taza y poné un cartel que diga 'Café' que esté en el techo, angulado para que respete
  el frente del local, y de última hacé el local un poco más 'corto' y que tenga unas mesitas afuera con
  sillas en la entrada"* — la taza se va entera y en su lugar va **el cartel con la palabra**, parado sobre
  el techo y paralelo al frente. El local se hace **más corto de fondo** —de 0.06 a 0.56 del lote— y el
  lugar que deja libre se llena con una **vereda de hormigón y tres mesas con sus sillas**.
- **L36.** Las letras se escriben a mano en **glifos de 3×5** (C, A, F, E) y se pasan como patches de la
  cara del cartel, no como píxeles de pantalla: así el escorzo lo hace el mismo motor que dibuja la pared y
  el cartel queda **en el plano del frente** en vez de flotar torcido sobre la isométrica. El cartel es más
  ancho que el local —quince píxeles de texto— porque con el ancho de la fachada las letras no llegan a
  tres píxeles y no se leen. Con siete de alto y todo el frente se comía el techo; cinco alcanzan.
- **L37.** Las mesas necesitaron las sillas **de madera clara** y el mantel oscuro: sobre el hormigón de la
  vereda, con todo oscuro, la mesa y las sillas se leían como una mancha de escombros. Y la vereda hizo
  falta: plantadas sobre el pasto, las mesas no eran mesas.
