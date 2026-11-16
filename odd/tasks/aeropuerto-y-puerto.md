# Aeropuerto y puerto de paseos (transporte comercial)

Objetivo: sumar a la categoría Transportes un aeropuerto y un puerto "comerciales" cuyo tamaño
crece al juntar piezas, con aviones y barcos que se ven moverse.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los decide el usuario).
Runner: `npx vitest run`, `npx tsc --noEmit`.

## Specs

### S1 — Dos obras nuevas en Transportes

> "me gustaria implementar ahora un sistema de aeropuerto y barcos, la idea que se me ocurre podria ser (estos irian en la categoria de transporte claramente)."

- La categoría Transportes suma **Aeropuerto** y **Puerto**, junto a la línea de colectivos.
- Son comerciales, distintos del "Puerto de carga" de la categoría Costa, que sigue siendo industrial.

### S2 — El aeropuerto: 3×2 y tres niveles según cuántas piezas hay

> "Aeropuerto: que sea de 3x2 siempre y que tenga 3 niveles, si pones uno es un hangar con salida de uno o 2 aviones, algo chico, si pones uno al lado se ensancha a mas tamaño y si pones 4 se vuelve un aeropuerto internacional"

- Cada pieza ocupa 3×2 lotes, siempre.
- Una pieza sola es un **hangar** con uno o dos aviones. Piezas pegadas forman un solo aeropuerto, más
  grande; con 4 o más es **internacional**.

### S3 — El puerto: 2×2 y tres niveles según cuántas piezas hay

> "Y barcos mas o menos lo mismo, 2x2 siempre y que sea una pequeña salida con barco, si pones uno al lado se vuelve un puerto mas grande y si pones 3 (quedaria 6x2) se vuelve un puerto con barco, crucero, etc."

- Cada pieza ocupa 2×2 lotes, siempre.
- Una pieza sola es una pequeña salida con un barco. Dos pegadas son un puerto más grande. Con 3 o más
  es un puerto con barcos y cruceros.

### S4 — Comercial

> "La idea de esto es que sea algo mas "comercial" barcos que dan paseos y hasta cruceros en el mas grande"

- Los barcos dan paseos y, en el nivel más alto, hay cruceros. Aporta empleos comerciales e ingresos
  por turismo, no industria.

### S5 — Forma de las piezas

> "Está bien que las piezas no sean cuadradas, entiendo que es logico, o decis de si o si cuadrado todo? sinó que sea cuadrado y listo"

- No hace falta que sean cuadradas: el aeropuerto es de 3×2 y el puerto de 2×2, con orientación fija.

### S6 — Aviones y barcos

> "Tambien habria que implementar diseño de aviones y barcos"

- Cada nivel tiene su dibujo (sprites) y se ven aviones y barcos moviéndose.

### Supuestos (míos, a confirmar)

- Niveles del aeropuerto: 1 pieza = hangar, 2 o 3 = aeródromo, 4 o más = internacional.
- Niveles del puerto: 1 pieza = muelle de paseos, 2 = puerto, 3 o más = puerto con cruceros.
- Piezas "pegadas" = que comparten un borde. El nivel sale de cuántas piezas tiene la instalación.
- El aeropuerto va en tierra a 3 lotes o menos de una calle; el puerto tiene que tocar el agua y
  también tener una calle cerca. Ninguno necesita luz.
- Cuestan por pieza y dan empleos comerciales e ingresos por mes según el nivel de la instalación.
  El aeropuerto hace ruido: baja el valor del suelo alrededor.
- Se habilitan con hitos altos: el puerto en "Ciudad pujante" y el aeropuerto en "Gran ciudad".
- "Diseño" = el aspecto visual (sprites) y los vehículos animados, no un editor.

## Tasks

- [x] T1 — S1, S2, S3, S5 — inline — Datos y colocación: tiles, lista de instalaciones, huella de varias celdas, demolición, deshacer y guardado. Commit 839ec36.
- [x] T2 — S2, S3, S4 — inline — Niveles por piezas pegadas, empleos, ingresos, ruido, presupuesto, desbloqueo y ficha del lote. Commit fb3682a.
- [x] T3 — S6 — inline — Dibujo: sprites por nivel de aeropuerto y de puerto, con la vista rotada. Commit f4fb077.
- [x] T4 — S6 — inline — Aviones y barcos en movimiento.
- [x] T5 — S1–S6 — inline — Ayuda, README y verificación en el juego.

## Log

- L1 (2026-11-15, usuario): "Bien, ahora me gustaria implementar un sistema de aeropuerto y barcos, la idea que se me ocurre podria ser (estos irian en la categoria de transporte claramente). Aeropuerto: que sea de 3x2 siempre y que tenga 3 niveles, si pones uno es un hangar con salida de uno o 2 aviones, algo chico, si pones uno al lado se ensancha a mas tamaño y si pones 4 se vuelve un aeropuerto internacional, que opinas? Y barcos mas o menos lo mismo, 2x2 siempre y que sea una pequeña salida con barco, si pones uno al lado se vuelve un puerto mas grande y si pones 3 (quedaria 6x2) se vuelve un puerto con barco, crucero, etc. Tambien habria que implementar diseño de aviones y barcos"
- L2 (2026-11-15, usuario): "La idea de esto es que sea algo mas "comercial" barcos que dan paseos y hasta cruceros en el mas grande. Está bien que las piezas no sean cuadradas, entiendo que es logico, o decis de si o si cuadrado todo? sinó que sea cuadrado y listo"
- L3: Exploración: las usinas (2×2) son el modelo de una obra de varias celdas: lista `World.plants` con el ancla, tile compartido, demolición de la obra entera, guardado y deshacer propios, y un sprite que se dibuja una sola vez en la celda de adelante. Las plazas son el modelo de "manchas": un efecto que depende del tamaño de las celdas pegadas.
- L4: T1 a T3 hechos y commiteados. Las piezas se guardan como lista (`World.hubs`, formato 16) y el nivel sale de las piezas que se tocan, sin estado extra por instalación. El dibujo del aeropuerto se hace a lo largo de la pista, así que vale con la vista girada; el del puerto lleva el muelle hacia el agua.
- L5: T4 y T5 hechos: aviones que despegan y aterrizan sobre la pista de cada pieza (uno por nivel) y barcos que pasean por el agua cerca del puerto, con un crucero en el nivel 3 (`src/render/vessels.ts`). Verificado en el juego sobre Mar del Plata: puerto de 2 piezas con barcos navegando y aeródromo de 2 piezas con aviones despegando. `tsc` y los tests pasan. No se vio el puerto de 3 piezas (el mapa no tenía un tramo de costa recto con calle cerca) ni el aeropuerto con el mapa girado.
- L6 (usuario, 2026-11-16): "hay que reducir un poco lo que transporte, la ganancia de dinero del
  aeropuerto y la cosa esa del mar ... actualmente es casi dinero gratis". Medido con las piezas
  puestas de verdad (4 del aeropuerto, 3 del puerto, nivel 3, cJobs desde el propio hub): el
  aeropuerto dejaba **+$1.270 por mes** sobre $24.000 de obra, **19 meses de repago**, y el puerto
  **+$1.140** sobre $10.500, **9 meses**. Nuevo: aeropuerto con ingreso `[200, 720, 2300]` y upkeep
  $470 por pieza → +$690 y **35 meses**; puerto con ingreso `[120, 480, 1350]` y upkeep $400 por pieza
  → +$330 y **32 meses**. La obra no se tocó: lo que cambió es el margen. Con el upkeep por pieza, un
  hub a medio construir pierde plata (−$270 el hangar suelto) y solo paga entero: la herramienta es un
  compromiso, no un surtidor. No se tocaron las líneas de colectivos (no dan plata) ni los edificios de
  la costa: pescadores +$50, balneario +$24 promedio contra $120 de upkeep, y el puerto de carga paga
  con el 5 % de impuestos industriales.
