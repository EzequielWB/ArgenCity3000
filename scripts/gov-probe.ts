/**
 * Balance matrix: the planned-city bot (`city-bot.ts`) played under every government, map kind and
 * player style, over several seeds. One run is one anecdote; the median over seeds is the signal.
 *
 * Run: `npx vite-node scripts/gov-probe.ts [years=30] [--seeds=3] [--styles=a,b] [--kinds=a,b]
 *       [--only=<gov>] [--diag]`   (`--diag` prints the yearly detail and runs one seed, style and kind)
 */
import { GOVERNMENTS, type GovernmentKind } from '../src/config';
import { MAP_KINDS, type MapKind } from '../src/world/mapkinds';
import { GOVS, STYLES, play, type Report, type StyleId } from './city-bot';

const env = (globalThis as unknown as { process: { argv: string[] } }).process;
const flag = (name: string) => env.argv.find((a: string) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const years = Number(env.argv.slice(2).find((a: string) => !a.startsWith('--')) ?? 30);
const diag = env.argv.includes('--diag');
const seeds = Array.from({ length: Number(flag('seeds') ?? 3) }, (_, i) => 7 + i * 11);
const styles = (flag('styles')?.split(',') ?? Object.keys(STYLES)) as StyleId[];
const kinds = (flag('kinds')?.split(',') ?? MAP_KINDS.map((k) => k.id)) as MapKind[];
const govs = (flag('only') ? [flag('only')] : GOVS) as GovernmentKind[];

interface Row extends Report { style: StyleId; kind: MapKind; seed: number }
const rows: Row[] = [];
for (const government of govs)
  for (const style of diag ? styles.slice(0, 1) : styles)
    for (const kind of diag ? kinds.slice(0, 1) : kinds)
      for (const seed of diag ? seeds.slice(0, 1) : seeds) {
        if (diag) console.log(`\n== ${GOVERNMENTS[government].label} · ${style} · ${kind} · semilla ${seed}`);
        rows.push({ ...play(government, years, diag, seed, kind, STYLES[style]), style, kind, seed });
      }

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
const pct = (v: boolean[]) => `${Math.round((100 * v.filter(Boolean).length) / v.length)}%`;
const pad = (v: string | number, w: number) => String(v).padStart(w);

/** One table: a row per `rowKey`, a column group per government (median peak population, % lost). */
function table(title: string, rowKey: (r: Row) => string, keys: string[]): void {
  console.log(`\n${title}  (pico de población mediano / % que perdió elecciones)`);
  console.log(''.padEnd(14) + govs.map((g) => pad(g, 16)).join(''));
  for (const k of keys) {
    const cells = govs.map((g) => {
      const rs = rows.filter((r) => r.government === g && rowKey(r) === k);
      return pad(`${median(rs.map((r) => r.peakPop))} / ${pct(rs.map((r) => r.lost))}`, 16);
    });
    console.log(k.padEnd(14) + cells.join(''));
  }
}

console.log(`\n${rows.length} corridas de ${years} años: ${seeds.length} semillas × ${styles.length} estilos × ${kinds.length} mapas × ${govs.length} gobiernos`);
console.log('\nPor gobierno   pico mediano   llegó a 150k   perdió   caja mediana   abandonados medianos');
for (const g of govs) {
  const rs = rows.filter((r) => r.government === g);
  console.log(
    `${g.padEnd(14)}${pad(median(rs.map((r) => r.peakPop)), 12)}${pad(pct(rs.map((r) => r.year150k !== null)), 15)}${pad(pct(rs.map((r) => r.lost)), 9)}${pad(Math.round(median(rs.map((r) => r.cash))), 15)}${pad(median(rs.map((r) => r.abandoned)), 21)}`,
  );
}
table('Por estilo de jugador', (r) => r.style, styles);
table('Por tipo de mapa', (r) => r.kind, kinds);
