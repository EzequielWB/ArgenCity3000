# Incendio grande, tornado y usinas viejas

Tres cosas del archivo `CAMBIOS_FUTUROS.txt` que el usuario eligió del sub-loop de crisis y del progreso
tecnológico: el incendio grande con cortafuegos, el tornado, y la obsolescencia programada de las usinas.

## Specs

### S1 — El incendio grande
- **Lo que ya existe se reusa**: `w.fire[]`, `ignite()`, `burn()`, `FIRE_SPREAD`. No se inventa un segundo
  sistema de fuego. *"Reutiliza: w.fire[], ignite(), burn(), FIRE_SPREAD (ya existen)."*
- **Sin unidades móviles**: el juego tiene servicios fijos por radio, no camiones. *"Deploy manual: NO."*
- **El cortafuegos lo hace el jugador**: demuele una franja o planta una plaza, y el fuego no tiene por
  dónde seguir, porque la propagación sólo salta a lotes con edificio. *"Cortafuego: jugador usa bulldoze o
  park para crear franja sin combustible."*
- **Un foco grande no lo apaga la cobertura**: si los bomberos salvaran el foco, el incendio grande sería un
  incendio normal. Los focos que prende el desastre se pierden aunque el lote tenga cobertura 100 %.
- **La propagación NO hereda la grandeza**: los vecinos que se prenden son fuegos normales, y la cobertura
  los apaga. Así el incendio grande se contiene por los bordes —rodeando el barrio de cuarteles— y no es una
  cadena sin final. Es la única forma de que sea un problema y no un game over.
- **El recupero es el que ya está**: los lotes quemados quedan baldíos (`level = 0`), y el jugador vuelve a
  llevarlos luz, agua y calle. *"Fase recupero: areas destruidas quedan como terreno baldío."*
- Pasa **poco**: no en cada partida. Necesita una ciudad de verdad (`pop >= 1500`).

### S2 — El tornado
- **No se frena.** *"este no deberia poderse frenar, simplemente pasa por X zona y listo"*. La cobertura de
  bomberos **no** cambia nada: no lo desvía, no lo acorta, no lo apaga. Es la diferencia con el fuego, y por
  eso no se implementa ninguna defensa contra él.
- **Pasa por X zona y listo**: entra por un borde del mapa y cruza en línea recta hasta el borde opuesto,
  dejando destruido lo que pisa. Un ancho de tres celdas para que el paso se lea en el mapa.
- **Pasa muy poco.** *"pasa muy poco"*. Es un desastre, no un evento de gestión: no pide una decisión, se
  anuncia en el diario y sigue de largo. Su chance mensual es una fracción de la de los eventos comunes.
- **No rompe la partida sin aviso**: no arranca en los primeros diez años, y entre dos tornados tienen que
  pasar veinte.
- Lo que destruye queda igual que lo quemado: el lote en cero y el jugador a reconstruir.

### S3 — Obsolescencia programada de las usinas
- **Cada usina tiene `age`**, en meses de servicio. *"Cada usina tiene 'age' (en meses o ticks)."*
- **A los ~50 años empieza a decaer**: la capacidad baja de a poco hasta la mitad. *"Cuando cumple ~50 anos
  (600 meses aprox), output baja o la usina abandonada/desmantelada."*
- **Nunca a cero**: se queda en la mitad, así el jugador puede llegar con la usina nueva sin un apagón total
  del que no se sale. La usina vieja sigue siendo una usina, sólo que mala.
- **Fuerza reinvertir**: con la tecnología más nueva (gas, viento) la misma plata da más. *"Fuerza reinversion
  capital en tecnologias mas eficientes."*
- **Avisa una vez**, en el diario, cuando entra en declive. No repite el aviso cada mes.
- **No rompe las partidas guardadas**: una usina sin `age` en el archivo es una usina nueva. *"Todo cambio
  que toque formatos de guardado (save.ts, config.ts) debe tener versionado correspondiente"* — un campo
  opcional que crece no necesita versión nueva, y el archivo viejo se lee igual.

## Tasks

- [x] **T1** — `DESASTRE` y `PLANT_LIFE` en `src/config.ts`: los números de los tres, en un solo lugar y con el
  porqué escrito al lado. Commit: `feat(sim): los números de los desastres y de la vida útil de las usinas`.
- [x] **T2** — `src/sim/plants.ts`: `ageFactor(age)` y `plantCapacity` multiplicando por la edad. Tests en
  `tests/desastres.test.ts`: capacidad plena antes de los 50 años, mitad a los 60, nunca menos de la mitad,
  y la eólica decae igual que la térmica. Commit: ver T5.
- [x] **T3** — `src/sim/simulation.ts`: `bigFire`, `igniteGrande`, `burn` que respeta el foco grande y propaga
  fuegos normales, `incendioGrande()` y su roll en `endOfMonth`. Tests: el foco con cobertura se pierde
  igual; el vecino que se prende sí lo apaga la cobertura. Commit: ver T5.
- [x] **T4** — `src/sim/simulation.ts`: `tornado()`, su roll mensual y el aviso del diario. Tests: cruza el mapa
  y destruye lo que pisa; con cobertura 100 % destruye exactamente lo mismo; no sale en los primeros diez
  años. Commit: ver T5.
- [x] **T5** — `src/sim/simulation.ts`: `agePlants()` en `endOfMonth` y el aviso de la usina que entra en
  declive. `src/save/save.ts`: leer `age` de la usina (la que no lo trae queda en 0). Commit:
  `feat(sim): el incendio grande, el tornado y la usina que se pone vieja`.
- [x] **T6** — `odd/tasks/incendio-y-tornado.md` completo y pusheado junto a T2–T5.

## Log

- **L1** *(pedido original, verbatim)*: "Bien, vayamos con el incendio grande y el tornado, este no deberia
  poderse frenar, simplemente pasa por X zona y listo, pasa muy poco. Tambien me gusta lo de obsolencia
  programada."
- **L2.** La fuente es `CAMBIOS_FUTUROS.txt` (17/11), que **no está en `main`**: vive en un checkpoint de
  refs (`refs/t3/orchestration-v2/checkpoints/...`). El archivo del árbol de trabajo ya no existe.
- **L3.** Dos requisitos del documento original se **cambian acá**, y el cambio es del usuario:
  - El tornado del documento frenaba su avance con cobertura de bomberos (*"coverage de bomberos reduce su
    avance"*). Ahora no se frena: pasa y listo. Eso borra la defensa y deja el desastre como lo que es.
  - El documento no decía con qué frecuencia. El usuario dijo **"pasa muy poco"**, así que no entra por
    `pickEvent` (la puerta de los eventos con decisión, uno cada ~23 meses): tiene su propia chance, mucho
    más baja, y su propio aviso.
- **L4.** Se descarta el choque de avión por ahora: el documento lo pone junto al tornado y comparte la base
  del incendio, pero el usuario pidió dos cosas, no tres. Queda anotado para cuando lo pida.
- **L5.** El incendio grande **no hereda la grandeza al propagarse**. El documento no lo dice; es una decisión
  de balance: un foco que no se apaga y se propaga sin fin quema la ciudad entera sin que el jugador pueda
  hacer nada. Con la propagación normal, el fuego grande se contiene rodeándolo, y el cortafuegos con
  bulldoze sigue siendo la otra salida.
- **L6.** Doce tests nuevos en `tests/desastres.test.ts`: cuatro del incendio grande, cinco del tornado y tres de
  la usina vieja. Los cinco que pasaron en rojo la primera vez son los de `ageFactor`, que ya estaba escrito
  antes de armar el resto.
- **L7.** Tres trampas del arnés de tests:
  - **El constructor de `Simulation` recalcula los servicios y pisa `fireCover`**: poner la cobertura antes de
    crear la simulación deja la ciudad sin bomberos, y el test del incendio grande pasaba sin probar nada. Va
    después.
  - **`/usina/i` no sirve para contar el aviso**: el diario del mes habla de "las usinas" en el presupuesto. La
    aserción cuenta `/cumplió .* años/i`.
  - **Una usina en un barrio de casas rompe el guardado**: las cuatro celdas del terreno de la usina quedaban
    con `level = 3` y `zoneOf(TILE.PLANT)` es `null`, así que `serialize` tiraba "Hay edificios fuera de las
    zonas". El helper convierte el terreno y limpia el nivel.
- **L8.** **La usina nueva se guarda igual que antes**: `age` y `warned` sólo se escriben cuando tienen algo que
  decir. Un archivo de una ciudad que nunca llegó a los cincuenta años no cambia ni un byte, y los dos tests de
  round-trip que comparan la forma exacta del objeto siguen pasando sin tocarse. La versión del archivo no
  sube: el campo es opcional y crece solo.
- **L9.** El tornado **no toca la infraestructura**: se lleva edificios (`level > 0`) y deja calles, tendido,
  usinas y plazas. Es el mismo criterio que el fuego, y evita el estado imposible de una usina sin terreno.
  1230 tests / 79 archivos verdes, `tsc` limpio.
