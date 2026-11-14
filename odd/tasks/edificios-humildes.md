# Edificios humildes (un tier más bajo y ciudades que no mejoran toda a la vez)

Objetivo: un nivel nuevo por debajo de todos para cada tipo de edificio (R, C, I) y un crecimiento
en el que no todos los edificios mejoran solos.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los decide el usuario).
Runner: `npx vitest run`, `npx tsc --noEmit`. Las saves viejas no importan (lo dijo el usuario).

## Specs

### S1 — Un tier más bajo, por tipo de edificio

> "me gustaria que haya un tier mas bajo visual de cada tipo de edificio, las casas mas humilde de ladrillo y techo de chapa, los comercios igual tipo kioscos, verdulerias, etc, fabricas igual."

- Cada tipo de edificio (R, C, I) tiene un nivel nuevo por debajo del actual más bajo. Los niveles
  que ya existían suben un número: el 1 pasa a ser el humilde, el máximo pasa de 4 a 5.
- Residencial: casa de ladrillo a la vista con techo de chapa. Comercial: kiosco o verdulería,
  según la variante. Industrial: tinglado de chapa.
- Rinde menos que el nivel que era el más bajo (menos residentes o empleos).

### S2 — No todos los edificios mejoran solos

> "al avanzar la ciudad no necesariamente TODOS los edificios se van mejorando, me explico? quizá con 50 mil habitantes pueda haber una casa de chapa al lado de un rascacielos"
> "Osea, algunos pueden mejorarse solos pero otros no, ahi es donde entra la decisión del jugador."

- Un edificio humilde recién construido puede ser de los que mejoran solos o de los que no. Eso se
  sortea al construirlo y no cambia mientras el edificio siga en pie.
- Los que no mejoran solos se quedan humildes aunque la ciudad crezca. Los demás suben como
  siempre, hasta el tope que permiten la ciudad y el valor del suelo.

### S3 — Lo que se construye después sigue otra lógica

> "ya si el jugador decide tirar la de chapa ahi si la que aparece seguira otra logica"

- Un lote vacío o demolido de una ciudad ya crecida no arranca en el nivel humilde: el edificio
  nuevo nace en un nivel acorde al tope de ese momento.
- En una ciudad chica el edificio nuevo sigue naciendo humilde.
- El sorteo de S2 se hace de nuevo con cada edificio nuevo.

### S4 — Sprites

> "Los sprites nuevos que respeten la estetica actual"

- Los tres sprites nuevos se dibujan con el mismo `Painter` y la misma paleta (`PAL`) que los
  actuales, con el mismo tamaño de lote y la misma proyección.

### Supuestos (míos, a confirmar)

- Cerca de un tercio de los edificios humildes son de los que no mejoran solos.
- El edificio nuevo en ciudad crecida nace un nivel por debajo del tope, para que tenga con qué crecer.
- "Ciudad chica" = menos de 150 habitantes, el mismo corte que ya usa `levelCap` para lo residencial.

## Tasks

- [x] T1 — S1 — inline — Renumerar niveles: `MAX_LEVEL`, `CAPACITY`, nombres, `levelCap` y los números de nivel sueltos; arreglar tests.
- [x] T2 — S2, S3 — inline — Sorteo de "mejora sola" y nivel de nacimiento por época, con sus tests.
- [x] T3 — S1, S4 — inline — Sprites: los tres humildes nuevos y los actuales corridos un nivel.
- [x] T4 — S1–S3 — inline — Ayuda del juego, ficha del lote y notas de parche.

## Log

- L1 (2026-11-14, usuario): "Bien, aprovechando eso me gustaria cambiar lo que es medio el "early" del juego, ya que hay calle de tierra, me gustaria que haya un tier mas bajo visual de cada tipo de edificio, las casas mas humilde de ladrillo y techo de chapa, los comercios igual tipo kioscos, verdulerias, etc, fabricas igual. Y tambien que al avanzar la ciudad no necesariamente TODOS los edificios se van mejorando, me explico? quizá con 50 mil habitantes pueda haber una casa de chapa al lado de un rascacielos, ya si el jugador decide tirar la de chapa ahi si la que aparece seguira otra logica, que opinas?"
- L2 (2026-11-14, usuario): "Osea, algunos pueden mejorarse solos pero otros no, ahi es donde entra la decisión del jugador. Los sprites nuevos que respeten la estetica actual"
- L3 (2026-11-14, usuario): "Las saves viejas no importan, es testing todo esto."
- L4: Exploración: hoy un lote vacío siempre nace en nivel 1 y sube por `changeLevel(level + 1)` hasta `levelCap`, así que con el tiempo todo converge. Los niveles se guardan como índice en `World.level`, y `CAPACITY`, los nombres y los sprites se indexan por ese número.
- L5: T1 hecho: `MAX_LEVEL` 5, `CAPACITY` con el humilde (R 3, C 2, I 3), nombres nuevos (Casa de chapa, Kiosco o Verdulería, Tinglado), `levelCap` corrido un nivel. Los tests viejos se corrigieron sumando 1 a los niveles literales; `clock` ahora cuenta los subsidios de hito y `services` (incendios) usa la semilla 1 porque con la 9 no se prendía ningún incendio con cobertura.
- L6: T2 hecho: `spawnLevel` y `isHoldout` en `sim/demand.ts`, usados en `grow()`. El rasgo sale de un hash del byte `variant`, que se sortea al construir, así que no hay estado nuevo. Con el `continue` desactivado el test de la simulación falla; con él pasa.
- L7: T3 hecho: tres sprites humildes con el `Painter` y la paleta actual; los viejos se corrieron un nivel. Revisados en una grilla ampliada y en una partida real.
- L8: T4 hecho: ayuda del juego, aviso en la ficha del lote ("Su dueño no piensa mejorarla: solo cambia si la demolés.") y un test.
- L9: Verificación: `tsc` y 718 tests pasan. Pendiente: espejo en Engram (no se pudo guardar desde esta sesión) y las notas de parche, que quedaron sin tocar porque el archivo es de la 0.5 ya cerrada.
