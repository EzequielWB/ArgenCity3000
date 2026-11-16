/**
 * The mini tutorial: when a new city opens it asks, before the founding window, whether the player
 * wants a quick read of how to start, and if so shows the goal and four pictures taken from the
 * game itself. Whatever the answer, `onDone` runs when the window closes.
 */
import { closeModal, openModal } from './panels';

export interface TutorialStep {
  title: string;
  text: string;
  /** File under `public/tutorial/`. */
  image: string;
  alt: string;
}

export const TUTORIAL_GOAL =
  'Tu objetivo, Intendente: mantener contentos a los vecinos y hacer que la ciudad genere plata para seguir creciendo. Si los vecinos se enojan o la caja queda en rojo, la ciudad se frena.';

/** Said under the pictures, so a player who is still lost knows where to look. */
export const TUTORIAL_HELP = 'Si te queda alguna duda, en cualquier momento tenés el botón Ayuda de la interfaz (en el celular está dentro del menú ☰).';

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: '1. Empezá por una calle',
    text: 'Trazá una calle arrastrando desde la ruta provincial. Tiene que salir de la ruta: por ahí llegan los vecinos nuevos.',
    image: 'calle.webp',
    alt: 'Una calle que se traza arrastrando desde el borde de la ruta provincial, con su costo.',
  },
  {
    title: '2. Después, la luz',
    text: 'Sin luz no se construye nada. La usina alumbra unos 3 lotes a su alrededor (el halo amarillo), así que ponela cerca de donde vas a construir. Un lote lejos queda sin luz (en rojo): llevásela con el tendido eléctrico. Los edificios con luz también alumbran a sus vecinos.',
    image: 'usina.webp',
    alt: 'Una usina con su halo de luz amarillo, un lote cercano con luz y un edificio lejano marcado en rojo porque no tiene.',
  },
  {
    title: '3. Zonificá',
    text: 'Marcá zonas pegadas a la calle: residencial para las casas, comercial para los negocios e industrial para las fábricas. Los edificios aparecen solos, empiezan humildes y mejoran con los años. Con la herramienta Consulta tocá cualquier edificio y ves sus detalles y qué le pasa: por qué no crece, o qué significa el globito que tiene arriba.',
    image: 'zonas.webp',
    alt: 'Tres zonas junto a una calle, marcadas R, C e I, con casas, comercios y tinglados que ya aparecieron.',
  },
  {
    title: '4. Cuidá la caja',
    text: 'En el Presupuesto ves cuánto entra y cuánto sale cada mes, y podés subir o bajar los impuestos y lo que se gasta en servicios. Tratá de no cerrar el mes en rojo.',
    image: 'presupuesto.webp',
    alt: 'El panel de Presupuesto municipal, con los ingresos y gastos del mes y los controles de impuestos.',
  },
];

/**
 * The four steps, with the first one told for the map at hand. A real-city map is a section of a city
 * that already has its streets and no provincial route, so there the street is drawn from any of them.
 */
export function tutorialSteps(hasRoute: boolean): readonly TutorialStep[] {
  if (hasRoute) return TUTORIAL_STEPS;
  return [
    {
      ...TUTORIAL_STEPS[0],
      text: 'En un mapa de ciudad real no hay ruta provincial: la ciudad ya viene con sus calles, y por ellas también llegan los vecinos nuevos. Zonificá pegado a las que haya y, si te falta una, trazála desde cualquiera de ellas.',
      alt: 'Una calle que se traza desde una calle que ya existe en el mapa real, con su costo.',
    },
    ...TUTORIAL_STEPS.slice(1),
  ];
}

/** The tutorial itself: the goal on top, the four pictures below. */
export function openTutorial(hasRoute: boolean, onDone?: () => void): void {
  const base = import.meta.env.BASE_URL;
  const steps = tutorialSteps(hasRoute).map(
    (s) => `<figure class="tuto-step"><img src="${base}tutorial/${s.image}" alt="${s.alt}" loading="lazy" /><figcaption><strong>${s.title}</strong><span>${s.text}</span></figcaption></figure>`,
  ).join('');
  const body = openModal(`
    <h2>Cómo arrancar tu ciudad</h2>
    <p class="tuto-goal">${TUTORIAL_GOAL}</p>
    <div class="tuto-grid">${steps}</div>
    <p class="tuto-help">${TUTORIAL_HELP}</p>
    <div class="row"><button id="tutoDone" class="primary" type="button">Entendido, a jugar</button></div>`, onDone);
  body.querySelector('#tutoDone')!.addEventListener('click', closeModal);
}

/** The question that opens first, ahead of the founding window. Closing it counts as "no". */
export function openTutorialAsk(hasRoute: boolean, onDone?: () => void): void {
  const body = openModal(`
    <h2>¿Querés un tutorial?</h2>
    <p>Es una lectura rápida, de un minuto, con lo justo para arrancar la ciudad. Si ya jugaste, podés saltearlo.</p>
    <div class="row"><button id="tutoYes" class="primary" type="button">Sí, mostrame</button><button id="tutoNo" type="button">No, gracias</button></div>`, onDone);
  body.querySelector('#tutoYes')!.addEventListener('click', () => openTutorial(hasRoute, onDone));
  body.querySelector('#tutoNo')!.addEventListener('click', closeModal);
  body.querySelector<HTMLElement>('#tutoYes')!.focus();
}
