# Los casos cobran en semanas de recaudación

Objetivo: que una decisión pese lo mismo en un pueblo de cinco mil habitantes que en una ciudad de
cien mil. Antes cobraban pesos fijos.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los
decide el usuario). Runner: `npx vitest run`, `npx tsc --noEmit`.

## Specs

### S1 — Los importes eran fijos, y eso no escala

> "no sé como escalan los eventos aleatorios respecto al dinero, me refiero a que si es un valor fijo, en una ciudad de 100k de habitantes quizá gastar 5k de plata no cambia nada"

Medido antes de tocar nada, con `npm run probe` y con una ciudad llena a nivel 5:

| Ciudad | Recaudación por mes | $15.000 son |
|---|---|---|
| `probe`, año 3 (4.336 hab) | ~$660 | 22 meses |
| 25.000 hab, media ciudad | ~$12.000 | 1,2 meses |
| 128×128 llena a nivel 5 | ~$870.000 | medio día |

La recaudación por habitante va de 0,14 a 1,1 pesos por mes. Los importes estaban calibrados para
una ciudad de veinte o treinta mil: abajo eran catastróficos, arriba eran ruido.

Criterio de aceptación: el mismo caso cuesta lo mismo **en semanas de lo que la ciudad recauda**.

### S2 — La unidad es el tiempo de recaudación

> "Me gusta hacerlo por tiempo de recaudación"

`weeksOfIncome(sim, semanas)` = lo que la ciudad recaudó el mes pasado ÷ 4 × las semanas.

**Corregido después**, verbatim: "no se puede hacer con numeros? prefiero que el usuario sepa que le
va a salir X dinero que imaginar cuanto seria el impacto en caja". El detalle de cada opción dice el
peso exacto, calculado al abrir la ventana (`EventOption.detail` puede ser `(sim) => string`), y es el
mismo número que se cobra: el tiempo está en pausa hasta que el jugador elige.

### S3 — Que joda, pero que no cague la partida

> "lo que si creo yo es que tiralo un "poquito" para abajo en el sentido que te joda, pero tampoco te pueda cagar la partida"

Cada importe viejo se convirtió a semanas redondeando **hacia arriba** (tendiendo a más caro), nunca
hacia abajo, y con un piso de $500 por semana para que un pueblo que todavía no recaudó nada igual
pague algo.

**Corregido después**, verbatim: "Que sean mas caros los festejos y lo eventos, aumentá un poco su
multiplicador". `CASE_PRICE = 1.3` en `weeksOfIncome`: una sola perilla que mueve todos los casos y
los feriados juntos, así la escalera entre ellos no cambia. Un caso de dos semanas pasó de $6.000 a
$7.800 en una ciudad que recauda $12.000 por mes.

**Corregido otra vez**, verbatim: "que use tanto el dinero en caja como la población, por que ahora
que tengo mucho dinero pero no tanta población siento que no pago nada, y de igual forma si una
partida mas adelante con mucha población pero por lo que sea tuvo mala caja o justo invirtió mucho en
este caso quedaria fundida".

La semana de la ciudad es el **mayor** de dos cosas y el precio tiene un techo, pero **un cobro y un
premio no leen lo mismo**:

```
semana     = max($500, recaudación del mes ÷ 4)
cobro      = min(max(semana, caja ÷ 8) × semanas × 1,5, (caja + recaudación) ÷ 2)
premio     = semana × semanas × 1,5
```

- La población entra por la recaudación: es lo que la ciudad cobra por su gente.
- La caja entra por `caja ÷ 8`: dos meses de recaudación. Se probó con `÷100` y un pueblo de 6.000
  habitantes con $90.000 pagaba $3.783 por tapar una coima; con `÷8` paga **$29.250**. El mismo caso
  en una ciudad que no tiene nada en caja sigue saliendo lo mismo que antes.
- Un premio lee solo la recaudación: un buen mes no puede imprimir plata de los ahorros.
- El techo es solo para los cobros: nunca se llevan más de la mitad de lo que hay más lo que el mes
  va a traer.

**Corregido cuarto**: la opción "Taparlo" de la coima *sumaba* la coima a la caja en vez de cobrarla,
que es la razón por la que ese caso era el más barato de todos. Ahora la resta. Y las cuatro opciones
que efectivamente **entraban** plata decían "Cuestan": ahora dicen "Entran" (fábrica sin controles,
venta del lote del club, y las dos de plaza vecina).

## Tasks

- T1 — `weeksOfIncome` y el piso, en `src/sim/events.ts`.
- T2 — Las 24 opciones de los casos y las tres de los feriados, en semanas.
- T3 — Los tests de `tests/eventos.test.ts` pasan a asertar semanas.

## Log

- L1 — Pedido original, verbatim en S1.
- L2 — Medición: ver la tabla. El `probe` se estanca en 5.000 habitantes, así que la calibración
  "para veinte o treinta mil" es una lectura de la tabla, no un dato del juego.
- L3 — Los topes de caja de los `when` (`cash > 5000`, `cash > 20000`) quedaron en pesos absolutos:
  son más estrictos que el costo real y no rompen nada. Se pueden pasar a semanas si alguna vez
  frenan un caso que el jugador podría pagar.
- L4 — `weeksOfIncome` no redondea el resultado final: un importe puede quedar en medio peso cuando
  la semana da impar. Solo se ve en la caja, nunca en un texto.
- L5 — El detalle volvió a los pesos, calculados en el momento. Las semanas quedan como la unidad de
  la fórmula, no de la pantalla.
- L6 — `CASE_PRICE = 1.3`, un 30 % más caro todo junto. Se eligió una constante y no tocar 23 números,
  para que la próxima vez que haga falta sea una línea.
- L7 — Dos referencias y un techo. Medido en cuatro ciudades: la chica con medio millón en caja pasó
  de pagar $1.950 a $19.500 por un caso de tres semanas; la ciudad de 786.000 habitantes con la caja
  en $2.000 toca el techo y paga $436.000 en vez de $848.000; la que arranca con $24.000 no cambió
  nada. Ese último punto fue el criterio para elegir el techo: no abaratar el principio de la partida.
- L8 — `TILL_WEEKS` de 100 a 8, y el lado (cobro o premio) explícito en `caseMoney`. Verificado con
  los tests: el pueblo de 6.000 con $90.000 paga $29.250 en vez de $3.783. **Contra L7**: el principio
  de la partida quedó más caro, no más barato; es a propósito. Una ciudad recién fundada con $30.000
  y un caso de cuatro semanas paga los $15.000 del techo (la mitad de su caja), no $2.600. El techo es
  lo único que sigue evitando la fundida, y es la palanca si resulta demasiado duro.
- L9 — `CASE_PRICE` de 1,3 a 1,5, otra vez por el mismo pedido pero con el alcance aclarado: "el caso
  de la coima es un ejemplo que te di respecto a TODOS los eventos y feriados". Es una sola constante,
  así que los 48 importes y los dos topes de los feriados se movieron juntos y la escalera entre casos
  quedó igual. Medido con los tests: el pueblo de 6.000 con $90.000 paga $33.750 por tapar la coima
  (era $3.783 al empezar); una semana de una ciudad que recauda $12.000 cuesta $4.500 (era $3.900).
