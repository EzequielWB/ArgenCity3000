# Teocracia y Comunismo

Objective: two new forms of government. Branch: feat/vertical-slice. Delivery: ask-on-risk. Runner: `npx vitest run`.

## Specs

- S1. "quiero agregar ahora dos tipos de gobierno, Teocracia y Comunismo"
- S2. "Para teocracia me gustaria hacer una mecanica especifica de "Aprobación de Dios" que basicamente sea una medida extra que hace que si baja (por malas acciones, malas politicas basicamente) ocurran "catastrofes"" (incendios en un area, abandono en otra, disminución de dinero por mes y cosas asi) "y lo msimo con un bonus alto"
- S3. "que el marco de Aprobación divina tenga un aspecto "Divino" medio blanco y letritas doradas, con buen contraste y respetando la estetica, no super increible sinó cambiado."
- S4 (proposal accepted with "Hacelo dale los dos juntos"): Teocracia has no elections, people's approval capped at 80, half the grants, 10 % fewer newcomers; Favor divino 0-100 (starts at 62) moves 4 points a month to a target made of virtues (green spaces, health, charity, black cash) and sins (smoke, crime, demolitions, usury, abandonment, red cash); under 35 a catastrophe may fall each month, over 65 a miracle may come. The three virtues add up to `100 - base` so a perfect city reaches 100 (L7).
- S5 (same proposal): Comunismo has a five-year plan (an industrial jobs goal, premium or penalty), services cost 30 % less, approval barely moves, factories pay more tax, shops pay half, 25 % fewer newcomers, no grants, a party congress every 5 years with 40 % to stay.

## Tasks

- T1 (S4, S5) config + budget factors + save: inline
- T2 (S2, S4) favor.ts and its catastrophes and miracles in the simulation: inline
- T3 (S5) five-year plan: inline
- T4 (S3) UI: the divine box, panels, government cards, help: inline
- T5 tests and visual check: inline

## Log

- L1 (2026-11-15) "Hacelo dale los dos juntos, lo que si hacé que el marco de Aprobación divina tenga un aspecto "Divino" medio blanco y letritas doradas, con buen contraste y respetando la estetica, no super increible sinó cambiado."
- 2026-11-15 T1-T3 done in 0598dfb (config, budget factors, favor.ts, plan.ts, save v17, 15 tests in tests/gobiernos.test.ts). T4: divine plaque (ivory, gold letters), approval panel sections, README; checked on screen at 1280x720 and 390x760. 828 tests pass.
- L6 (usuario, 2026-11-16): "la tecnocracia actualmente no cambia casi nada, solo votaciones cada 6
  meses, estaria bueno algun tipo de beneficio con la educacion ... la 1 y la 3 me gusta". La
  tecnocracia era una democracia con mandato más largo y la aprobación a media velocidad: solo costos.
  Ahora tiene identidad económica: `taxIncome` 1,1 en los tres rubros ("sin evasión") y `serviceCost`
  0,9 ("administración técnica"), y un `fundingFloor` de 80 para escuelas y universidad que se aplica
  en `setFunding`, en el mínimo del slider (`panels.ts`) y al cargar una partida anterior al cambio.
  El piso es pro y contra a la vez, y la tarjeta lo dice en los dos lados: "la educación no se toca"
  arriba, "el piso se paga igual con la caja en rojo" abajo. Cuatro pros y cuatro contras.

- L7 (usuario, 2026-11-16): "hace t1,t2,t5 y hace las catastrofes un poco menos fuerte y estamos". Tres
  correcciones sobre S4, medidas en `tests/gobiernos.test.ts`:
  - **El favor tapaba en 81.** Las virtudes sumaban 8 + 6 + 12 sobre una base de 55, así que la
    franja 82-100 del medidor era un tramo de aguja que nadie pisaba nunca; y como
    `judgementChance` divide por `100 - grace`, la chance máxima de milagro era 36 % y no 50 %.
    Ahora los pesos tienen nombre en `FAVOR` (`charity 15`, `lowTaxes 10`, `gardens 20`) y suman
    exactamente `100 - base`; un test sostiene la suma. Los impuestos bajos pasan a ser
    proporcionales a `DEFAULT_TAX` y las plazas puntúan contra `MAX_FUNDING` (120 %), que es el
    tope real del control.
  - **Los milagros pasan de 66 a 65**, que es lo que el documento decía desde el principio (75 en
    el README original, 66 en el código): las tres cifras nunca habían coincidido. README línea 45
    y línea 96 corregidas.
  - **El favor es un poco mejor**: arranca en 62, tolera 12 de humo y delito, llama usura recién
    arriba de 14 y sale del furor a 4 puntos por mes en vez de 3.
  - **Las catástrofes pegan menos**: rayos 8 lotes → 6, plaga 20 edificios → 14, sequía −30 % →
    −20 %, revuelta −14 → −10. Las magnitudes pasaron a `wrathFires`, `wrathSick` y
    `wrathApproval` en `favor.ts` para poder sostenerlas con un test en vez de esconderlas en el
    `slice()` de la simulación.
