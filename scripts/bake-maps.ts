/**
 * Bakes the real-place maps the game ships with (`public/maps/<id>.json`).
 * Run with `npm run bake-maps` (all maps) or `npm run bake-maps -- mar-del-plata`.
 *
 * Sources, fetched once at bake time (the game never calls them):
 * - Elevation: Terrain Tiles on AWS (Terrarium encoding), open data.
 * - Streets, water, parks and woods: OpenStreetMap through the Overpass API (ODbL).
 *
 * With `MAP_CACHE_DIR` set, downloads are kept in that folder and reused, so trying another
 * scale for a city does not ask the public servers again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hash2 } from '../src/core/rng';
import { MAP_SIZE } from '../src/config';
import { encodePreset, type MapPreset } from '../src/world/presets';
import { cornersFromElevation, dominantBearing, rasterLine4, stitchRings, type Segment } from './mapgen/geo';

interface City {
  id: string;
  name: string;
  /** Centre of the map, [lat, lon]. */
  center: [number, number];
  cellMeters: number;
  metersPerLevel: number;
  /** Cells per side: 128 (the default), 192 or 256. */
  size?: number;
  /**
   * Elevation in metres of the water that reaches the map edge, for a lake or a river far
   * above the sea. Without it, that water is the sea (SEA_MAX_M).
   */
  waterLevelM?: number;
  /**
   * Rivers and canals are left out where the ground is higher than this many metres: a city
   * on a piedmont has ditches running down from the hills that would cut a trench into them.
   */
  waterwayMaxM?: number;
  /**
   * Metres added to all the land, for a city on a plain no higher than its lake: without it the
   * whole plain sits at the level of the shore and is drawn as beach.
   */
  landLiftM?: number;
}

const CITIES: City[] = [
  { id: 'mar-del-plata', name: 'Mar del Plata', center: [-38.0019, -57.543], cellMeters: 20, metersPerLevel: 5 },
  { id: 'buenos-aires', name: 'Buenos Aires', center: [-34.598, -58.365], cellMeters: 20, metersPerLevel: 9, size: 256 },
  { id: 'rosario', name: 'Rosario', center: [-32.947, -60.636], cellMeters: 20, metersPerLevel: 4, size: 192 },
  { id: 'cordoba', name: 'Córdoba', center: [-31.4167, -64.1836], cellMeters: 20, metersPerLevel: 8, size: 192 },
  { id: 'mendoza', name: 'Mendoza', center: [-32.8895, -68.874], cellMeters: 25, metersPerLevel: 25, size: 256, waterwayMaxM: 800 },
  { id: 'bariloche', name: 'Bariloche', center: [-41.138, -71.31], cellMeters: 25, metersPerLevel: 30, size: 192, waterLevelM: 772 },
  { id: 'ushuaia', name: 'Ushuaia', center: [-54.805, -68.31], cellMeters: 20, metersPerLevel: 20, size: 192 },
  // Midway between the centre (Plaza Independencia) and the Lago del Fuerte, 2.6 km to the south of it.
  { id: 'tandil', name: 'Tandil', center: [-37.332, -59.133], cellMeters: 20, metersPerLevel: 8, size: 256, landLiftM: 20 },
  // The town, not the Buenos Aires neighbourhood of Flores: its whole ejido fits in 256 cells of 25 m.
  { id: 'las-flores', name: 'Las Flores', center: [-36.0143, -59.0999], cellMeters: 25, metersPerLevel: 5, size: 256 },
];

const env = (globalThis as unknown as { process: { argv: string[]; env: Record<string, string | undefined> } }).process;
const CACHE_DIR = env.env.MAP_CACHE_DIR;

/** Bytes of a download, from the cache folder when there is one. */
async function cached(file: string, download: () => Promise<Uint8Array>): Promise<Uint8Array> {
  if (!CACHE_DIR) return download();
  const path = `${CACHE_DIR}/${file}`;
  if (existsSync(path)) return readFileSync(path);
  const bytes = await download();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

const ATTRIBUTION = 'Calles, agua y parques: © colaboradores de OpenStreetMap (ODbL). Relieve: Terrain Tiles (Mapzen y AWS, con datos de SRTM y otros).';
const USER_AGENT = 'map-baker/1.0';
const ZOOM = 14;
/** Street kinds that become game streets. Ramps (`*_link`) and service lanes are left out. */
const STREETS = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$/;

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320;

// ---------------------------------------------------------------- OpenStreetMap

interface OsmPoint {
  lat: number;
  lon: number;
}
interface OsmElement {
  type: 'way' | 'relation';
  tags?: Record<string, string>;
  geometry?: OsmPoint[];
  members?: { role: string; geometry?: OsmPoint[] }[];
}

async function overpass(south: number, west: number, north: number, east: number): Promise<OsmElement[]> {
  const b = `${south},${west},${north},${east}`;
  const bytes = await cached(`osm-${[south, west, north, east].map((v) => v.toFixed(5)).join('_')}.json`, () => overpassQuery(b));
  return (JSON.parse(new TextDecoder().decode(bytes)) as { elements: OsmElement[] }).elements;
}

async function overpassQuery(b: string): Promise<Uint8Array> {
  const query = `[out:json][timeout:120];
(
  way["highway"](${b});
  way["natural"~"^(water|wood|scrub)$"](${b});
  relation["natural"="water"](${b});
  way["waterway"~"^(river|riverbank|canal)$"](${b});
  way["landuse"~"^(forest|reservoir|basin)$"](${b});
  way["leisure"="park"](${b});
  relation["leisure"="park"](${b});
);
out geom;`;
  // Public servers get busy: try each one a few times, waiting longer each time.
  const servers = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let last = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = servers[attempt % servers.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      last = `${url} respondió ${res.status}`;
    } catch (err) {
      last = `${url}: ${(err as Error).message}`;
    }
    console.log(`  ${last}; reintento…`);
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error(`Overpass no respondió: ${last}`);
}

/** Closed rings of an area element: a closed way, or the members of a relation with that role joined end to end. */
function rings(e: OsmElement, role: 'outer' | 'inner' = 'outer'): OsmPoint[][] {
  if (e.type === 'way') {
    const g = e.geometry ?? [];
    return role === 'outer' && g.length > 3 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon ? [g] : [];
  }
  const ways = (e.members ?? []).filter((m) => m.role === role && m.geometry && m.geometry.length > 1).map((m) => m.geometry!);
  return stitchRings(ways, (p) => `${p.lat},${p.lon}`);
}

// ---------------------------------------------------------------- elevation

/** Minimal PNG decoder for 8-bit RGB/RGBA images (what Terrarium tiles are). */
async function decodePng(bytes: Uint8Array): Promise<{ width: number; height: number; rgb: Uint8Array }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  let width = 0;
  let height = 0;
  let channels = 3;
  const idat: Uint8Array[] = [];
  while (p < bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(p + 8);
      height = view.getUint32(p + 12);
      const depth = data[8];
      const color = data[9];
      if (depth !== 8 || (color !== 2 && color !== 6) || data[12] !== 0) throw new Error('PNG no soportado');
      channels = color === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const compressed = new Blob(idat);
  const raw = new Uint8Array(await new Response(compressed.stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const stride = width * channels;
  const out = new Uint8Array(width * height * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) out[(y * width + x) * 3 + k] = line[x * channels + k];
    prev = line;
  }
  return { width, height, rgb: out };
}

class Elevation {
  private tiles = new Map<string, Float32Array>();

  /** Global pixel coordinates at ZOOM. */
  static pixel(lat: number, lon: number): [number, number] {
    const size = 256 * 2 ** ZOOM;
    const r = (lat * Math.PI) / 180;
    return [((lon + 180) / 360) * size, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * size];
  }

  async load(lat0: number, lon0: number, lat1: number, lon1: number): Promise<void> {
    const [ax, ay] = Elevation.pixel(lat1, lon0);
    const [bx, by] = Elevation.pixel(lat0, lon1);
    for (let ty = Math.floor(ay / 256) - 1; ty <= Math.floor(by / 256) + 1; ty++) {
      for (let tx = Math.floor(ax / 256) - 1; tx <= Math.floor(bx / 256) + 1; tx++) {
        const png = await decodePng(
          await cached(`relieve-${ZOOM}-${tx}-${ty}.png`, async () => {
            const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png`, { headers: { 'User-Agent': USER_AGENT } });
            if (!res.ok) throw new Error(`Mosaico de relieve ${tx}/${ty}: ${res.status}`);
            return new Uint8Array(await res.arrayBuffer());
          }),
        );
        const m = new Float32Array(256 * 256);
        for (let i = 0; i < m.length; i++) m[i] = png.rgb[i * 3] * 256 + png.rgb[i * 3 + 1] + png.rgb[i * 3 + 2] / 256 - 32768;
        this.tiles.set(`${tx}/${ty}`, m);
      }
    }
  }

  private at(px: number, py: number): number {
    const tx = Math.floor(px / 256);
    const ty = Math.floor(py / 256);
    const m = this.tiles.get(`${tx}/${ty}`);
    if (!m) throw new Error('Falta un mosaico de relieve');
    return m[(Math.floor(py) - ty * 256) * 256 + (Math.floor(px) - tx * 256)];
  }

  /**
   * Mean elevation of a 5×5-pixel box (about 35 m) around the point: the data has a few
   * metres of noise, which would otherwise show as random one-level bumps.
   */
  sample(lat: number, lon: number): number {
    const [px, py] = Elevation.pixel(lat, lon);
    let sum = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += this.at(px + dx, py + dy);
    return sum / 25;
  }
}

// ---------------------------------------------------------------- baking

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Fills the cells whose centre lies inside the ring (in grid coordinates). */
function fillRing(mask: Uint8Array, n: number, ring: [number, number][], value: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(n - 1, Math.ceil(maxY)); y++) {
    for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(n - 1, Math.ceil(maxX)); x++) {
      if (pointInRing(x + 0.5, y + 0.5, ring)) mask[y * n + x] = value;
    }
  }
}

/** Water areas from OpenStreetMap smaller than this many cells are left out. */
const MIN_LAKE_CELLS = 12;
/** Near the coast the sea-floor data rounds to 0 m, so "sea" is anything this low that reaches the edge. */
const SEA_MAX_M = 1;

/**
 * The sea: cells at most `maxM` high connected to the map edge through such cells. Low
 * spots inland are left alone: in cities they are usually noise in the elevation data.
 */
function seaFromElevation(n: number, elevAt: (x: number, y: number) => number, maxM: number): Uint8Array {
  const e = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) e[y * n + x] = elevAt(x, y);
  const sea = new Uint8Array(n * n);
  const queue: number[] = [];
  for (let k = 0; k < n; k++) {
    for (const seed of [k, (n - 1) * n + k, k * n, k * n + n - 1]) {
      if (sea[seed] || e[seed] > maxM) continue;
      sea[seed] = 1;
      queue.push(seed);
      while (queue.length) {
        const i = queue.pop()!;
        const x = i % n;
        const y = (i - x) / n;
        for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
          if (j >= 0 && !sea[j] && e[j] <= maxM) {
            sea[j] = 1;
            queue.push(j);
          }
        }
      }
    }
  }
  return sea;
}

async function bake(city: City): Promise<void> {
  const n = city.size ?? MAP_SIZE;
  const [lat0, lon0] = city.center;
  const kx = M_PER_DEG_LON * Math.cos((lat0 * Math.PI) / 180);
  const half = (n * city.cellMeters) / 2;
  const reach = half * Math.SQRT2 + 200;
  const south = lat0 - reach / M_PER_DEG_LAT;
  const north = lat0 + reach / M_PER_DEG_LAT;
  const west = lon0 - reach / kx;
  const east = lon0 + reach / kx;

  console.log(`${city.name}: pidiendo datos de OpenStreetMap…`);
  const osm = await overpass(south, west, north, east);
  const metric = (p: OsmPoint): [number, number] => [(p.lon - lon0) * kx, (p.lat - lat0) * M_PER_DEG_LAT];

  // Pedestrian squares mapped as areas are plazas, not streets.
  const streets = osm.filter(
    (e) => e.type === 'way' && STREETS.test(e.tags?.highway ?? '') && e.tags?.tunnel !== 'yes' && e.tags?.area !== 'yes' && e.geometry,
  );
  const segs: Segment[] = [];
  for (const s of streets) {
    const g = s.geometry!.map(metric);
    for (let k = 1; k < g.length; k++) if (Math.max(Math.abs(g[k][0]), Math.abs(g[k][1])) < half) segs.push([g[k - 1][0], g[k - 1][1], g[k][0], g[k][1]]);
  }
  let bearing = dominantBearing(segs);
  if (bearing > 45) bearing -= 90;
  const th = (bearing * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  // Metric (east, north) → grid (x right, y down), rotated so the streets run along the grid.
  const toGrid = ([x, y]: [number, number]): [number, number] => {
    const xr = x * cos + y * sin;
    const yr = -x * sin + y * cos;
    return [(xr + half) / city.cellMeters, (half - yr) / city.cellMeters];
  };
  const toLatLon = (gx: number, gy: number): [number, number] => {
    const xr = gx * city.cellMeters - half;
    const yr = half - gy * city.cellMeters;
    const x = xr * cos - yr * sin;
    const y = xr * sin + yr * cos;
    return [lat0 + y / M_PER_DEG_LAT, lon0 + x / kx];
  };
  const grid = (p: OsmPoint) => toGrid(metric(p));

  console.log(`  orientación de las calles: ${bearing.toFixed(1)}°; bajando relieve…`);
  const elevation = new Elevation();
  await elevation.load(south, west, north, east);
  const s = n + 1;
  const elev = new Float32Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) elev[y * s + x] = elevation.sample(...toLatLon(x, y));

  // Water: the sea from the elevation data, lakes and rivers from OpenStreetMap.
  const water = seaFromElevation(n, (x, y) => elevation.sample(...toLatLon(x + 0.5, y + 0.5)), city.waterLevelM ?? SEA_MAX_M);
  for (const e of osm) {
    const t = e.tags ?? {};
    const isWaterArea = (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin') && !t.amenity;
    if (isWaterArea) {
      for (const r of rings(e)) {
        // Ponds smaller than a few lots would only leave odd bridges in the middle of a block.
        const area = new Uint8Array(n * n);
        fillRing(area, n, r.map(grid), 1);
        for (const island of rings(e, 'inner')) fillRing(area, n, island.map(grid), 0);
        let cells = 0;
        for (let i = 0; i < area.length; i++) cells += area[i];
        if (cells < MIN_LAKE_CELLS) continue;
        for (let i = 0; i < area.length; i++) if (area[i]) water[i] = 1;
        console.log(`  agua de OSM: ${t.name ?? t.natural ?? t.landuse ?? t.waterway}, ${cells} lotes`);
      }
    }
    else if ((t.waterway === 'river' || t.waterway === 'canal') && e.geometry) {
      // Piped stretches (culverts) run under the city: they are not water on the surface.
      if (t.tunnel || t.location === 'underground') continue;
      // Unnamed canals are drainage ditches a few metres wide: at this scale they would be rivers.
      if (t.waterway === 'canal' && !t.name) continue;
      console.log(`  río o canal de OSM: ${t.name ?? t.waterway}`);
      const g = e.geometry.map(grid);
      for (let k = 1; k < g.length; k++) {
        for (const [x, y] of rasterLine4(Math.round(g[k - 1][0]), Math.round(g[k - 1][1]), Math.round(g[k][0]), Math.round(g[k][1]))) {
          if (city.waterwayMaxM !== undefined && x >= -1 && y >= -1 && x < n && y < n && elevation.sample(...toLatLon(x + 1, y + 1)) > city.waterwayMaxM) continue;
          for (const [dx, dy] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ]) {
            if (x + dx >= 0 && y + dy >= 0 && x + dx < n && y + dy < n) water[(y + dy) * n + x + dx] = 1;
          }
        }
      }
    }
  }
  const corners = cornersFromElevation(elev, water, n, city.metersPerLevel, city.landLiftM);

  // Trees: woods are dense, parks have some, and a few stand anywhere.
  const green = new Uint8Array(n * n); // 2 = wood, 1 = park
  for (const e of osm) {
    const t = e.tags ?? {};
    const level = t.natural === 'wood' || t.natural === 'scrub' || t.landuse === 'forest' ? 2 : t.leisure === 'park' ? 1 : 0;
    if (level) for (const r of rings(e)) fillRing(green, n, r.map(grid), level);
  }
  const trees = new Uint8Array(n * n);
  const wet = (x: number, y: number) => Math.min(corners[y * s + x], corners[y * s + x + 1], corners[(y + 1) * s + x], corners[(y + 1) * s + x + 1]) < 3;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (wet(x, y)) continue;
      const r = hash2(x, y, 4242);
      const chance = green[y * n + x] === 2 ? 0.6 : green[y * n + x] === 1 ? 0.4 : 0.008;
      if (r < chance) trees[y * n + x] = 1 + Math.floor(hash2(y, x, 77) * 4);
    }
  }

  // Streets.
  const roads = new Uint8Array(n * n);
  for (const st of streets) {
    const g = st.geometry!.map(grid).map(([x, y]) => [Math.floor(x), Math.floor(y)] as [number, number]);
    for (let k = 1; k < g.length; k++) {
      const [ax, ay] = g[k - 1];
      const [bx, by] = g[k];
      if (Math.max(ax, bx) < 0 || Math.min(ax, bx) >= n || Math.max(ay, by) < 0 || Math.min(ay, by) >= n) continue;
      for (const [x, y] of rasterLine4(ax, ay, bx, by)) if (x >= 0 && y >= 0 && x < n && y < n) roads[y * n + x] = 1;
    }
  }

  const preset: MapPreset = { id: city.id, name: city.name, n, cellMeters: city.cellMeters, corners, trees, roads, attribution: ATTRIBUTION };
  mkdirSync('public/maps', { recursive: true });
  writeFileSync(`public/maps/${city.id}.json`, encodePreset(preset));

  let wetCells = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (wet(x, y)) wetCells++;
  const top = Math.max(...corners);
  console.log(
    `  listo: agua ${Math.round((100 * wetCells) / (n * n))} %, calles ${roads.reduce((a, b) => a + b, 0)} lotes, árboles ${trees.reduce((a, b) => a + (b ? 1 : 0), 0)}, altura máxima nivel ${top}`,
  );
}

const wanted = env.argv.slice(2);
for (const city of CITIES) if (wanted.length === 0 || wanted.includes(city.id)) await bake(city);
