import { LOANS, SERVICE_KINDS, type ServiceFunding, type ServiceKind, type ZoneTaxes } from '../config';
import { formatMoney, formatNumber, settlementType } from '../core/format';
import { TILE, type World } from '../world/world';

/** What the newspaper compares month to month. */
export interface CitySnapshot {
  pop: number;
  buildings: number;
  plants: number;
  shortage: boolean;
  crisis: boolean;
  taxes: ZoneTaxes;
  funding: ServiceFunding;
  month: number;
  year: number;
  cash: number;
  abandoned: number;
  /** Kind of the municipal loan being paid off, or null. Only the kind: the amount and the term come from `LOANS`. */
  loan: number | null;
}

/** Built lots (level above 0, not burning) of each basic zone. */
export function builtBasicZones(w: World): Record<'R' | 'C' | 'I', number> {
  const out = { R: 0, C: 0, I: 0 };
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.level[i] === 0 || w.fire[i]) continue;
    const t = w.tiles[i];
    if (t === TILE.R) out.R++;
    else if (t === TILE.C) out.C++;
    else if (t === TILE.I) out.I++;
  }
  return out;
}

/** Built lots of each basic zone the city needs before the newspaper starts writing. */
export const PAPER_OPENS_WITH = 2;

/** True when there are at least `PAPER_OPENS_WITH` built lots of residential, commercial and industrial. */
export function paperCanOpen(w: World): boolean {
  const b = builtBasicZones(w);
  return b.R >= PAPER_OPENS_WITH && b.C >= PAPER_OPENS_WITH && b.I >= PAPER_OPENS_WITH;
}

export interface NewsItem {
  date: string;
  text: string;
}

const MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

const TAX_NAMES = { R: ['residenciales', 'los barrios'], C: ['comerciales', 'los comercios'], I: ['industriales', 'las fábricas'] } as const;

/** A service funded below this percent makes the news. */
const DEEP_CUT = 50;
const CUT_NEWS: Record<ServiceKind, (pct: number) => string> = {
  school: (p) => `Paro docente: el presupuesto de las escuelas quedó al ${p} %`,
  clinic: (p) => `Salitas sin insumos: el presupuesto de salud quedó al ${p} %`,
  police: (p) => `Patrulleros sin nafta: recortan el presupuesto de las comisarías al ${p} %`,
  fire: (p) => `Los bomberos voluntarios piden ayuda: les dejaron el presupuesto al ${p} %`,
};

/** Headlines caused by the change from `prev` to `next`. Pure: same input, same headlines. */
export function headlinesFor(prev: CitySnapshot, next: CitySnapshot, city: string): string[] {
  const out: string[] = [];
  if (prev.plants === 0 && next.plants > 0) out.push(`¡Hay luz! Se inauguró la primera usina de ${city}`);
  if (prev.pop === 0 && next.pop > 0) out.push(`Llegaron los primeros vecinos a ${city}: ya hay mate en la vereda`);
  for (const m of MILESTONES) {
    if (prev.pop < m && next.pop >= m) out.push(`${city} ya supera los ${formatNumber(m)} habitantes`);
  }
  const before = settlementType(prev.pop);
  const after = settlementType(next.pop);
  if (before !== after && next.pop > prev.pop) out.push(`Es oficial: ${city} ya es ${article(after)} ${after}`);
  if (!prev.shortage && next.shortage) out.push('Apagones en los barrios: la usina no da abasto');
  if (prev.shortage && !next.shortage) out.push('Volvió la luz: se normalizó el suministro eléctrico');
  if (!prev.crisis && next.crisis) out.push('Crisis en la Municipalidad: la caja quedó en rojo y se frenan las obras');
  if (prev.crisis && !next.crisis) out.push('La Municipalidad salió del rojo: vuelven las obras');
  // A change of kind is one loan ending and another starting, so both pieces of news go out.
  if (next.loan !== prev.loan) {
    if (prev.loan !== null) out.push('La Municipalidad terminó de pagar el crédito: se libera la cuota del presupuesto');
    if (next.loan !== null) {
      const { amount, months } = LOANS[next.loan];
      out.push(`Crédito aprobado: la Municipalidad recibió ${formatMoney(amount)} y lo devuelve en ${months} cuotas`);
    }
  }
  if (prev.abandoned < 10 && next.abandoned >= 10) out.push(`Crece el abandono: ya son ${next.abandoned} los edificios vacíos en ${city}`);
  if (prev.abandoned >= 10 && next.abandoned < 5) out.push('Vuelven los vecinos: se recuperan los barrios abandonados');
  for (const z of ['R', 'C', 'I'] as const) {
    const [kind, who] = TAX_NAMES[z];
    if (next.taxes[z] > prev.taxes[z]) out.push(`Suben las tasas ${kind} al ${next.taxes[z]} %: malestar en ${who}`);
    if (next.taxes[z] < prev.taxes[z]) out.push(`Bajan las tasas ${kind} al ${next.taxes[z]} %: alivio en ${who}`);
  }
  for (const k of SERVICE_KINDS) {
    if (prev.funding[k] >= DEEP_CUT && next.funding[k] < DEEP_CUT) out.push(CUT_NEWS[k](next.funding[k]));
  }
  if (prev.month === 12 && next.month === 1) {
    out.push(`Balance ${prev.year}: ${formatNumber(next.pop)} habitantes y ${formatMoney(next.cash)} en la caja`);
  }
  return out;
}

function article(type: string): string {
  return type === 'metrópolis' || type === 'ciudad' || type === 'gran ciudad' ? 'una' : 'un';
}

/** Local color for quiet months. */
export const FILLERS: readonly string[] = [
  'Domingo de asado: récord de venta de achuras en las carnicerías del barrio',
  'El clásico del barrio terminó 2 a 2 y con polémica por un penal',
  'Se viene la kermés de la parroquia: habrá tómbola y pastelitos',
  'Ola de calor: se agotaron los helados de dulce de leche',
  'Torneo de truco en el club social: lo ganó una jubilada de 84 años',
  'Inauguran una feria de artesanos los sábados en la plaza',
  'Corte de luz en una cuadra: era el vecino con la amoladora',
  'Un perro callejero fue adoptado por toda la cuadra y ya tiene nombre: Gardelito',
  'La panadería de la esquina sacó medialunas de grasa a precio de antes',
  'Vecinos organizan una vaquita para arreglar el tobogán de la plaza',
  'El colectivo pasó a horario y nadie lo podía creer',
  'Llueve y se inundó la esquina de siempre: piden un desagüe',
  'Murga del barrio ensaya para carnaval y los vecinos aplauden desde el balcón',
  'Se juntaron 200 personas en la peña folklórica del club',
  'Concurso de empanadas: ganó la receta salteña de una vecina',
  'El almacén de don Rubén cumple 30 años fiando a los vecinos',
  'Cola de tres cuadras para el bife en oferta del súper',
  'Abrió un nuevo potrero y los pibes ya armaron el campeonato',
];
