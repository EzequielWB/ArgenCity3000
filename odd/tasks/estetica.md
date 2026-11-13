# Estética: interfaz fileteada y mapa en pixel art

Objetivo: que el juego deje de verse genérico: mapa en pixel art con contenido argentino e interfaz con fileteado porteño.
Rama: `feat/vertical-slice` · Entrega: commits por unidad en la rama (sin PR pedido) · Runner: `vitest` (`npm test`) · Tipos: `npx tsc --noEmit` · Build: `npm run build`
Prototipos de referencia (no son parte del juego): `estilos.html`, `interfaz.html` y `src/lab/`. Se ven con `npx vite` en `/estilos.html` y `/interfaz.html`.

## Specs

- **S1 — Pedido (verbatim):** "me gustaria hacer cambios a lo que es la estetica, por ahora lo siento muy generico y poco especial. Me gusta como se ve el SimCity 2000 original, esa estetica estilo pixel y siento que estaria bueno algo asi pero mas Argentino". Límite ya fijado en el proyecto: no se copia el look de ese juego (paleta, edificios, texturas); se toma el género: pixel art isométrico.
- **S2 — Estilo del mapa (verbatim):** "Me gusta el diseño BV pero me gustaria que fuera un poco mas saturado" y después "Un 50%". Es el estilo B "Urbana" de `src/lab/main-styles.ts` (`CHOSEN`): sin contornos, volumen por sombras, 50 % más de saturación que el B original; asfalto, vereda, chapa y hormigón quedan grises. Todavía NO está en el juego.
- **S3 — Interfaz (verbatim):** "Me gustaria tambien rediseñar la interfaz, la idea es mantener ese "fileteado porteño"" y, sobre la maqueta `interfaz.html`: "Intermedia A a 100% queda bien. Queres implementarlo?". Lo aprobado es lo que muestra la maqueta con Letra = Intermedia A (Chakra Petch para el texto y las etiquetas, Bungee para los títulos) y Tamaño = 100 %:
  - marco del mapa con cuatro esquinas fileteadas en pixel (voluta dorada, hojas de acanto, flor celeste) y una cinta celeste y blanca con el nombre de la ciudad y la fecha;
  - indicadores como chapas esmaltadas azules (Caja, Población, Aprobación) con su segunda línea (saldo y meses de caja, próximo hito, fecha de elecciones);
  - herramientas agrupadas en cinco categorías que despliegan las suyas: Consulta (consulta, topadora), Calles y luz (calle, tendido), Zonas (residencial, comercial, industrial, plaza), Servicios (escuela, salita, comisaría, bomberos), Usinas (carbón, gas, eólica);
  - diario con cabecera en letra con volumen y una floritura;
  - paneles con forma de objeto: boleta para la noche de elecciones, plaqueta de bronce para el hito, planilla para el presupuesto;
  - frases de filete que cambian, al pie.
  - Supuestos: fondo verde inglés (el que traía la maqueta; el usuario no eligió entre verde y bordó); los atajos de teclado no cambian; todo lo que hoy se puede hacer se sigue pudiendo hacer (bloque, capas, rotar, zoom, deshacer, sonido, partidas, ayuda, aviso de "no llega gente nueva").
- **S4 — Nombre (verbatim):** "lo que si el juego se llama "ArgenCity 3000"". El nombre visible pasa de "ArgentinaCity 3000" a "ArgenCity 3000" (título, logo, mensajes, README). El identificador de las partidas guardadas (`argencity3000`) no cambia.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Prototipos de estilo y de interfaz | S1, S2, S3 | inline | hecho | commit `chore(lab): …`; elegidos por el usuario mirando las páginas |
| T2 Interfaz fileteada en el juego y nombre nuevo | S3, S4 | delegado (writer F: respaldo de contexto del padre) | en curso | — |
| T3 Mapa del juego en pixel art (estilo B +50 %) | S2 | a definir | pendiente | — |

## Log

- **L1 (2026-11-13), pedido original (verbatim):** "Bien, ahora antes de seguir me gustaria hacer cambios a lo que es la estetica, por ahora lo siento muy generico y poco especial. Me gusta como se ve el SimCity 2000 original, esa estetica estilo pixel y siento que estaria bueno algo asi pero mas Argentino, me ayudas? Yo pensaba en que armes algunos diseños de distintas cosas (Terreno, arboles, edificios), los plasmes en imagenes y te digo mas o menos cual me gusta, o ves una mejor manera?"
- **L2 (2026-11-13):** se propuso comparar escenas completas dibujadas por código en vez de piezas sueltas; el usuario: "Dale". Tres direcciones (A Barrio con contorno, B Urbana sin contorno, C Tramado con 28 colores). Eligió B con 50 % más de saturación.
- **L3 (2026-11-13):** maqueta de interfaz con dos fondos, dos tamaños y tres juegos de letra. La primera fuente pixel confundía la C con la O y el 5 con la S. El usuario pidió pantalla completa, probar al 70 % y una letra "punto medio" ("la fuente es demasiado pixel"), y eligió (verbatim): "Intermedia A a 100% queda bien. Queres implementarlo? lo que si el juego se llama "ArgenCity 3000"".
- **L4 (2026-11-13):** el mapa de la maqueta es la escena de prueba; en el juego el mapa sigue con el dibujado actual hasta T3, así que por un tiempo conviven la interfaz nueva y el mapa viejo.
