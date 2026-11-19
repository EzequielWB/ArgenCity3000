# Tres únicos más en píxel: Estadio, Cabildo y Planetario

Los tres que siguen después del Obelisco, el Calvario, el Puente y el Teatro. Los tres viven todavía
en canvas (`estadioArt`, `cabildoArt`, `planetarioArt` en `src/render/sprites.ts`); la migración es
la misma de siempre: pintarlos a 1× en `pixelArt.ts`, rutearlos en `uniqueSprite`, borrar el pintor
de canvas y probarlos por estructura.

El orden no es casual: el Estadio es el único de 4×4 de todo el juego, y si la escala de un lote de
cuatro falla conviene saberlo antes de dibujar los otros dos.

## Specs

- **S1.** Píxel duro a 1×, pintado en un buffer, sin antialias. La única transparencia parcial
  permitida es la sombra (alfa ≤ 96). Nada de arte de SimCity: sólo el género.
- **S2.** La identidad es argentina y sale de la silueta, no del cartel: el estadio es una **tribuna
  vertical sobre una calle**; el cabildo es una **torre con reloj sobre un portal de arcos**; el
  planetario es **una bola sobre un tambor**, el único edificio del juego que no es una caja.
- **S3. Estadio (4×4).** La cancha en el medio, con sus líneas, y las tribunas alrededor. **La
  tribuna de atrás es alta y las de adelante son bajas**: es lo que deja ver el juego desde esta
  cámara. Con las cuatro iguales el estadio es una caja con un pozo adentro. Cuatro torres de luz en
  las esquinas —las de adelante no, que tapan la cancha— y la gente como moteado en los escalones,
  no como una textura uniforme.
- **S4. Cabildo (3×2).** Dos plantas: **planta baja de arcos** y planta alta de ventanas con
  balcón corrido, techo de tejas a cuatro aguas y **la torre en el medio del frente**, con el reloj,
  la balaustrada, su propio techo y la bandera. La torre tiene que sobresalir del techo, no quedar
  escondida en él.
- **S5. Planetario (3×3).** Tambor blanco, **bola** arriba —ancha y alta a la vez, y su fila más
  ancha en el medio, que es lo que distingue una bola de una cúpula— con la **galería oscura en el
  ecuador** y la linterna en la punta. El parque alrededor, con sus árboles y el camino.
- **S6.** El edificio es la unidad y la celda el dato: cada uno se pinta una vez en el lote que ve la
  cámara, anclado en la esquina de arriba.
- **S7.** Verificación: `npx vitest run` verde, `tsc --noEmit` limpio, `npm run board` y una captura
  del tablero antes de dar nada por bueno. Cada uno con su prueba **estructural**: no "hay tinta".
- **S8.** La simulación no se toca: costos, mantenimiento, lotes y efectos quedan como están.

## Tasks

- **T1 · Estadio en píxel** — `pixelArt.ts`: `paintEstadioOn/paintEstadio/estadioPixelSprite` +
  `estadioCache`; ruteo en `uniqueSprite`; `estadioArt` borrado. Lote 4×4. ✅
- **T2 · Cabildo en píxel** — ídem con `paintCabildo`; `cabildoArt` borrado. Lote 3×2. ✅
- **T3 · Planetario en píxel** — ídem con `paintPlanetario`; `planetarioArt` borrado. Lote 3×3. ✅
- **T4 · Pruebas** — ✅ `tests/estadio-pixel.test.ts`, `tests/cabildo-pixel.test.ts`,
  `tests/planetario-pixel.test.ts`, las tres por estructura.
- **T5 · Tablero y evidencia** — ✅ `npm run board`, captura, y el tablero en el documento.

## Log

- **L1.** Pedido, textual: *"Seguí con 3 mas"*, sobre la lista que quedaba: Estadio 4×4, Cabildo 3×2,
  Regimiento 4×3, Planetario 3×3, Santuario 3×4, Sindicato 3×2. Se toman los tres primeros del orden
  propuesto: Estadio, Cabildo y Planetario.
- **L2. Estadio.** Cuatro tribunas: las de atrás de 25 y las de adelante de 12. Las gradas salen de
  `px.wall` con un painter propio —contrahuella en sombra, asiento en luz y la gente moteada encima—,
  no de parches planos. La pasarela de arriba va **rayada como las gradas vistas desde arriba**: pintada
  de un gris parejo el estadio entero se leía como una plataforma de cemento con un pozo.
- **L3.** Dos errores de dibujo que costaron vueltas: la tribuna de adelante tenía su muro en la cara
  de **adentro**, así que la pasarela quedaba colgando y abajo se veía el contrapiso como un playón de
  más (la cara visible de un cuerpo es siempre la del borde del lote); y el gris de las pasarelas
  competía con el dorado de las tribunas por el mismo plano.
- **L4. Cabildo.** Dos cosas: la cal con los **tres tonos elegidos a mano** —el 0,69 automático deja un
  crema grisáceo y el Cabildo es blanco— y la planta baja con una banda de cal viva **detrás** de los
  arcos, que es lo que les da el contraste. Y un bug de la propia API: `tone(shade(ramp[1], f))` vuelve
  a aplicar el 0,69 y el 0,59, así que la torre salía gris oscura; hay que pasar la rampa tal cual.
- **L5.** El reloj va **arriba de todo** y con las esquinas en cal: un cuadrado blanco no es un reloj,
  y puesto más abajo queda contra la teja y la torre parece un cuerpo sin cara.
- **L6. Planetario.** Un cilindro escrito a mano —cuerpo columna por columna y la cara de arriba como
  elipse—, la cúpula como **media naranja** (sólo la mitad de arriba de la bola: entera se come el
  tambor), la galería como anillo y **los meridianos de la cúpula y los nervios del tambor**. Sin los
  meridianos la cúpula es un huevo apoyado; sin los nervios, el tambor es un balde blanco.
- **L7.** Los árboles del parque van **antes** del edificio: pintados después, la copa del que está
  detrás se le sube encima de la cúpula y parece un árbol plantado en el tambor.
- **L8.** Tres pruebas que mentían, anotadas porque van a volver: la parrilla de luz tenía un umbral de
  color tan flojo que el filo iluminado de cada grada entraba en la cuenta (y una fila de 40 píxeles
  daba seis "torres", porque además agrupaba por columna y dos torres de la misma esquina caen en la
  misma columna); la "teja más alta" del Cabildo era la del **capitel de la torre**, no la del cuerpo; y
  la copa del árbol es casi el mismo verde que el pasto, así que a los árboles hay que contarlos por el
  tronco.
- **L9.** Evidencia: `npx vitest run` **1177 / 73 archivos** verdes · `tsc --noEmit` limpio ·
  `npm run board` (42 kB de sprites) · el tablero con los tres.
- **L10. El estadio vuelve a la forma de antes.** Pedido: *"el estadio dejalo como estaba antes pero dale
  una apariencia mas pixel"*. La versión de canvas no era una caja: era una **herradura abierta hacia la
  cámara**, con las gradas por el fondo y por la izquierda y el frente cerrado por un muro bajo con la
  banda del club. Se restauró esa planta y se pintó con `Pen.box` —caras con el volumen de siempre, el
  filo de arriba al sol— más lo que el canvas no tenía: la gente como motas de cuatro colores sobre el
  asiento, los mástiles de dos píxeles y las hiladas de teja de la tribuna.
- **L11.** Tres correcciones de esa vuelta, todas de legibilidad a 1×: la banda azul **cortada a motas**
  parecía un error de pintura y va sólida con el filo en luz; los palcos del frente en gris oscuro
  **no eran ventanas, eran un agujero** —a siete píxeles de alto, tres de negro puro no dicen nada— y
  pasaron a vidrio con la fila de arriba iluminada; y la puerta con `INSIDE` puro era una mancha, así que
  es un hueco en sombra suave con el dintel claro.
- **L12. El cabildo: no era una torre, era un cuerpo apoyado en el techo.** Tenía doce píxeles de ancho y
  trece de alto sobre la cumbrera: un muñón. Ahora el fuste va angosto (`tw 0.28`) y largo (`tH = H + 30`),
  y el reloj vive en un **cuerpo propio más ancho** que lo corona: ese corrimiento es lo único que hace
  que una torre se lea como torre. El techo bajó a tres píxeles y apareció la **balaustrada corrida** —
  el Cabildo no se reconoce por el techo, se reconoce por la balaustrada y por la torre.
- **L13.** El remate de la torre fue al revés de lo que parecía: un `cornice` deja **la losa gris a la
  vista** y en la punta se arma un patio de cemento que se lee como un bloque; el casquete de tejas la
  cierra. `CABILDO_MAX_Z` pasó de 44 a 64 porque el fuste nuevo no entraba.
- **L14. El planetario: era un tarro con tapa.** Tres cosas, en orden de importancia: la cúpula iba como
  **media naranja** (media esfera vista desde esta cámara es una bola pesada) y pasó a un casquete chato,
  más ancho que alto; el tambor pasó a ser **más alto y más ancho** para tener cuerpo propio; y la
  galería dejó de ser un collar oscuro y grueso —**el filo en piedra clara, el resto en hierro, dos
  filas**—. El zócalo tiene que seguir **el arco de abajo columna por columna**: pintado en la fila del
  centro corta el tambor a media altura y el edificio se lee como una copa de vino.
- **L15.** La entrada del planetario: un pórtico de caja aparte se lee como **otro edificio pegado
  abajo**, así que la puerta y sus tres gradas van pintadas sobre el tambor. Y el cornisamento de un
  píxel sobre la elipse del tambor queda **en guiones** —una línea de puntos no es una moldura—: se sacó.
- **L16.** Pruebas tocadas en esta vuelta: las torres de luz del estadio son **tres** y no cuatro (la
  cuarta esquina es la abierta de la herradura y su mástil cruzaría la cancha), y el piso del parque del
  planetario bajó de 1200 a 1000 píxeles porque el tambor creció. Las dos son consecuencias del dibujo,
  no permisos: si el dibujo cambia otra vez, la prueba tiene que volver a mirarlo.
- **L17.** Evidencia: **1177 / 73** verdes · `tsc --noEmit` limpio · tablero regenerado · los tres
  revisados en pantalla.
- **L18. El Cabildo: la torre estaba pegada adelante, y eran tres causas distintas.** Se probaron y
  descartaron tres arreglos antes de dar con el bueno: (1) proyectarla más, que la afirmaba como losa;
  (2) una **línea de sombra en la unión**, que es peor —a 1× ese filo oscuro se lee como el aire entre un
  recorte y la pared—; (3) un pabellón ancho con la torrecita arriba, que da una lámpara sobre una
  mesa. Lo que funciona es **una sola masa**: la torre *es la crujía del medio* del Cabildo, a ras de la
  pared, del ancho de dos arcos, con las mismas bandas que el cuerpo —arquería, balcón, ventanas con
  reja, cornisamento— y un hueco de campaña arriba del techo. Sin losa de cornisamiento propio.
- **L19.** El cornisamiento del pabellón iba con la losa de piedra clara a la vista. En medio del techo
  rojo se leía **una chapa apoyada**, y encima la torre parecía plantada sobre una placa. Cuando hace
  falta, la tapa va en teja.
- **L20. El Planetario es un anillo de vidrio con un casquete**, no un tambor macizo: la estructura
  circular de vidrio es lo que lo identifica. Quedó así: basamento de piedra bajo y más ancho, **el
  anillo de vidrio azul con los parantes en hierro claro**, la galería oscura, el casquete de chapa con
  sus meridianos y la linterna. Los parantes van uno cada cuatro píxeles: son la estructura.
- **L21.** El vidrio no lleva zócalo propio —se asienta sobre el de piedra, que ya tiene el suyo— y ese
  detalle tenía además una consecuencia en las pruebas: el filo oscuro del vidrio entraba en el predicado
  de la galería y la galería "estaba" veintiún píxeles más abajo de donde está.
- **L22.** `tests/planetario-pixel.test.ts` reescrito (7 pruebas): la cúpula sigue siendo una cúpula, y
  ahora se prueba además que **el vidrio esté entre el basamento y la cúpula**, que los parantes sean
  varios y verticales (contando *columnas* con hierro claro, no píxeles) y que la cúpula esté centrada
  sobre el anillo.
- **L23.** Evidencia: **1178 / 73** verdes · `tsc --noEmit` limpio · tablero regenerado · los tres
  revisados en pantalla.
- **L24. El Planetario, con las fotos delante.** Las tres fotos del Galileo Galilei dicen lo que la
  descripción no decía: la cúpula es **oscura**, de chapa perforada y **casi una esfera**; abajo hay un
  **plato de vidrio que vuela más ancho que el cuerpo**, con la carpintería a la vista y un filo de cal;
  entre los dos, una terraza; y el plato no apoya en un muro sino en **cuatro tensores de hormigón** que
  entran desde el parque. Lo anterior era un tambor de vidrio con una tapa clara: la estructura era
  correcta y el edificio no.
- **L25.** Cuatro cosas que se arreglaron mirando la pantalla y no el código: el filo de cal del plato
  iba en los dos bordes y el plato quedaba **una cáscara de huevo** (el canto de abajo va en el vidrio
  oscuro); la terraza iba en cal y **se comía la franja de vidrio** (va en gris medio, es un piso a la
  sombra); las patas de un píxel **se leían como cables** (van de cuatro); y las dos cajas blancas al pie
  del domo **le daban cara** —dos ojos— así que quedó sólo el mástil de la antena.
- **L26.** La malla de la cúpula se pinta en damero con dos tonos del mismo plomo (0,9 de diferencia):
  así se lee la chapa perforada. El damero tiene que ser suave —a 0,84 la cúpula parecía tejida a
  crochet— y la prueba lo pide por lo que es: **dos tonos mezclados**, no un relleno liso, que ocuparía
  la misma área y pasaría un conteo de píxeles igual.
- **L27.** `tests/planetario-pixel.test.ts` reescrito otra vez (7 pruebas), ahora sobre la estructura
  nueva: la cúpula es oscura y redonda con la fila más ancha abajo, la cúpula está perforada (dos tonos),
  el plato vuela más ancho que la cúpula y tiene carpintería, **las patas llegan al suelo de los dos
  lados** —se cuentan de un lado y del otro, que es lo que lo hace un apoyo y no una pata sola—, y la
  cúpula está centrada sobre el plato.
- **L28.** Evidencia: **1178 / 73** verdes · `tsc --noEmit` limpio · tablero regenerado · el planetario
  comparado con las fotos.
- **L29. El domo parecía "plano, tirado".** Y lo era por dos cosas: media bola de alto sobre treinta y
  dos de ancho —una tapa— y, sobre todo, **la base recta**. Una esfera apoyada en un plano no termina en
  una fila de píxeles: termina en un **arco de apoyo que baja en el medio**. Con `domeRy 17` y un labio
  de 4 píxeles que sigue la elipse del plato, el domo pasa a tener panza y volumen. Y la prueba se
  corrigió en el mismo sentido: ahora pide que la parte más ancha esté **en el tercio de abajo** (no "a
  menos de seis píxeles del borde"), que es lo que distingue un domo de un huevo.
