import { formatMoney, formatNumber, settlementType } from '../core/format';

/** What the newspaper compares month to month. */
export interface CitySnapshot {
  pop: number;
  buildings: number;
  plants: number;
  shortage: boolean;
  crisis: boolean;
  tax: number;
  month: number;
  year: number;
  cash: number;
}

export interface NewsItem {
  date: string;
  text: string;
}

const MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

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
  if (next.tax > prev.tax) out.push(`Suben las tasas municipales al ${next.tax} %: malestar en los barrios`);
  if (next.tax < prev.tax) out.push(`Bajan las tasas al ${next.tax} %: alivio en los comercios`);
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
