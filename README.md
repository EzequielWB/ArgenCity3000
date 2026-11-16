# ArgenCity 3000

City-builder isométrico para navegador con identidad argentina: fundás una ciudad, trazás calles, llevás la luz, zonificás barrios y la ves crecer mientras El Diario del Conurbano cuenta lo que pasa. Las mecánicas son las del género (zonas, demanda, energía, presupuesto), y el arte, la interfaz y los textos son propios: todo el arte se genera por código.

## Cómo jugarlo

```bash
npm install
npm run dev        # http://localhost:5273
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Tests de la lógica (Vitest) |
| `npm run build` | Typecheck y build de producción en `dist/` (se abre con cualquier servidor estático) |
| `npm run probe` | Simula 15 años de una ciudad sin navegador e imprime el balance año por año |
| `npm run bake-maps` | Vuelve a preparar los mapas reales (`public/maps/`); necesita internet. `npm run bake-maps -- mar-del-plata` prepara uno solo |

### Primeros pasos

La partida nueva arranca **en pausa** y con la ventana de fundación abierta: ahí ponés el **nombre de tu partido** (obligatorio) y elegís la **forma de gobierno** (democracia, dictadura, tecnocracia, teocracia o comunismo), cada una con sus pros y sus contras. El tiempo, la plata y el diario se ponen en marcha con tu primera obra, así mirás el mapa sin que te corra el reloj.

1. **Usina** (tecla `9`): sin luz no crece nada.
2. **Calles** (`3`): se trazan arrastrando. Los lotes necesitan una calle a 3 lotes o menos.
3. **Zonas** residencial (`5`), comercial (`6`) e industrial (`7`): todo tiene que tocar la red, porque la luz viaja por calles, zonas y tendido eléctrico (`4`).
4. Mirá la **demanda R C I** arriba y la **caja**. Con la caja en rojo no se construye.
5. Las **plazas** (`8`), el agua y los árboles suben el valor del suelo, y eso permite edificios más altos. La industria contamina.
6. **Servicios públicos** (necesitan luz y cubren un radio): sin **salita** (`U`) las casas no pasan de chalet y sin **escuela** (`Y`) no hay torres ni oficinas. La **comisaría** (`I`) baja el delito y los **bomberos** (`O`) apagan incendios.

En el juego, `H` abre la ayuda completa con todos los controles.

## Qué tiene

- Mapas reales preparados de antemano: Mar del Plata, Buenos Aires, Rosario, Córdoba, Mendoza, Bariloche, Ushuaia, Tandil y Las Flores. Relieve, costa, agua y arboledas reales, con o sin las calles reales ya trazadas. Se preparan con `npm run bake-maps` a partir de OpenStreetMap y de datos abiertos de elevación, y quedan en `public/maps/`. Para sumar una ciudad se agrega a `CITIES` en `scripts/bake-maps.ts` y a `PRESETS` en `src/world/presets.ts`.
- Mapas inventados a partir de una semilla, de cuatro tipos (`src/world/mapkinds.ts`): **Con salida al mar** (lomas suaves, la costa de un río ancho al este y un arroyo), **Llanura** (casi llano, con arroyo y laguna); todos los tipos menos el primero abren además una **bahía de mar** en un costado (más chica que la del primero, en un lado distinto según la semilla) para que siempre se pueda usar la parte marítima, **Con gran relieve** (cerros y valles por todo el mapa) y **Sierras** (cordones de montañas con valles anchos para construir), todos con arboledas de jacarandás, palos borrachos, ombúes y eucaliptos.
- Tamaños: Chico (128×128), Mediano (192) y Grande (256) están definidos en `src/config.ts`, y los generadores, los guardados y la simulación ya los manejan. `PLAYABLE_SIZES` lista los habilitados y hoy es solo Chico: el mapa se dibuja en un único lienzo y, medido en Chrome sin GPU, redibujarlo entero tarda unos 0,6 s a 128, 1,4 s a 192 y 2,5 s a 256. Habilitar los otros requiere dibujar el mapa en pedazos. En celulares y Safari, que limitan un lienzo a unos 16,7 millones de píxeles, los tamaños grandes tampoco entrarían.
- Cámara isométrica con 4 rotaciones, zoom de 0,25× a 3×, minimapa y picking que respeta el relieve.
- Herramientas: consulta, topadora, calles (con puentes), tendido eléctrico, zonas R/C/I, plazas, usinas, escuelas, salitas, comisarías y cuarteles de bomberos, con costo visible antes de soltar el mouse, deshacer (`Ctrl+Z`): devuelve todo lo pagado dentro del mes de la obra y la mitad hasta un año después.
- Simulación: red eléctrica con capacidad y apagones, acceso a calles, contaminación, valor del suelo, demanda R/C/I, crecimiento en 4 niveles por zona, una tasa por zona (cada una mueve la demanda de su zona), presupuesto por servicio (financiar al X % cuesta y cubre el X %) y presupuesto mensual. En los mapas reales, las calles que trae el mapa solo se cobran cuando hay edificios a su alcance.
- Transportes: la categoría tiene, por ahora, la línea de colectivos (tecla Ñ, desde la categoría Ciudad). Se puede poner en cualquier lote de tierra y funciona con una calle a 3 lotes o menos; al colocarla sale una ventana para elegir uno de 10 colores y un número de hasta 3 dígitos que no se puede repetir. Alivia un 35 % del tránsito de las calles de su área (9 lotes), con tope del 60 % entre varias líneas, cuesta mantenimiento mensual y sus colectivos se ven en la calle. El presupuesto tiene un control de Transporte (0 a 120 %) que fija la frecuencia: al 50 % andan la mitad de los colectivos, cada línea alivia la mitad y cuesta la mitad. Con el transporte o las escuelas por debajo del 80 % pueden salir el paro de choferes o el paro docente. La categoría suma también el aeropuerto y el puerto de paseos, comerciales: se arman por piezas (el aeropuerto de 3×2 y el puerto de 2×2), y las piezas pegadas forman una sola instalación cuyo nivel sube con la cantidad (hangar, aeródromo e internacional; muelle, puerto y puerto con cruceros). Dan empleos comerciales e ingresos, pero consumen electricidad (más cuanto más grandes) y sin luz no funcionan; el aeropuerto hace ruido y se ven aviones despegando y barcos paseando (`src/render/vessels.ts`).
- Tiempo y plata: el tiempo corre por semanas (4 por mes; una semana dura 1,5 s en velocidad Normal) y la plata se cobra y se paga cada semana. El diario, los incendios, el gráfico y el autoguardado siguen siendo mensuales. Al lado de la Caja se ve el saldo estimado del mes y, si la caja no va a durar un año, cuántos meses alcanza (ámbar con menos de 12, rojo con menos de 6). Los servicios públicos pagan una parte fija (`FIXED_SHARE`, 25 %) y el resto según cuántos vecinos atienden. `npx vite-node scripts/early-probe.ts` reproduce una primera ciudad con los cuatro servicios desde el principio.
- **Modo roguelike**, elegido en la pantalla de inicio: la ciudad se juega igual, pero la meta es llegar a **1.000.000 de habitantes**. Cada cierta marca (de 500 a 700.000) el tiempo se pausa y hay que elegir **1 de 3 mejoras**: unas solo ayudan, otras dan y sacan ya, y las semillas cuestan años y después pagan con creces. Las mejoras mueven diez perillas (`RunMods`, `src/sim/roguelike.ts`) que leen los sistemas que ya existen: densidad por vivienda, empleos, administración municipal y su término cuadrático, valor del suelo, potencia, crecimiento, migración, ingresos y costo de los servicios. La run se pierde perdiendo la elección o pasando **24 meses seguidos con la caja en rojo**, y no se sigue: solo volver al menú o reiniciar el mismo mapa. Con el balance clásico 1M no se paga (la administración crece con el cuadrado de la población); con las cuatro reformas administrativas del pool, cierra. Documento: `odd/tasks/modo-roguelike.md`.
- Formas de gobierno, elegidas al entrar a la partida: **democracia** (elecciones cada 4 años y hace falta el 50 %), **dictadura** (sin elecciones, pero atrae un 20 % menos de gente, la Provincia no gira subsidios y la aprobación no pasa de 60) y **tecnocracia** (vota cada 6 años con el 40 %, pero la aprobación se mueve la mitad de rápido y llega un 5 % menos de gente), **teocracia** (sin elecciones; la placa de arriba pasa a ser la **aprobación divina**, un favor de 0 a 100 que sube con las plazas, la caridad y la caja sana y baja con el humo, el delito, las demoliciones, la usura y los abandonos: por debajo de 35 caen catástrofes —rayos con incendios, plagas que vacían edificios, sequías y revueltas— y por encima de 75 llegan milagros; los vecinos no pasan de 80) y **comunismo** (servicios un 30 % más baratos, fábricas que pagan un 25 % más y comercios la mitad, un **plan quinquenal** de puestos industriales con premio o castigo, congreso del Partido cada 5 años con el 40 % y un 25 % menos de gente). La lógica está en `src/sim/favor.ts` y `src/sim/plan.ts`. Los números viven en `GOVERNMENTS` (`src/config.ts`) y el documento en `odd/tasks/formas-de-gobierno.md`.
- El Diario del Conurbano publica la fundación y recién sale a la calle, con una noticia de apertura, cuando hay al menos dos viviendas, dos comercios y dos fábricas construidas. Hasta entonces los avisos de plata están solo en la barra superior.
- Créditos municipales: cuando la caja se queda sin resto, en el Presupuesto se puede pedir un crédito. Hay tres (`LOANS`, `src/config.ts`): $ 10.000 en 24 cuotas, $ 25.000 en 36 y $ 50.000 en 48, cada uno con el total a devolver a la vista antes de aceptar. La cuota entra como **una línea más del presupuesto mensual** (`src/sim/loans.ts`), así que baja el saldo del mes, acorta el "alcanza para N meses" de la barra superior y sale en el diario sin que ninguno de ellos sepa de créditos. Uno por vez, y con la caja de por medio se puede cancelar lo que queda.
- Avenidas: las calles pegadas una al lado de la otra forman una franja que se dibuja como avenida (2 = doble línea amarilla, 3 o más = más carriles, veredas solo en los bordes). El ancho sí cuenta: cada carril suma capacidad en `src/sim/congestion.ts`. El dibujo sale de `src/render/avenue.ts`, que además lee la calidad de la calle.
- Calidades de calle: **asfalto** ($10, mantenimiento $1, ×1 de capacidad), **pavimento reforzado** ($30, $3, ×1,6) y **bulevar** ($75, $8, ×1,8). Se eligen de una con `3`, `R` y `T`, y arrastrar una calidad mejor sobre una calle existente la **mejora en el lugar** pagando solo la diferencia: no demuele, no pierde el trazado y no devuelve plata si bajás (para bajar hay que demoler). El **pavimento reforzado** marca el medio del camino con **lucecitas amarillas** punteadas, como los topes de algunas avenidas, en vez de la línea crema del asfalto. El bulevar se dibuja con un **cantero de cemento de un píxel** en el medio del camino, a cualquier ancho: en el límite entre las dos manos de una avenida de ancho par, por el medio del carril central en una impar, y por el medio de la calle cuando es de una sola celda. Sus farolas bajan el delito a 2 lotes o menos; el valor del suelo no lo mueve. Una avenida se lee y se cobra por su celda más débil: un bulevar pegado a una calle de asfalto anda como asfalto. La ruta provincial no se mejora ni se toca: tiene su propio asfalto de cuatro carriles con guardarraíles y se dibuja aparte. Documento: `odd/tasks/calidades-de-calle.md`.
- Terreno prolijo: el relieve generado (inventado o real) no tiene escalones sueltos, y al zonificar o poner un servicio la manzana se rellena hasta quedar plana (nunca más de 2 niveles por vez y sin tocar costas); las calles alrededor hacen de rampa. Deshacer devuelve el terreno. Servicios con radio y capacidad, delito según la densidad, incendios que se propagan sin bomberos y edificios que quedan abandonados cuando faltan luz, calle o seguridad.
- Edificios: casitas, chalets, casas chorizo, PH con tanque de agua, torres, kioscos y almacenes con toldo, galerías, oficinas, talleres, galpones, fábricas y plantas industriales. También hay humo animado y tránsito con taxis negros y amarillos y colectivos.
- Interfaz con fileteado, El Diario del Conurbano, panel de presupuesto con historia, capas de luz, humo, valor del suelo, delito, educación, salud y bomberos (la de cada servicio se muestra sola al elegirlo), y ficha de cada lote que explica por qué crece o no.
- Sonido generado en el navegador (sin archivos): murmullo de ciudad y tránsito que crecen con la ciudad, bocinas y pajaritos, y efectos al construir, demoler, deshacer, salir el diario o arrancar un incendio. Se silencia con el botón "Sonido" o la tecla `M`, y la elección se recuerda.
- Guardado en 3 ranuras más un autoguardado anual, y exportar o importar como archivo `.json`.

## Arquitectura

```
src/
  config.ts          números de balance (costos, mantenimiento, capacidades)
  core/              rng con semilla, matemática isométrica, formato de números
  world/             terreno procedural, grilla de la ciudad, herramientas (planificar y aplicar)
  sim/               energía, campos (calles, contaminación, valor), demanda, presupuesto,
                     créditos, calendario, diario, ficha de consulta y el bucle de simulación
  render/            sprites procedurales, cache isométrica del mapa, vista, minimapa, tránsito,
                     pintor de pixeles para los ornamentos
  save/              serialización validada y ranuras en localStorage
  input/             mouse, rueda y touch
  ui/                estilos, íconos, barra de herramientas por categorías, ornamentos fileteados,
                     frases de filete y paneles (presupuesto, partidas, ayuda, boleta, plaqueta)
  game.ts            una partida en curso: une simulación, render, entrada y HUD
  main.ts            pantalla de inicio, teclado y ciclo de vida de la partida
tests/               Vitest, solo lógica pura (sin DOM)
scripts/             sonda de balance
```

Algunas decisiones que conviene conocer:

- **La simulación es determinista.** Todo azar sale de un `Rng` cuyo estado se guarda en la partida: misma semilla y mismas acciones dan la misma ciudad.
- **El mapa se dibuja una vez** en un canvas grande por rotación. Después solo se redibujan las regiones que cambiaron (`MapRenderer.update`), en orden de pintor. Lo animado (humo, autos, avisos de corte de luz) va por encima en cada frame.
- **Las herramientas tienen dos pasos.** `planTool` calcula qué celdas cambian y cuánto cuesta sin tocar nada (la previsualización usa lo mismo), y `applyPlan` lo ejecuta.
- **El guardado se valida campo por campo** y rechaza partidas imposibles con un mensaje para el jugador.
- La carpeta `ORIGINAL/` es solo material de referencia, está fuera de git y nada de ahí entra al juego.

## Continuidad (para retomar con otro modelo o persona)

- Especificación viva y bitácora: `odd/tasks/argencity-3000.md`. El plan legible para el jugador está en `PLAN-DE-TRABAJO.txt`.
- Antes de cambiar algo: `npm test` y `npm run build` tienen que pasar.
- El balance se ajusta en `src/config.ts`, `src/sim/demand.ts` (demanda y techo de niveles) y `src/sim/budget.ts` (tasas). Después de tocarlo, correr `npm run probe`.
- Los créditos salen de `LOANS` (`config.ts`); todo lo demás —total, cuota, deuda, mes final— se deriva en `src/sim/loans.ts`. La cuota se cobra **dentro de `monthlyBudget()`**, nunca restada aparte en `settleWeek`: si se resta a mano quedan dos contabilidades que se contradicen.
- Para agregar un edificio: un nivel en `CAPACITY` (`config.ts`), su dibujo en `src/render/sprites.ts` y su nombre en `src/sim/report.ts`.
- Copy de la interfaz: español rioplatense. El jugador es **"Intendente"**, nunca "Alcalde".

- Las obras de la costa (muelle de pescadores, costanera, puerto de carga, balneario y faro) funcionan solo con una calle a 3 lotes o menos **y con luz**; los muelles que funcionan tienen un pesquero que navega cerca. Un edificio al que no llega ninguna calle muestra un globito con un cono de tránsito.
- Servicios de segundo nivel (desde "Ciudad pujante", 2.500 habitantes): el **hospital** (`;`) y la **universidad** (`-`), de radio grande y caros de construir y de mantener, con su propio slider en el Presupuesto. Hacen además de salita y de escuela. Sin hospital cerca las casas no pasan del nivel 4, y sin universidad tampoco los comercios ni las fábricas (`levelCap`, `src/sim/demand.ts`).
- Balance: la migración de cada gobierno ahora es la velocidad con que se levantan casas (antes bajaba el apetito de la ciudad y la Dictadura y el Comunismo se estancaban en unos cientos de habitantes); los impuestos restan demanda de a poco (de 10 % a 16 % la ciudad atrae cada vez menos) y el favor divino llega a milagros a partir de 66.
- Presupuesto de usinas (slider "Usinas"): al 100 % generan lo normal, al 0 % la mitad y hasta 120 % un 10 % más (`fundingCondition`, `src/sim/condition.ts`, la misma curva que las calles); cuesta el mantenimiento en proporción. Arriba de los presupuestos hay un slider **"Todos a la vez"** que mueve juntos los de servicios, usinas, plazas, calles y transporte, cada uno la misma cantidad (50 y 70 pasan a 60 y 80); los impuestos no se tocan.
