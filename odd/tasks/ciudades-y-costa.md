# Más ciudades reales y edificios de costa

Objetivo: poder empezar a jugar en varias ciudades argentinas reales, y tener cosas para construir sobre el agua.
Rama: `feat/vertical-slice` · Entrega: commits por unidad en la rama (sin PR pedido) · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit` · Mapas: `npm run bake-maps`
Antecedente: los mapas reales (Mar del Plata) están descritos en `odd/tasks/argencity-3000.md`, S15 y L11.

## Specs

- **S1 — Más ciudades (verbatim):** "te gustaria implementar mas ciudades para empezar a jugar? esta Mar del Plata ahora nada mas." → propuesta de seis, elegidas para que jueguen distinto: "Buenos Aires (centro y puerto): llano, río ancho. Rosario: barranca sobre el Paraná. Córdoba: el río Suquía cruzando la ciudad. Mendoza: pie de monte, con pendiente. Bariloche: lago y montaña, poco lugar llano. Ushuaia: canal y cerros." → respuesta: "Bien, implementá esas zonas". Cada una se prepara con el mismo script que Mar del Plata, viene incluida en el juego, aparece en la pantalla de inicio con su nombre y una línea de descripción, y se puede jugar solo con la geografía o también con las calles. Mar del Plata no cambia. Supuestos: el tamaño (128, 192 o 256 lotes) y los metros por nivel de altura se eligen por ciudad para que el mapa sea jugable (en las de montaña cada nivel representa más metros que en la costa); se mantiene la atribución de OpenStreetMap y del relieve.
- **S2 — Puertos y cosas de mar (verbatim):** "lo que si sabes que falta? antes de seguir con lo de los mapas, falta que haya puertos y cosas de mar para colocar". Qué edificios y qué hace cada uno está por definirse con el usuario.
- **S3 — Elegir una zona en un mapa (verbatim, pedido anterior):** "lo que queria implementar de mirar un mapa, elegir una zona y transformarlo para poder jugar". Queda para después de S2, por pedido del usuario.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Seis ciudades reales | S1 | delegado (writer G: respaldo de contexto del padre; corre junto con la interfaz, superficies separadas) | en curso | — |
| T2 Edificios de costa | S2 | a definir | pendiente de diseño | — |
| T3 Elegir una zona en un mapa | S3 | a definir | pendiente | — |

## Log

- **L1 (2026-11-13), pedido (verbatim):** "Ehhh, te gustaria implementar mas ciudades para empezar a jugar? esta Mar del Plata ahora nada mas. Aparte lo que queria implementar de mirar un mapa, elegir una zona y transformarlo para poder jugar, que onda? muy dificil?" y después "Bien, implementá esas zonas, lo que si sabes que falta? antes de seguir con lo de los mapas, falta que haya puertos y cosas de mar para colocar".
- **L2 (2026-11-13):** dicho al usuario sobre S3: el conversor ya existe (`scripts/bake-maps.ts`, `scripts/mapgen/geo.ts`); faltaría un mapa navegable para elegir el recuadro, pedir los datos desde el navegador (los servidores públicos de calles tardan y a veces están saturados) y confirmar que el servidor de relieve acepta pedidos desde una página; el juego pasaría a depender de internet para esa opción y nadie revisa el resultado.
