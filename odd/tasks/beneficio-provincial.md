# Subsidio provincial (telegrama a los $5.000)

## Specs

- S1 (verbatim): «si el total de dinero de un jugador baja de 5k, UNA sola vez reciba un prompt que sea algun "beneficio provincial" o algo asi que te da 15k y uno elige si aceptar o no»
- S2 (verbatim): «me encantó el telegrama provincial, implementá ese» — el modal es el telegrama de la variante V1: papel crema, encabezado de ministerio, cuerpo en máquina de escribir, sello de goma rojo «SUBSIDIO EXTRAORDINARIO · ÚNICO», botón verde de cobro y uno fantasma de rechazo.
- S3: el subsidio se ofrece una sola vez por partida (se marca aunque se rechace, en el save); al aceptar entran $15.000 con aviso de toast; el reloj se pausa mientras el telegrama está abierto y vuelve al cerrarlo. La oferta no compite con un evento pendiente (ese tiene prioridad).

Criterios de aceptación:

- `subsidyDue` es true solo con `cash < 5000` y sin marca previa.
- `takeSubsidy` suma 15000 y deja la marca; después `subsidyDue` es false.
- Un save viejo sin el campo arranca sin subsidio ofrecido (`subsidy ?? false`), y el campo se valida al cargar.
- El telegrama se ve con la forma `telegrama` del modal, distinta de boleta/plaqueta/feriado/mejora.

## Tasks

- C1 — núcleo de sim + save: `src/sim/subsidy.ts` (subsidyDue/takeSubsidy/markSubsidyOffered), `src/config.ts` (`SUBSIDY`), `src/save/save.ts` (campo `subsidy` con default y validación), `tests/subsidio.test.ts` (3 tests, RED→GREEN). Commit: pendiente.
- C2 — telegrama en pantalla: `src/ui/subsidy.ts` (openSubsidy), `src/game.ts` (pauseClock extraído de pauseForEvent + maybeSubsidy en `onNewMonth`), `src/ui/panels.ts` (shape `telegrama`), `src/ui/style.css` (forma del telegrama), `index.html` (fuente Cutive Mono). Commit: pendiente.

Verificación: `npx tsc --noEmit` limpio; suite 1473 tests / 103 archivos en verde. En vivo: fundar ciudad, caja a $4.500, al pasar el mes aparece el telegrama (shape `telegrama`), el reloj queda en 0 mientras está abierto, «Cobrar» suma $15.000 (4.500 → 19.500), deja la marca y reanuda la velocidad; una segunda llamada no lo vuelve a abrir.

## Log

- L1 (verbatim): «habia pensado que si el total de dinero de un jugador baja de 5k, UNA sola vez reciba un prompt que sea algun "beneficio provincial" o algo asi que te da 15k y uno elige si aceptar o no, mas que nada hasta que pueda estabilizarse.»
- L2: el usuario eligió el telegrama (V1) de las tres variantes mostradas; el sello de goma comunica el «una sola vez».
