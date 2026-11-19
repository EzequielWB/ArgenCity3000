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
