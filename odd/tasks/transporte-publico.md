# Transporte público: líneas de colectivos

Objetivo: una categoría "Transportes" con una primera obra, la línea de colectivos, que alivia el
tránsito de las calles de alrededor para no tener que ensanchar calles sin fin.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los decide el usuario).
Runner: `npx vitest run`, `npx tsc --noEmit`. Las saves viejas no importan (lo dijo el usuario antes).

## Specs

### S1 — Una categoría de transportes con una estación que afecta un área

> "la idea es que este sirva para mejorar el transito sin necesidad de expandir infinitamente las calles."
> "Yo creo que se podria agregar una sección de "Transportes" que permita poner estaciones de colectivos y afectan un area."

- La barra de herramientas tiene una categoría nueva, **Transportes**, con una herramienta para
  poner una línea de colectivos en un lote.
- Cada línea alivia el tránsito de las calles que quedan dentro de su área: la carga que se compara
  con la capacidad de la calle baja. Con varias líneas que se superponen el alivio suma, con tope.
- Cuesta plata al construirla y mantenimiento por mes (línea nueva en el presupuesto).

### S2 — Ventana para elegir color y número

> "Al colocar una linea de colectivo deberia salir una mini pantalla contextual que te permita elegir un color (10 colores genericos que suelen tener los colectivos) y un numero de 3 digitos maximos que NO se puede repetir (el identificador del colectivo)."

- Al hacer clic en el mapa con la herramienta, antes de construir, sale una ventana chica con:
  10 colores genéricos de colectivo para elegir, y un número de hasta 3 dígitos.
- El número **no se puede repetir** entre las líneas de la ciudad. La ventana avisa y no deja
  confirmar si ya existe. Se propone uno libre.
- Cancelar la ventana no construye nada ni cobra nada.

### S3 — Se ven colectivos en la calle

> "Claramente van a tener que verse colectivos por la calle."

- Cada línea tiene colectivos que circulan por las calles de su área, del color elegido.
- La obra en el mapa también se ve del color de la línea.

### S4 — Alcance

> "No hace falta mucho mas es mas que nada una herramienta util, no hay que poner paradas ni nada y cosas asi."
> "Mas adelante en la categoria de transporte pensaba agregar aviones y barcos"

- Nada de paradas, recorridos dibujados ni pasajeros. Es una obra de un lote con un área.
- La categoría queda lista para sumar aviones y barcos más adelante (no se hacen ahora).

### Supuestos (míos, a confirmar)

- Se habilita con la categoría "Ciudad" (1.000 habitantes), cuando el tránsito empieza a molestar.
- Una línea cuesta $900 y $90 por mes; su área es de 9 lotes a la redonda; alivia un 35 % de la
  carga de cada calle; con varias, el alivio total no pasa del 60 %.
- Tiene que estar a 3 lotes o menos de una calle (como las obras de la costa) para poder construirse.
- Dos colectivos por línea, que andan solo por las calles de su área.
- El color y el número se ven en la ficha del lote. Los números van del 1 al 999.
- Los colectivos "de adorno" amarillos que ya andaban solos se quitan, para que todo colectivo que
  se vea sea de una línea.

## Tasks

- [ ] T1 — S1, S2 — inline — Datos: tile nuevo, color y número por lote, validación del número, guardado, deshacer.
- [ ] T2 — S1, S2 — inline — Herramienta, categoría, desbloqueo y ventana de color y número.
- [ ] T3 — S1 — inline — Efecto en el tránsito y presupuesto.
- [ ] T4 — S3 — inline — Dibujo: la obra por color y los colectivos en la calle.
- [ ] T5 — S1–S4 — inline — Ayuda, ficha del lote y verificación en el juego.

## Log

- L1 (2026-11-15, usuario): "Bien, quiero implementar ahora un sistema de transporte publico, la idea es que este sirva para mejorar el transito sin necesidad de expandir infinitamente las calles. Yo creo que se podria agregar una sección de "Transportes" que permita poner estaciones de colectivos y afectan un area. Al colocar una linea de colectivo deberia salir una mini pantalla contextual que te permita elegir un color (10 colores genericos que suelen tener los colectivos) y un numero de 3 digitos maximos que NO se puede repetir (el identificador del colectivo). Claramente van a tener que verse colectivos por la calle. No hace falta mucho mas es mas que nada una herramienta util, no hay que poner paradas ni nada y cosas asi. Mas adelante en la categoria de transporte pensaba agregar aviones y barcos"
- L2: Exploración: el tránsito es una estimación (`sim/congestion.ts`): cada vecino va al comercio y a la industria más cercanos por las calles y la carga de cada calle se compara con su capacidad. Los autos de `render/traffic.ts` son de adorno y ya incluyen un `bus` amarillo al azar. Las obras de un lote con costo, mantenimiento y sprite propio (la costa) son el modelo más parecido. El deshacer guarda tile, nivel, variante y demás por celda.
