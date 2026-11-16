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

- [x] T1 — S1, S2 — inline — Fábrica sin controles y descanso de 3 eventos, guardado y tests. Commit fa09c8c.
- [x] T2 — S3 — inline — Casos nuevos con sus condiciones y tests.

## Log

- L1 (2026-11-15, usuario): "Me gustaria modificar los eventos aleatorios. Primero el de la fabria que derrama en el agua no se que, prefiero hacerlo mas universal ya que actualmente sale aunque no derrame necesariamente en el agua, podria ser algo como que no respeta las normas de seguridad y contamina mas o algo asi. Tambien me gustaria agregarles un "cooldown" a cada evento, ya que ese de la fabrica me salio 5 veces seguidas, me gustaria que una vez que sale un evento, recien despues de 3 eventos pueda volver a salir, que opinas? (es decir se libera la posibilidad que salga) Y me gustaria agregar mas eventos"
- L2: Exploración: `pickEvent` (src/sim/events.ts) sortea entre los casos cuya condición se cumple, con 30 % de chance por mes y 8 meses entre eventos; solo algunos casos tienen un descanso propio por tiempo (`coolOf`). Un evento con condición que sigue cumpliéndose se repite, y por eso el de la fábrica salió tantas veces. Con la regla nueva, si un caso es el único que cumple su condición, sale una vez y no vuelve hasta que otros 3 hayan salido: más casos amplían ese margen.
- L3: T1 hecho. El id del caso de la fábrica pasó de `derrame` a `fabrica-sin-controles`; una partida guardada con el caso viejo pendiente lo perdería (`eventById` no lo encuentra y se ignora), lo cual no importa por lo hablado antes. El descanso vive en `SimState.recentEvents` y las partidas anteriores cargan con la lista vacía. Con el filtro desactivado fallan 2 tests.
- L4: T2 hecho: 8 casos nuevos (paro docente, paro de colectivos, barro en las calles, brote de gripe, granizada, un shopping, un acto en la plaza y pantalla gigante). Total 23. El paro de colectivos y el barro se apoyan en las líneas de colectivos y en las calles de tierra. `tsc` y 764 tests pasan.

## Corrección: la mitad de seguido

> "los eventos aleatorios que sean la mitad de frecuentes, se vuelven muy pesados"

La espera entre dos casos es `gap + 1 / chance` meses: con `gap: 8` y `chance: 0.3` daba 11,3 meses.
Ahora `gap: 16` y `chance: 0.15` dan 22,7, o sea la mitad.

No hay medición de punta a punta de esto: en el pueblo de prueba las únicas ocho decisiones que
aparecieron en treinta años fueron feriados, porque casi ningún caso aleatorio tiene su `when`
satisfecho a esa escala. El cambio se apoya en la aritmética de la espera, no en un conteo observado.
