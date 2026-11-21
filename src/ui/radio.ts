/**
 * Radio Barrio: el gabinete del header y su desplegable.
 *
 * No es un modal: no hay velo, no se bloquea el reloj y el mapa de atrás sigue vivo. El gabinete es el
 * interruptor, así que abrir y cerrar es el mismo botón, y el primer clic afuera cierra sin dejar que ese
 * clic construya la herramienta que el jugador tenía seleccionada.
 *
 * La pantalla no repite la cita del desplegable: usa `radioLine`, que es una frase corta armada con lo que
 * el llamado ya midió (quién, hace cuánto, qué le falta). Su ancho es el de la frase más larga de la tanda,
 * medido una vez por mes: si se ajustara a cada frase, la barra bailaría cada seis segundos.
 */
import { isUnlocked } from '../sim/milestones';
import { vecinosReport, type Call, type VecinosReport } from '../sim/vecinos';
import { $ } from './dom';
import { radioLine, vecinosHtml } from './vecinos';
import type { Game } from '../game';

/** Cada cuánto rota la voz de la radio. */
const TURN_MS = 6000;

export class Radio {
  private report: VecinosReport | null = null;
  private calls: Call[] = [];
  private idx = 0;
  private open = false;
  private hovering = false;
  private timer: number | null = null;
  private sig = '';
  private measure: CanvasRenderingContext2D | null = null;

  private readonly root = $('#radio');
  private readonly btn = $<HTMLButtonElement>('#btnRadio');
  private readonly count = $('#radioCount');
  private readonly screen = $('#radioScreen');
  private readonly say = $('#radioSay');
  private readonly drop = $('#vecinosDrop');

  constructor(private game: Game) {
    this.btn.addEventListener('click', () => this.toggle());
    this.root.addEventListener('mouseenter', () => (this.hovering = true));
    this.root.addEventListener('mouseleave', () => (this.hovering = false));
    // Captura: el cierre tiene que comerse el clic antes de que llegue al mapa.
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('modal:open', this.onModal);
    this.timer = window.setInterval(() => this.turn(), TURN_MS);
  }

  destroy(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('modal:open', this.onModal);
  }

  /** Relee la ciudad. Se llama una vez por mes desde `updateHud`, no por cuadro. */
  refresh(): void {
    const m = this.game.sim.state.milestone;
    const kinds = {
      health: isUnlocked('clinic', m),
      crime: isUnlocked('police', m),
      school: isUnlocked('school', m),
    };
    const report = vecinosReport(this.game.world, kinds, this.game.seed);
    this.report = report;
    this.calls = report.calls;

    const quejas = report.total;
    this.count.textContent = String(quejas);
    this.count.classList.toggle('hidden', quejas === 0);
    this.btn.classList.toggle('unread', quejas > 0);
    this.btn.classList.toggle('off', quejas === 0);

    const sig = `${quejas}|${this.calls.map((c) => `${c.i}:${c.grip}`).join(',')}`;
    if (sig !== this.sig) {
      this.sig = sig;
      // Un barrio nuevo más enojado que el que estaba sonando se lleva la pantalla en el acto.
      this.idx = 0;
    }
    if (this.calls.length === 0) {
      this.screen.classList.add('off');
      this.say.textContent = '—sin señal—';
      this.screen.style.removeProperty('width');
    } else {
      this.screen.classList.remove('off');
      this.idx = Math.min(this.idx, this.calls.length - 1);
      this.fitScreen();
      this.show();
    }
    if (this.open) this.renderDrop();
  }

  /** Cierra el desplegable. Lo llaman los modales de verdad: dos capas flotando se comen los clics. */
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.drop.classList.add('hidden');
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.classList.remove('on');
  }

  private toggle(): void {
    if (this.open) return this.close();
    if (!this.report) this.refresh();
    this.open = true;
    this.renderDrop();
    this.drop.classList.remove('hidden');
    this.btn.setAttribute('aria-expanded', 'true');
    this.btn.classList.add('on');
  }

  /** Pasa a la siguiente voz. Con el puntero encima o el desplegable abierto, la radio se calla. */
  private turn(): void {
    if (this.hovering || this.open || this.calls.length < 2) return;
    this.idx = (this.idx + 1) % this.calls.length;
    this.show();
  }

  private show(): void {
    const c = this.calls[this.idx];
    if (!c) return;
    this.say.textContent = radioLine(c);
  }

  /**
   * El ancho de la pantalla es el de la frase más larga: si cambiara por frase, la barra bailaría cada seis
   * segundos. Se mide con la tipografía del aparato en vez de leer el layout, que devuelve cero cuando el
   * elemento todavía está sin acomodar.
   */
  private fitScreen(): void {
    const ctx = (this.measure ??= document.createElement('canvas').getContext('2d'));
    if (!ctx) return;
    ctx.font = '12.5px "Courier New", monospace';
    let widest = 0;
    for (const c of this.calls) widest = Math.max(widest, ctx.measureText(radioLine(c)).width);
    // 24 de padding y 6 de borde, que `border-box` incluye en el ancho.
    this.screen.style.width = `${Math.ceil(widest) + 30}px`;
  }

  private renderDrop(): void {
    if (!this.report) return;
    this.drop.innerHTML = vecinosHtml(this.report);
    for (const b of this.drop.querySelectorAll<HTMLButtonElement>('[data-go]')) {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.go);
        const x = i % this.game.world.n;
        const y = Math.floor(i / this.game.world.n);
        this.close();
        this.game.view.centreOn(x, y);
        this.game.inspect(x, y);
      });
    }
  }

  private onOutside = (e: PointerEvent): void => {
    if (!this.open) return;
    const t = e.target as Node | null;
    if (t && (this.root.contains(t) || this.drop.contains(t))) return;
    // Se cierra y no pasa de largo: si el clic llegara al mapa, cerrar el panel dejaría una obra puesta.
    e.stopPropagation();
    e.preventDefault();
    this.close();
  };

  private onModal = (): void => this.close();

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      e.stopPropagation();
      this.close();
    }
  };
}
