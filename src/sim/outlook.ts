/**
 * Pure helpers that explain the city's money to the player: the live monthly balance in the top
 * bar, how many months the cash lasts, the upkeep shown when choosing a building, and the
 * newspaper's cause headlines. No DOM and no simulation state in here.
 */
import { BUS, COAST, COAST_KINDS, HUBS, FIXED_SHARE, LINE_TIERS, PLANTS, POWER_REACH, ROAD_TIERS, SERVICES, type LineTier, type PlantKind, type RoadTier, type ServiceKind } from '../config';
import { formatMoney, formatNumber } from '../core/format';
import type { BudgetReport } from './budget';

/** The runway is shown next to the balance below this many months. */
export const RUNWAY_SHOWN = 12;
/** And it turns red below this many. */
export const RUNWAY_URGENT = 6;

/** "+$420/mes" or "-$1.172/mes": compact, for the top bar. */
export function formatBalance(balance: number): string {
  return `${balance < 0 ? '-' : '+'}$${formatNumber(Math.abs(balance))}/mes`;
}

/**
 * Whole months the cash lasts at a negative balance; null when the balance is not negative
 * (the cash never runs out), 0 when the cash is already gone.
 */
export function runwayMonths(cash: number, balance: number): number | null {
  if (balance >= 0) return null;
  return Math.max(0, Math.floor(cash / -balance));
}

const monthsText = (m: number) => (m === 1 ? '1 mes' : `${m} meses`);

export interface Outlook {
  balanceText: string;
  /** Green when the city earns, red when it loses money. */
  balanceTone: 'good' | 'bad';
  /** Shown next to the balance; null when there is nothing to warn about. */
  runwayText: string | null;
  runwayTone: 'warn' | 'bad' | null;
  /** Multi-line text for the `title` attribute. */
  tooltip: string;
}

/** What the top bar shows for the month's estimated budget and the cash in hand. */
export function describeOutlook(b: BudgetReport, cash: number): Outlook {
  const months = runwayMonths(cash, b.balance);
  let runwayText: string | null = null;
  let runwayTone: Outlook['runwayTone'] = null;
  if (cash < 0) {
    runwayText = 'caja en rojo';
    runwayTone = 'bad';
  } else if (months !== null && months < RUNWAY_SHOWN) {
    runwayText = months === 0 ? 'la caja no llega a fin de mes' : `caja para ${monthsText(months)}`;
    runwayTone = months < RUNWAY_URGENT ? 'bad' : 'warn';
  }

  const money = (v: number) => `${v < 0 ? '-' : ''}$${formatNumber(Math.abs(v))}`;
  const publicServices = b.schools + b.clinics + b.police + b.firefighters + b.hospitals + b.universities;
  const lines = [
    'Estimación de un mes con la ciudad como está hoy',
    `Ingresos: ${money(b.income)} (viviendas ${money(b.taxR)}, comercios ${money(b.taxC)}, fábricas ${money(b.taxI)}${b.coastIncome ? `, pesca y turismo ${money(b.coastIncome)}` : ''}${b.uniqueIncome ? `, edificios únicos ${money(b.uniqueIncome)}` : ''})`,
    `Gastos: ${money(b.expenses)}`,
    `  Servicios públicos: ${money(publicServices)}`,
    `  Administración: ${money(b.services)}`,
    `  Usinas: ${money(b.plants)}`,
    `  Calles, tendido y plazas: ${money(b.roads + b.lines + b.parks)}`,
  ];
  if (b.coast) lines.push(`  Costa: ${money(b.coast)}`);
  if (b.uniques) lines.push(`  Edificios únicos: ${money(b.uniques)}`);
  lines.push(`Saldo: ${money(b.balance)}`);
  if (cash < 0) lines.push('La caja ya está en rojo: no se construye hasta que se recupere.');
  else if (months !== null) lines.push(months === 0 ? 'A este ritmo la caja no alcanza para un mes.' : `Con la caja actual alcanza para ${monthsText(months)}.`);
  return { balanceText: formatBalance(b.balance), balanceTone: b.balance < 0 ? 'bad' : 'good', runwayText, runwayTone, tooltip: lines.join('\n') };
}

/** Lowest and highest monthly upkeep of a service at full funding: unused, and used to capacity. */
export function serviceUpkeepRange(kind: ServiceKind): { min: number; max: number } {
  return { min: Math.round(SERVICES[kind].upkeep * FIXED_SHARE), max: SERVICES[kind].upkeep };
}

const PLANT_OF_TOOL: Record<string, PlantKind | undefined> = { plant: 'coal', plantGas: 'gas', plantWind: 'wind' };
const ROAD_TIER_OF_TOOL: Record<string, RoadTier | undefined> = { roadDirt: 3, road: 0, roadPaved: 1, roadBoulevard: 2 };
const LINE_TIER_OF_TOOL: Record<string, LineTier | undefined> = { line: 0, lineConcrete: 1 };

/** The upkeep part of the placement tooltip for a tool, or null when the tool has none worth showing. */
export function placementUpkeep(tool: string): string | null {
  const plant = PLANT_OF_TOOL[tool];
  if (plant) return `mantenimiento ${formatMoney(PLANTS[plant].upkeep)}/mes`;
  const tier = ROAD_TIER_OF_TOOL[tool];
  if (tier !== undefined) return `mantenimiento ${formatMoney(ROAD_TIERS[tier].upkeep)}/mes`;
  const line = LINE_TIER_OF_TOOL[tool];
  if (line !== undefined) return `mantenimiento ${formatMoney(LINE_TIERS[line].upkeep)}/mes`;
  if (tool === 'bus') return `mantenimiento ${formatMoney(BUS.upkeep)}/mes`;
  if (tool === 'airport' || tool === 'harbor') return `mantenimiento ${formatMoney(HUBS[tool].upkeep)}/mes`;
  if (tool === 'school' || tool === 'clinic' || tool === 'police' || tool === 'fire' || tool === 'hospital' || tool === 'university') {
    return `mantenimiento desde ${formatMoney(serviceUpkeepRange(tool).min)}/mes`;
  }
  const coast = COAST_KINDS.find((k) => k === tool);
  if (coast) return `mantenimiento ${formatMoney(COAST[coast].upkeep)}/mes`;
  return null;
}

/** What a tool does that its price does not say, for the placement tooltip: how far the light goes. */
export function placementNote(tool: string): string | null {
  if (PLANT_OF_TOOL[tool]) return `luz hasta ${POWER_REACH} lotes`;
  if (tool === 'line' || tool === 'lineConcrete') return `el tendido alumbra hasta ${LINE_TIERS[LINE_TIER_OF_TOOL[tool]!].reach} lotes a su alrededor`;
  if (tool === 'bus') return `alivia el tránsito hasta ${BUS.radius} lotes a la redonda`;
  if (tool === 'airport' || tool === 'harbor') return 'pegala a otra pieza para que crezca; funciona con una calle cerca';
  return null;
}

/** "A este ritmo la caja alcanza para N meses", when the city loses money and the cash lasts under a year. */
export function runwayHeadline(b: BudgetReport, cash: number): string | null {
  if (cash < 0) return null; // the crisis headline already covers it
  const months = runwayMonths(cash, b.balance);
  if (months === null || months >= RUNWAY_SHOWN) return null;
  if (months === 0) return 'A este ritmo la caja no llega a fin de mes';
  return `A este ritmo la caja alcanza para ${monthsText(months)}`;
}

/**
 * True for a month in which the public services take more than a third of the expenses and cost
 * more than the taxes bring in; the newspaper waits for two such months in a row.
 */
export function servicesOutweighIncome(b: BudgetReport): boolean {
  const services = b.schools + b.clinics + b.police + b.firefighters + b.hospitals + b.universities;
  return services * 3 > b.expenses && b.income < services;
}

/** The headline that explains it. Call only when `servicesOutweighIncome` holds. */
export function servicesCostHeadline(b: BudgetReport): string | null {
  if (!servicesOutweighIncome(b)) return null;
  const services = b.schools + b.clinics + b.police + b.firefighters + b.hospitals + b.universities;
  return `Los servicios públicos cuestan ${formatMoney(services)} por mes y los vecinos aportan ${formatMoney(b.income)}`;
}
