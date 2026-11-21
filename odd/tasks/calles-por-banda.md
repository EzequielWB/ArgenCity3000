# Mejorar una calle es mejorar la cuadra entera

El jugador reportó que al mejorar calles «a veces quedan entrecortadas, sobre todo cuando son
avenidas», y que el consultar dice «Bulevar» sobre una calzada que se ve de tierra.

## Lo que se midió

Una avenida de tres calzadas de tierra, mejorada a bulevar arrastrando por la calzada del medio,
como lo hace cualquiera:

| calzada | dato (`roadTier`) | lo que se dibuja |
|---|---|---|
| izquierda | Calle de tierra | Calle de tierra |
| **medio** | **Bulevar** | **Calle de tierra** |
| derecha | Calle de tierra | Calle de tierra |

Las dos caras del mismo problema:

- El render pinta **por banda** y la banda toma la calidad de su celda más débil
  (`analyzeRoads` → `weakerRoad`), porque una avenida es una cosa sola.
- El upgrade trabaja **por celda**: arrastrar por una calzada deja las otras dos viejas.
- El consultar lee el dato de la celda, así que dice bulevar mientras la calzada se ve de tierra.

El jugador no ve ningún cambio hasta mejorar las tres calzadas, y si mejora dos queda un tramo
entrecortado. No es un problema de dibujo: es que el dato admite un estado que no tiene sentido
—una avenida con una calzada de otra calidad—.

## Specs

- **S1 — La unidad de mejora es la sección transversal.** Mejorar una calle mejora, en el mismo
  gesto, todas las calzadas de la cuadra que corren a su lado (hasta `MAX_BAND`). Cada una paga
  su diferencia: el costo del plan es la suma, y se muestra antes de aplicar.
- **S2 — Sólo se mejora, nunca se degrada.** Una calzada de mejor calidad en la sección se queda
  como está: pintar asfalto sobre un bulevar no lo rompe.
- **S3 — El consultar no puede contradecir al dibujo.** La calidad que informa una celda de calle
  es la calidad **efectiva** de su banda, la misma que se dibuja. Si un save viejo quedó mezclado,
  el consultar dice lo que se ve.
- **S4 — Las calles sueltas no cambian.** Una calle de una calzada se mejora como siempre: su
  sección es ella misma.

## Tasks

- T1 · `crossSection`: la sección transversal de una calle, acotada por `MAX_BAND` — `src/world/roads.ts` — commit `00e483b`
- T2 · `planTool`: el upgrade recorre la sección y cobra cada calzada — `src/world/tools.ts` — commit `00e483b`
- T3 · El consultar de una calle lee el tier efectivo de la banda — `src/sim/report.ts` — commit `00e483b`
- T4 · Tests — `tests/calles-banda.test.ts` — commit `00e483b`

## Log

- **L1** — «Cuando cambias las calles por versiones mejores, a veces quedan "entrecortadas",
  sobretodo cuando son avenidas. En esta foto se ve que hay una calle de tierra, pero el botón de
  consejo dice que es un bulevar.»
- **L2** — Reproducido con `scripts/.avenida.ts` (descartable): avenida de 3 calzadas de tierra,
  bulevar arrastrado por el medio → `x=11: celda=Bulevar · dibujo=Calle de tierra`.
