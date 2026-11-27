# INFORME QA — Argencity 3000 (pruebas headless)

Fecha: 2026-11-17 · Suite base: **103 archivos de test, 1478 tests, todos verdes** (`npx vitest run`) tras aplicar las correcciones A1/A2/A3.

## Correcciones aplicadas (post-informe)

| Hallazgo | Corrección | Evidencia |
|---|---|---|
| 🔴 A1 foco grande perdido al cargar | `bigFire` vive en `SimState` y viaja en el save (versión 22); saves ≤21 siguen leyéndose (quemado común, como antes) | `tests/save.test.ts` + `qa-save.ts` §3: original y restaurada queman igual con cobertura |
| 🟡 A2 stats de fuego | `fireStats` en `SimState`, serializado; saves viejos abren en 0 | `tests/save.test.ts` + `qa-save.ts` §2: quemados 2/2 idénticos |
| 🟡 A3 calle suelta de colectivos | nueva `servedStreet()` en `world/transport.ts`: la red de la cochera tiene que llegar a un lote atendido; la usa `applyTransit` y la ficha de la cochera | `tests/colectivos-global.test.ts` + `qa-adversarial.ts` §2: la baldosa de $10 deja la cochera ociosa (500) y la cochera servida sigue dando el alivio completo |

Efecto colateral de A3 (intencional): la ficha de la cochera ahora dice «Su calle no llega a ningún edificio: no funciona» en vez de «Sin calle a 3 lotes», y un depósito en un barrio recién zonificado (sin edificios) queda ocioso hasta que llegue gente — coherente con el diseño de que los colectivos corren donde hay viajeros.

## Modelado: revisión visual y de solapado (post-informe)

Ficha de modelos: `qa-modelos.html` + `qa-modelos-sheet.ts` (correr `npm run dev` y abrir `/qa-modelos.html`). Renderiza todos los pintores sobre su huella isométrica y audita por píxeles el sangrado fuera de la huella.

- **M1 — Anclaje y solapado: bien.** Auditoría de caja alfa contra el rombo de la huella en ~90 sprites (zonas 1–5 × 8 variantes, servicios, usinas, depósitos, postes, árboles, costa, hubs, vehículos, los 10 únicos, estados de abandono/fuego): todos quedan dentro de su lote. Únicas excepciones, de diseño: el muelle de pescadores sangra +3 px hacia el agua (el espigón sale al río) y el Calvario +3 px en la silueta del cerro.
- **M2 — Las piezas de aeropuerto/puerto no pueden desalinearse.** Cada pieza es un recorte de UNA pintura de la instalación completa (`paintHubPiece`), así que la costura entre piezas no existe: los mismos píxeles salen del mismo dibujo. Verificado en código y a la vista.
- **M3 — Progresión de niveles legible y estados derivados.** R1 casilla → R5 torre y C1 kiosco → C5 bar se distinguen bien; las 8 variantes de R5/C5 varían tapas y carteles sin romper la paleta. Abandono y fuego se derivan de la base con filtros (`abandonedOf`/`burningOf`), así que nunca divergen del edificio original.
- **M4 — Escenas de conexión correctas.** Casas contra la calle, lote+silo+feria pegados, cochera 2×2 con vehículos encima, usina con postes y línea, hospital 3×3 contra la calle y cabildo 3×2: sin intersecciones ni huecos.
- **M5 — observación de diseño: los sprites no rotan con la cámara.** La rotación (tecla del juego) gira el mapa pero cada edificio muestra siempre la misma fachada (los pintores no tienen parámetro de vista, salvo las piezas de hubs por `side`). La luz está fijada a la pantalla (el terreno pinta «iluminado arriba-izquierda» en coordenadas de vista), así que es coherente; igual conviene saberlo: a 180° todo edificio muestra el mismo frente.
- **M6 — detalle menor:** las 8 variantes de R5 son torres casi iguales (varían remate y antena); C5 e I tienen mucha más variedad de color. Si algún día se quiere más diferencia entre torres, ahí es.

## Tránsito: revisión extendida (post-informe)

Probe: `qa-transito.ts` (correr con `npx vite-node qa-transito.ts`), salida completa en `qa-transito.txt`. Dos partes: 12 años orgánicos con bot (uno pasivo, uno que reacciona comprando colectivos y bulevares) y una grilla sintética pura (`computeCongestion`) para barrer palancas a magnitud.

### Cómo se comporta con el tiempo (parte 1)

- La ciudad crece sana hasta ~3.200 pop (peor calle 111 %), y ahí el atasco se vuelve estructural: la población **se aplanta en ~5.200** con peor calle oscilando 120–190 % y 54–60 % de viajeros atascados, año tras año. `jamGrowthFactor` (lento desde 90 %, piso 0,25) es el freno: el juego usa el tránsito como límite de crecimiento, no como riesgo a evitar.
- Comprar colectivos apenas cambia la curva: el bot reactivo (4 líneas) termina con atascados 76 % vs 54 % del pasivo (más población y abandono por la caja gastada); peor calle casi idéntica. No es un bug de la compra: es el techo del diseño (ver T2).

### A qué magnitud explota (parte 2)

Con torres llenas y trabajo concentrado en el centro (el patrón de la captura): 14 mil viajeros ya van al 249 %; a 32 mil el peor llega al tope de 255 % y a 83 mil el 96 % de los viajeros cruza una celda atascada. La saturación NO es uniforme: son celdas puntuales (18 de ~700 en la referencia) donde se acumulan los pasajes de muchas manzanas hacia el mismo destino.

### Por qué se atasca igual con avenidas cada 2 manzanas (la captura)

1. **T1 — La ruta es única: la más corta.** Cada manzana manda sus viajeros al comercio y a la fábrica **más cercanos** (BFS desde los destinos, árbol único). No hay redistribución por congestión: una avenida paralela vacía a 4 celdas se queda en 0 % mientras el pasillo de al lado se aplasta (demo §4: pasillo 107 %, paralela 0/0/0/0). Por eso «avenidas cada 2 manzanas» no reparte nada — sólo sirve la avenida que está EN el camino más corto. Reparación de diseño: repartir el destino entre los k comercios más cercanos, o recalcular con penalización por celda atascada (2 pasadas).
2. **T2 — Los colectivos tienen techo y van diluidos.** El alivio es proporcional sobre TODAS las calles (el alivio `r` sobre carga total `t` deja cada calle en `(1 − r/t)`) y la flota entera está topeada a `BUS.share` (35 %) de los viajeros. Con pasajes que cruzan 3–5 celdas, la carga total es 3–5× los viajeros: 4 líneas alivian ~11 % y **32 líneas alivian lo mismo** (medido: 4, 8, 16 y 32 líneas → idéntico 176 % / 50 %). Además `BUS.radius` (14 lotes) está en config y nadie lo usa — el alivio por zona que la ficha insinúa no existe.
3. **T3 — Bulevar y ancho ayudan, pero no curan solos.** Dobles de bulevar en todas las calles: 198→155 %, atascados 62→44 %. Ancho 4: 37 %. La banda cobra por su celda más débil: una sola de tierra en la avenida la tira a ×0,5 (medido: +2 celdas atascadas).
4. **T4 — Las palancas que sí curan** (ciudad de referencia, 12 mil viajeros):

| Palanca | Peor calle | Atascados |
|---|---|---|
| Base (dobles de bulevar cada 2 manzanas) | 198 % | 62 % |
| + cualquier cantidad de colectivos | 176 % | 50 % |
| Comercio/fábrica desparramado por el barrio | 147 % | 36 % |
| Torres de nivel 4 en vez de 5 | 84 % | **0 %** |
| Combo: desparramar + bulevares todas + 8 líneas | 77 % | **0 %** |

Desparramar el trabajo acorta y reparte los caminos; bajar densidad baja la generación de viajes (torre nivel 5 = 160 viajeros, nivel 4 = 60, casita nivel 1 = 3). El presupuesto de calles importa ±20 % (60 % → 247 %; 110 % → 188 %).

### Qué puede hacer el jugador (para la partida de la captura)

1. Desconcentrar el centro amarillo: comercios y fábricas chiquitas intercalados en cada manzana de casas (es la palanca más fuerte, y gratis).
2. Cortar densidad en el borde del atasco: no subir a nivel 5 todo lo que rodea las celdas rojas.
3. Los colectivos que ya tiene están rindiendo su techo: más líneas no van a hacer nada (medido).
4. Revisar que no haya una celda más débil (tierra/asfalto) dentro de cada bulevar: la banda entera cobra por la peor.
5. Presupuesto de calles en 100 %+.

### Qué puede hacer el juego (estado del reparto)

- **T1 fix — APLICADO** (después de esta revisión): reparto de destinos en 3 grupos por cercanía (peso inverso al cuadrado de la distancia) y reparto entre salidas empatadas de cada lote. Efecto medido con el mismo probe: la avenida paralela del demo pasa de 0 % a llevar su parte y el pasillo baja de 107 % a 88 %; a escala (ciudad de referencia), desparramar trabajos baja atascados 36→22 %, ancho 4 queda en 98 %/0 % atascados y el combo en 57 %/0 %; la orgánica pasiva termina con peor 113 % (antes 190 %). Probe: `qa-transito.ts`, salida en `qa-transito.txt`. Ejemplo visual del antes/después y la rampa de crecimiento: `qa-reparto-visual.html` (también en el chat).
- **T2 fix pendiente**: alivio de colectivos por zona (usar `BUS.radius`, que sigue muerto en config) o por corredor en vez de proporcional global, y/o subir el tope `BUS.share` con población.
- Etiquetar `jamGrowthFactor` como decisión: aún con reparto, el equilibrio de toda ciudad madura sigue siendo el atasco (piso 0,25, `slowFrom` 90); si no es la intención, son las dos variables a mover.

## Cómo reproducir

Todo el QA es headless y determinista (RNG por semilla). Scripts en la raíz del proyecto:

| Script | Qué mide | Comando |
|---|---|---|
| `qa-campo.ts` | Cadena Lote→Silo→Feria: trigo vs soja vs mixto × orden de venta × semillas | `npx vite-node qa-campo.ts 20` |
| `qa-deuda.ts` | Mecánica de los 3 créditos, bucle de refinanciación, subsidio único | `npx vite-node qa-deuda.ts` |
| `qa-soak.ts` | 100 años × 2 instancias: NaN/Infinity, drift, determinismo, rendimiento | `npx vite-node qa-soak.ts 100` |
| `qa-save.ts` | Guardar/cargar con préstamo, stock, evento pendiente, incendios | `npx vite-node qa-save.ts` |
| `qa-adversarial.ts` | Red eléctrica, colectivos aislados, avenidas, Ctrl+Z | `npx vite-node qa-adversarial.ts` |
| `scripts/gov-probe.ts` | Matriz de gobiernos (bot de ciudad planificada) | `npx vite-node scripts/gov-probe.ts 25 --styles=... --kinds=... --seeds=2` |

Salida cruda de la matriz de gobiernos: `qa-gobiernos.txt`.

## Hallazgos, rankeados

### 🔴 A1 — Guardar/cargar cambia el resultado de un incendio grande (BUG confirmado)
`src/sim/simulation.ts` — el set interno `bigFire` no se serializa (el valor `fire[i]=90` es ambiguo: 90 también es fuego común sin cobertura). Al cargar en medio de un incendio grande, el foco se vuelve un fuego común.
- Medido (`qa-save.ts`, sección 3): foco grande con **cuartel de bomberos cubriendo la celda** — la partida original lo deja en ruinas (nivel 0); la restaurada lo **salva** (nivel 3). El resultado del fuego depende de si la partida pasó por un guardado.
- Fix sugerido: serializar `bigFire` (lista de índices) o un byte por celda (fuego grande vs común).

### 🟡 A2 — Las estadísticas de fuego no viajan en el guardado (BUG menor)
`stats = { firesStarted, firesSaved, buildingsBurned }` vive en la instancia de `Simulation`, no en `SimState`: tras cargar arranca en 0. Único uso encontrado: `src/game.ts:288` (sonido de incendio). Divergencia detectada en la continuación determinista (`qa-save.ts` secciones 1 y 2: todo lo demás — caja, grillas, silos, préstamo, cosecha, aprobación — continúa idéntico).

### 🟡 A3 — EXPLOIT de colectivos: $10 de asfalto suelto activa el alivio completo (confirmado)
`src/sim/transit.ts` / `src/world/transport.ts` — `streetNear()` acepta cualquier calle a distancia Manhattan ≤ 3 de la cochera, aunque esté **desconectada de la red**: la flota entera corre igual (el alivio es global por diseño).
- Medido (`qa-adversarial.ts`, sección 2): cochera en la red = alivio 500 viajeros; cochera en el baldío + 1 celda de asfalto pegada = alivio 500 (idéntico); sin celda pegada = 0.
- Costo del exploit: $10. La intención del diseño (cocheras necesitan estar servidas) se cumples a medias: hay calle, pero no conectividad real.
- Fix sugerido: exigir conectividad al resto de la red (BFS desde la cochera hasta otro nodo con tránsito), o al menos más de una celda de calle.

### 🟡 A4 — Balance del campo: la soja domina en esperanza (1,86×) y guardar siempre conviene (medido)
`src/sim/campo.ts` / `src/config.ts` — 20 años × 3 climas (semilla por nombre de ciudad), 48 lotes + 5 silos + 1 feria (`qa-campo.ts`):

| Perfil | Orden | Ingreso bruto medio | Peor año | Neto/año |
|---|---|---|---|---|
| Trigo 100 % | vender en cosecha ($120) | $17.280 | $17.280 (0 varianza) | $15.894 |
| Trigo 100 % | minPrecio $160 | $20.460 | $20.460 | $19.074 |
| Soja 100 % | vender en cosecha | $30.670 | $0 (12 % de los años) | $29.284 |
| Soja 100 % | minPrecio $160 | $36.858 | $0 (12 % de los años) | $35.471 |

- **La soja no arruina la partida**: los años en cero (sequía/plaga, 12 % aquí) los aguanta el capital acumulado; en esperanza rinde **1,86× el trigo**. El dado `CLIMATE = {full: 0.6, half: 0.2}` da esperanza 0,7 → soja esperada 5,6 t/lote contra 3,0 del trigo. Para emparejar el riesgo: soja ~4,3 t/lote, o subir la frecuencia de plaga.
- **`minPrecio $160` domina siempre**: con merma 4 % mensual, esperar al techo ($180 en junio) gana +18 % (trigo) y +21 % (soja). El precio tiene forma (correcto), pero la merma es demasiado blanda para castigar la espera en esta escala; solo muerde cuando el stock espera >6 meses (merma medida 20–35 t/año, ~10 %).
- **La soja desborda el silo**: con 5 silos (300 t) y 48 lotes de soja (384 t/año), se pierden ~59 t/año por falta de silo. El número de silos es una decisión real (bien).
- **El campo es plata sin ciudad**: 48 lotes + silos + feria, sin población, rinden $16–35 k/año netos y se pagan solos en ~6 meses. Por celda no es desbalanceado ($89–183/celda/año contra $739 de torres), pero no pide luz, agua, calles (más que un camino al silo) ni servicios: es la jugada "rentista" válida. Si no es intencional, subir el mantenimiento del lote o exigir camino directo lote→silo.

### 🟢 B1 — Créditos y subsidio: sin bucles (verificado)
`src/sim/loans.ts` / `src/sim/budget.ts` / `src/sim/subsidy.ts` (`qa-deuda.ts`):
- Los 3 créditos pagan **exactamente** `loanTotal` en cuotas de a $1 de redondeo alternante (541/542), cierran en el mes justo, sin cuotas de más ni crédito fantasma.
- Tomar créditos **nunca renta**: cada ciclo deja −$3.000 − 24·déficit. Verificado con déficit de $342 a $547/mes.
- La refinanciación en cadena no es un bucle infinito: la caja se sangra y el juego termina por derrota electoral/derrocamiento (mes 46 en el test) o intervención a los 12 meses en rojo (`BANKRUPT_MONTHS`). No se observó refinanciación eterna.
- El subsidio provincial se cobra **una sola vez**: segundo `takeSubsidy` = $0, y no vuelve a ofrecerse aunque la caja vuelva a bajar de $5.000. Correcto.

### 🟢 B2 — 100 años sin NaN/Infinity y determinismo exacto (verificado)
`qa-soak.ts` — 100 años × 2 instancias idénticas (semilla 7): **cero** valores no finitos en caja, aprobación, favor, presupuesto completo (26 campos), demanda, luz, congestión, landValue, pollution, crime, edu, health, traffic, jam, fireCover; **cero** drift no entero en caja (−$389.634 idéntico en ambas); grillas del mundo idénticas entre instancias año a año (hash FNV). Rendimiento: ~0,39 ms/tick (≈0,25 s/año) a pop 2.000.

Nota de diseño observada: una ciudad sin avenidas satura al 80–90 % de tránsito y el bot sin gestión muere en cascada de abandonos hacia el año 70–85 (coincide con lo documentado en `PLAN-GOBIERNOS.txt` §0 y el modo `BOT=avenidas` del probe). Es la regla del juego, no un bug.

### 🟢 B3 — Ctrl+Z: reembolsos exactos y conservación de caja (verificado)
`src/world/history.ts` (`qa-adversarial.ts`, sección 4):
- Undo inmediato: reembolso **completo** ✓. Undo a los 2 meses: **mitad** ✓. A los 13 meses: la ventana vence y limpia el historial ✓.
- Conservación: gastado − reembolsado == baja de caja, exacto.
- El terreno que el zonificado empareja (130 celdas junto a la costa) se restaura **idéntico** al deshacer ✓. No se encontró fuga de plata ni corrupción de elevación.

### 🟢 B4 — Red eléctrica: sin luz gratis (verificado)
- Poste suelto sin usina en el mapa: 0 lotes encendidos ✓.
- Tendido suelto a 28 celdas de la única usina: 0 lotes encendidos ✓ (el tendido no electrifica aire).
- Eficiencia medida (lotes encendidos por $100, instalación + 24 meses de mantenimiento): **madera cada 3 postes encadena y es el mejor patrón (9,94)**; madera continua 3,32; hormigón cada 5 4,50; el mixto madera+hor­migón 1,16 (caro). Alternar calidades no explota nada: lo que manda es encadenar postes dentro del alcance de cada calidad.

### 🟢 B5 — Avenidas: el carril débil muerde la banda (según diseño, medido)
`src/sim/congestion.ts` — avenida de 3 carriles con tráfico forzado a cruzarla: una **sola** celda de tierra en el carril cargado lleva la peor calle de 66 % a **114 % y el 100 % de los viajeros atascados**. El alcance es la franja de 3 carriles de esa columna (como dice el diseño: la banda es tan buena como su peor celda); el resto de la avenida no se degrada.

## Pendiente (fase con navegador)
- Picking isométrico con relieve alto (clics en mapas sierras/gran relieve) y responsive móvil: requiere el preview interactivo; la lógica ya está cubierta por `tests/picking.test.ts` (grilla, no píxeles).

## S1 — Formas de gobierno: matriz ampliada (40 corridas de 25 años)

`scripts/gov-probe.ts` — 5 gobiernos × 2 estilos de jugador (agresivo, equilibrado) × 2 mapas (coast, sierras) × 2 semillas, con el bot de ciudad planificada:

| Gobierno | Pico mediano | Caja mediana | Abandonados | Perdió el poder |
|---|---|---|---|---|
| democracia | 1.758 | −$672.643 | 331 | 100 % |
| dictadura | 1.174 | −$583.580 | 254 | 100 % |
| tecnocracia | 1.991 | −$650.221 | 320 | 100 % |
| teocracia | 1.724 | −$603.679 | 320 | 100 % |
| comunismo | **55.804** | **+$19.272** | 0 | 100 % |

Lectura (consistente con la tabla de 120 corridas de `PLAN-GOBIERNOS.txt`):
- **Sólo el comunismo tiene motor** (pico 50–67 mil, caja positiva, cero abandonados). Los otros cuatro se estancan en 1,1–2 mil habitantes y mueren igual: la caja en rojo → enojo → abandonos en cascada → derrota o derrocamiento. Hoy **no son “una forma distinta de jugar”**: son el mismo juego con otra carda de Gobierno, y pierden siempre.
- La dictadura/teocracia hoy **también caen 100 %** (derrocamiento por piso de aprobación): en la matriz vieja del PLAN caían 0 %. Con el préstamo municipal en el medio, el bot queda igual en rojo y la aprobación se hunde — la “ventaja” de no votar no alcanza si la caja muere.
- El comunismo pierde el poder al 100 % igual (su Congreso pide 40 % y la aprobación vive en ~34, según PLAN): crece pero no termina mandato. Es el único con caja positiva y cero abandonados.
- El bot toma el crédito chico cuando puede y aun así termina en −$580 k: el crédito retrasa la intervención (B1) pero no salva una economía sin motor.

## Cobertura del resto del pedido
- Paros de colectivos/docentes como estado activo al guardar: el evento pendiente viaja como id en el save (`pendingEvent`) y la continuación fue idéntica (sección 1 de `qa-save.ts`).
- Saturación 2/3+ carriles: cubierto por B5 y `tests/congestion.test.ts` / `tests/avenue.test.ts` (verdes).
- Alternancia madera/hormigón para maximizar cobertura: cubierto por B4 (no explota).
