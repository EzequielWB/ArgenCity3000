# Radio Barrio

Los vecinos dejan de ser una lista de lotes y pasan a ser **llamados a una radio de barrio**:
un desplegable que cuelga del gabinete del header, sin velo y sin frenar el reloj.

## Specs

- **S1 — El que llama es un barrio, no un lote.** Las casas con el mismo problema que se tocan
  (vecindad de a ocho, así una diagonal de esquina cuenta) son **un solo llamado**. Diez casas
  juntas que reclaman lo mismo llaman una vez. El llamado guarda cuántos vecinos representa.
  > «si hay 10 casas juntas que reclaman lo mismo, solo uno llama asi no son tantas quejas»

- **S2 — Cinco llamados, el peor arriba.** El desplegable muestra hasta `VECINOS.listed` (5)
  llamados ordenados por el enojo del portavoz, de mayor a menor. El resto no se lista ni se
  cuenta aparte: se ve en el número del sticker.
  > «que muestre 5 mas afectados primero y arriba en la interfaz el mas afectado»

- **S3 — El portavoz es el más enojado del grupo**, no el primero del recorrido. Desempata el que
  lleva más meses con el problema y después el índice. Es el que está más cerca de irse, y `Ir`
  lleva a su lote, no al centro del barrio.

- **S4 — La voz tiene personalidad y sube con el enojo.** Cada problema tiene cuatro escalones
  (`aguanta` < 35, `duele` < 60, `reproche` < 85, `se-va` ≥ 85) y dos frases por escalón,
  elegidas por `hash2` del portavoz: dos barrios con el mismo problema y el mismo enojo no dicen
  lo mismo. Los cortes caen donde el juego ya cambia de comportamiento, así la frase y el número
  cuentan la misma historia. Las citas van en bastardilla.
  > «Los mensajes tienen que tener un poco de personalidad y estar en Italics, como una cita.»

- **S5 — Se cuenta en vecinos.** «30 vecinos», «9 vecinos», y **«uno solo»** cuando el llamado
  tiene un único lote. No hay etiquetas de iniciales ni nota al pie que explique el agrupado.
  > «En vez de casa que diga "vecinos" y si, si es uno que diga eso, uno solo. Esas etiquetas de
  > la izquierda estilo "RB", "RM" y asi sacalas, y abajo lo de "Las casas que reclaman lo mismo
  > y estan..." sacalo.»

- **S6 — Es un desplegable, no un modal.** El gabinete va pegado al RCI —lo pidió así— y el
  desplegable cuelga de su borde izquierdo, sin pico. No hay velo, no hay `lockModal`, el reloj sigue corriendo. Se cierra con
  Escape, con un click afuera o tocando la radio otra vez. El primer click afuera **cierra y no
  hace nada más**: si además construyera la herramienta seleccionada, cerrar el panel dejaría una
  obra puesta. Un modal de verdad (feriado, elección) lo cierra.
  > «quedaria mejor si fuese como un menu desplegable que aparece debajo de la radio al tocar y
  > que no queda por encima necesariamente ni frena el juego»

- **S7 — La pantalla del header mide el mensaje.** El ticker usa frases cortas propias (no las del
  desplegable, que no entran en un renglón) y su ancho es el de la frase **más larga de la tanda**,
  para que la barra no baile cada seis segundos. Arranca por el llamado más enojado y rota cada
  6 s; se detiene con el puntero encima o con el desplegable abierto, y se pega a un llamado nuevo
  más grave en cuanto aparece. **Nunca se corta**: si la ventana es angosta y el ancho disponible no
  alcanza para la frase, la pantalla se convierte en una cinta que se desliza de lado, con
  `prefers-reduced-motion` respetado.
  > «que el mensaje del vecino que aparece en la barra de la interfaz ocupe el largo del mensaje,
  > no de mas»

- **S8 — El agradecimiento es una cita, no un sello.** Abajo del último llamado va la frase del
  vecino agradecido, en verde, sin la etiqueta «resuelto».
  > «que el resuelto de abajo solo muestr el mensaje, no el "resuelto"»

- **S9 — Sin reclamos no hay alarma.** El desplegable vacío dice «No llama nadie. El barrio duerme
  tranquilo.» con la regla del sistema debajo («Los que llaman son los que están por irse.»), y el
  sticker del número desaparece: un cartel rojo con un 0 es una alarma encendida sin motivo.

## Tasks

| # | Qué | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | Agrupado por vecindad, portavoz y citas por escalón | S1 S3 S4 S5 | `src/sim/vecinos.ts` | `b407c1e` |
| T2 | El informe devuelve llamados, no quejas | S2 | `src/sim/vecinos.ts`, `src/ui/vecinos.ts` | `b407c1e` |
| T3 | Markup del desplegable de madera | S5 S6 S8 S9 | `src/ui/vecinos.ts`, `src/ui/style.css` | `589aba1` |
| T4 | Radio, pantalla y rotación en el header | S7 | `index.html`, `src/ui/style.css`, `src/ui/radio.ts` | `589aba1` |
| T5 | Abrir/cerrar el desplegable sin frenar el reloj | S6 | `src/ui/radio.ts`, `src/ui/panels.ts`, `src/main.ts` | `589aba1` |

## Log

**L1** — «Bien, es muy grande, deberia ser bastante mas chico y explicito, estilo : "Hola soy Marta,
hace dias que reclamamos por educación", el % de enojo y el botón de IR para ver donde es. Tambien
que se "agrupen", me refiero que si hay 10 casas juntas que reclaman lo mismo, solo uno llama asi no
son tantas quejas. Pero la idea es que sea un menu que funciona de "ayuda visual" rapida para
entender el contexto del problema sin tener que ver los detalles en las otras pestañas.»

**L2** — «En vez de casa que diga "vecinos" y si, si es uno que diga eso, uno solo. Esas etiquetas de
la izquierda estilo "RB", "RM" y asi sacalas, y abajo lo de "Las casas que reclaman lo mismo y estan..."
sacalo. Tambien hacelo visualmente parecido a la estetica de la radio, tonos asi marrones y eso. Los
mensajes tienen que tener un poco de personalidad y estar en Italics, como una cita. Con personalidad
me refiero a que no sea solo un "Hola soy X, hace X que no ..." sinó que haya indignación dependiendo
del enojo, variabilidad en lo que dicen y eso, mas humano como lo habias hecho antes.»

**L3** — «Podes hacer que todo sea un poco mas chico verticalmente hablando? la separación de cada
mensaje quizá mas acotada. Si, que muestre 5 mas afectados primero y arriba en la interfaz el mas
afectado.»

**L4** — «Bien, me gusta pero yo creo que quedaria mejor si fuese como un menu desplegable que aparece
debajo de la radio al tocar y que no queda por encima necesariamente ni frena el juego, me explico?
Tambien que el mensaje del vecino que aparece en la barra de la interfaz ocupe el largo del mensaje,
no de mas.»

**L5** — «Dale, lo que si que esté alineado con el comienzo de la radio, algo así y sin el pico ese que
agregaste a la derecha, solo que se extiende el texto de los vecinos. Tambien que el resuelto de abajo
solo muestr el mensaje, no el "resuelto".»

**L6 — Verificación en vivo** (puppeteer sobre el save de Villa Queja, 1920×1080):

- El panel abierto deja correr el reloj: `tick` 1806 → 1880 en 2,5 s.
- Un clic en el mapa con la herramienta «calle» activa cierra el panel y **no construye nada**:
  la suma de niveles del mundo queda en 70 antes y después.
- `aria-expanded` vuelve a `false`.
- La pantalla rota sola a los 6 s: «—Nos llama Osvaldo…» → «—Nos llama Mónica…».
- Sin nadie enojado: pantalla en «—sin señal—», clase `off`, sticker `hidden`, y el desplegable
  con «No llama nadie. El barrio duerme tranquilo.».
- Abrir el Presupuesto cierra el desplegable.
- 1430 tests verdes, `tsc` limpio.

**L7 — Dos cosas que sólo se vieron mirando.**

La primera: con la pantalla en 503 px la barra se desbordaba. Medido, la barra a 1400 px ya
gastaba 747 en chapas, reloj y RCI, y el menú pide 243: no entraban los tres. A 1920 entra con
aire, así que la pantalla se limita a `min(520px, calc(100vw - 1120px))` y por debajo de 1500 px
desaparece y queda sólo el gabinete con el número. No es un parche: es el mismo criterio que ya
usa `#btnDiario`.

La segunda: tres barrios con luz cortada y 64 %, 63 %, 62 % decían **la misma frase** las tres
veces. Elegir la variante por hash de la celda no alcanza cuando hay tres filas pegadas con el
mismo problema: la variante tiene que rotar por par (problema, escalón). La primera frase del par
la elige el hash del primer barrio; los siguientes alternan desde ahí.

**L8 — Lo que quedó afuera a propósito.** Agrupar por barrio con nombre propio («todo Villa
Florito sin luz») y la carta del vecino que se fue por abandono. El agrupado por vecindad ya
resuelve el conteo; el nombre del barrio sería una capa más de fiction sin efecto en el juego.

**L9 — El gabinete va al lado del RCI.** Con `margin-left: auto` la radio saltaba al extremo derecho
y dejaba un hueco entre el RCI y ella: parecía un botón del sistema, no un aparato de la ciudad.
Ahora el gabinete arranca a 8 px del RCI y el aire queda entre la pantalla y el menú, que ya tiene
su propio `margin-left: auto`. Medido a 1920: RCI termina en 747, la radio arranca en 755, la
pantalla cierra en 1376 y el menú empieza en 1667.

**L10 — La frase se cortaba.** Con el tope de 520 px, «—Nos llama la flia. Giménez: «Hace 8 meses que
no tenemos luz.»» se quedaba en «…no tenemos lu». Ahora el tope es `min(720px, calc(100vw - 1134px))`
—el espacio real entre la pantalla y el menú— y el ancho se calcula con `measureText` más el padding
y el borde. Como red de seguridad, si aun así no entra se desliza: `clientWidth - 24` es el espacio
real (`clientWidth` ya descuenta el borde) y la diferencia se anima con `alternate`. Medido: 1920 la
muestra entera; 1600 la desliza 43 px.
