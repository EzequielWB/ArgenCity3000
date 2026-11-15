# Presupuesto del transporte y paros ligados al presupuesto

Objetivo: que el transporte tenga su propio presupuesto, que de él dependan las frecuencias de los
colectivos y que los paros (de colectivos y docente) salgan cuando se recorta.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los decide el usuario).
Runner: `npx vitest run`, `npx tsc --noEmit`.

## Specs

### S1 — Presupuesto del transporte

> "modificar el presupuesto del transporte y que afecte a frecuencias y eso"

- El presupuesto tiene un control nuevo, **Transporte**, de 0 a 120 % como los de los servicios
  (100 % por defecto). Gasta en proporción: al X % cuesta el X % del mantenimiento de las líneas.
- La frecuencia sigue al presupuesto: el alivio del tránsito de cada línea es proporcional (al
  X % alivia el X % de lo que alivia al 100 %) y se ven más o menos colectivos en la calle.
- Se guarda con la partida (las anteriores cargan al 100 %).

### S2 — Los paros dependen del presupuesto

> "es mas podria ser un condicional tambien para que hagan paro y eso, como con el paro docente que me imagino que está ligado a eso también"

- El **paro de colectivos** solo puede salir con el presupuesto del transporte por debajo del 80 %.
- El **paro docente** solo puede salir con el presupuesto de escuelas por debajo del 80 %. (Hoy no está
  ligado a nada: sale con solo tener escuelas; este cambio lo arregla.)
- Pagar lo adeudado en cualquiera de los dos vuelve ese presupuesto al 100 %.

### Supuestos (míos, a confirmar)

- El umbral es 80 % para los dos paros.
- Cada línea manda 3 colectivos al 100 % (hasta 4 al 120 %, ninguno al 10 % o menos).

## Tasks

- [x] T1 — S1 — inline — Estado, guardado, presupuesto y alivio con el presupuesto del transporte. Commit 1aa1777.
- [x] T2 — S1 — inline — Control en el panel de presupuesto y colectivos según la frecuencia. Commit e19820d.
- [x] T3 — S2 — inline — Paros ligados al presupuesto, con sus tests.

## Log

- L1 (2026-11-15, usuario): "Por qué granizada en meses calidos? Tambien sabes que falta? modificar el presupuesto del transporte y que afecte a frecuencias y eso, es mas podria ser un condicional tambien para que hagan paro y eso, como con el paro docente que me imagino que está ligado a eso también"
- L2: La granizada va de octubre a febrero porque el granizo sale de tormentas fuertes de calor; es una elección de modelado, no se verificó con una fuente.
- L3: Verificado en el código: el paro docente tenía por condición `countSchools > 0 && pop > 1500`, sin mirar el presupuesto de escuelas.
- L4: Hecho y verificado en el juego con dos líneas: 6 colectivos al 100 %, 4 al 50 %, 0 al 0 % y 8 al 120 %; el renglón Transporte del presupuesto cobra $90, $0 y $216. `tsc` y 773 tests pasan. El control de Transporte siempre se ve en el panel, haya o no líneas.
