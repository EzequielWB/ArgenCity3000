# Eventos aleatorios: la fábrica universal, un descanso entre repeticiones y más casos

Objetivo: que el evento de la fábrica no dependa del agua, que un evento no se repita enseguida y
que haya más variedad de casos.
Rama: `feat/vertical-slice`. Entrega: `ask-on-risk` (commits por unidad en la rama; push y merge los decide el usuario).
Runner: `npx vitest run`, `npx tsc --noEmit`.

## Specs

### S1 — La fábrica, sin el agua

> "el de la fabria que derrama en el agua no se que, prefiero hacerlo mas universal ya que actualmente sale aunque no derrame necesariamente en el agua, podria ser algo como que no respeta las normas de seguridad y contamina mas o algo asi."

- El caso ya no habla de un derrame ni del arroyo: una fábrica no respeta las normas de seguridad y
  contamina más. No exige agua cerca: sale en cualquier mapa con industria y humo.
- Las dos salidas siguen siendo clausurarla (la más contaminante queda abandonada) o multarla y que siga.

### S2 — Descanso entre repeticiones

> "me gustaria agregarles un "cooldown" a cada evento, ya que ese de la fabrica me salio 5 veces seguidas, me gustaria que una vez que sale un evento, recien despues de 3 eventos pueda volver a salir, que opinas? (es decir se libera la posibilidad que salga)"

- Cuando sale un evento, no puede volver a salir hasta que hayan salido otros 3 eventos distintos.
  Se cuenta en eventos que salen, no en tiempo.
- Los últimos 3 eventos se guardan en la partida, así que el descanso sigue después de cargar.

### S3 — Más eventos

> "Y me gustaria agregar mas eventos"

- El catálogo suma casos nuevos, cada uno con dos salidas, su consecuencia escrita y una condición
  que lo hace propio de esa ciudad. Algunos se apoyan en lo último que se agregó: las calles de
  tierra y las líneas de colectivos.

## Tasks

- [ ] T1 — S1, S2 — inline — Fábrica sin controles y descanso de 3 eventos, guardado y tests.
- [ ] T2 — S3 — inline — Casos nuevos con sus condiciones y tests.

## Log

- L1 (2026-11-15, usuario): "Me gustaria modificar los eventos aleatorios. Primero el de la fabria que derrama en el agua no se que, prefiero hacerlo mas universal ya que actualmente sale aunque no derrame necesariamente en el agua, podria ser algo como que no respeta las normas de seguridad y contamina mas o algo asi. Tambien me gustaria agregarles un "cooldown" a cada evento, ya que ese de la fabrica me salio 5 veces seguidas, me gustaria que una vez que sale un evento, recien despues de 3 eventos pueda volver a salir, que opinas? (es decir se libera la posibilidad que salga) Y me gustaria agregar mas eventos"
- L2: Exploración: `pickEvent` (src/sim/events.ts) sortea entre los casos cuya condición se cumple, con 30 % de chance por mes y 8 meses entre eventos; solo algunos casos tienen un descanso propio por tiempo (`coolOf`). Un evento con condición que sigue cumpliéndose se repite, y por eso el de la fábrica salió tantas veces. Con la regla nueva, si un caso es el único que cumple su condición, sale una vez y no vuelve hasta que otros 3 hayan salido: más casos amplían ese margen.
