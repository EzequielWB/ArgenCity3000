# Créditos municipales

Objetivo: que la crisis tenga salida. Hoy la caja en rojo frena las obras (`src/sim/report.ts:165`), corta el
crecimiento (`src/sim/simulation.ts:303`) y cuesta 15 puntos de aprobación (`src/sim/politics.ts:103`): sin plata
no hay forma de recuperarse. El Intendente podrá pedir un crédito y devolverlo en cuotas fijas mensuales.
Rama: `feat/vertical-slice` · Entrega: commits por unidad en la rama (sin PR pedido) · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit`

## Specs

- **S1 — Pedir el crédito (verbatim):** "quiero implementar un sistema de "Creditos" estilo Cities Skylines,
  basicamente podes pedir un credito, te dan plata y lo tenes que pagar". Tres créditos con monto, plazo, cuota
  y **total a devolver visibles antes de aceptar**: chico $10.000 en 24 cuotas, mediano $25.000 en 36, grande
  $50.000 en 48 (valores en `LOANS`, `src/config.ts`). Pedirlo suma el monto a la caja en el acto. **Uno por
  vez:** no se puede pedir otro mientras haya uno en curso.
- **S2 — Cuotas automáticas, plazo fijo (verbatim):** "Cuotas automáticas, plazo fijo". La cuota se descuenta
  sola todos los meses, en partes iguales, hasta cumplir el plazo, y **las cuotas suman exactamente el total**,
  sin sobrante ni faltante por redondeo. El crédito se cierra solo al pagar la última.
- **S3 — La cuota se ve y se contabiliza (verbatim):** "lo tenes que pagar para X fecha". La cuota es **una
  línea más del presupuesto mensual**: aparece en el panel de presupuesto, baja el saldo del mes, acorta el
  "la caja alcanza para N meses" de la barra superior y suma en los gastos del titular del diario. El panel dice
  en qué mes se termina de pagar.
- **S4 — Cancelar el resto (suposición):** suposición mía, aceptada al elegir plazo fijo. Con la caja de por
  medio, el Intendente puede pagar de una todo lo que falta y sacarse la cuota. El monto es exactamente lo que
  queda: total menos las cuotas ya pagadas.
- **S5 — El guardado lo soporta:** el crédito se guarda y se recupera. Las partidas de v4 y anteriores siguen
  abriendo, con o sin crédito en curso.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Créditos y cuotas (puro) | S1, S2, S4 | inline | pendiente | — |
| T2 La cuota dentro del presupuesto | S3 | inline | pendiente | — |
| T3 Pedir, descontar y cerrar en la simulación | S1, S2, S4 | inline | pendiente | — |
| T4 Guardado v5 | S5 | inline | pendiente | — |
| T5 Interfaz, diario y documentación | S1, S3 | inline | pendiente | — |

## Log

- **L1 (2026-11-13), pedido (verbatim):** "Me gustaria que hagas algo sencillo, quiero implementar un sistema de
  "Creditos" estilo Cities Skylines, basicamente podes pedir un credito, te dan plata y lo tenes que pagar para X
  fecha o elegir pagar por mes un porcentaje por interes, que pensas?"
- **L2 (2026-11-13):** el pedido traía un "o" abierto (fecha límite o cuotas con interés). Se preguntó cuál de
  las dos formas y el usuario eligió "Cuotas automáticas, plazo fijo". Se descartó la fecha límite porque su
  consecuencia (¿qué pasa si no llegás?) sería un sistema nuevo de mora, y el pedido era "algo sencillo". La
  cancelación anticipada (S4) cubre el "pagarla antes de X" sin necesitar ese sistema.
- **L3 (2026-11-13):** hallazgo que define el diseño: la cuota entra **dentro** de `monthlyBudget()`, nunca
  restada por afuera. Si entra ahí, el panel de presupuesto, el saldo de la barra superior, el runway de
  `outlook.ts` (que sale del `balance`) y el titular del diario se actualizan solos. Restarla a mano en
  `settleWeek` dejaría dos contabilidades paralelas.
