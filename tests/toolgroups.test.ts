import { describe, expect, it } from 'vitest';
import { COSTS, PLANTS, ROAD_TIERS, SERVICES } from '../src/config';
import { toolPrice } from '../src/ui/toolbar';
import { TOOLS, TOOL_GROUPS, groupOfTool } from '../src/world/tools';

describe('tool groups', () => {
  it('puts every tool in exactly one group', () => {
    const grouped = TOOL_GROUPS.flatMap((g) => g.tools);
    expect([...grouped].sort()).toEqual(TOOLS.map((t) => t.id).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('has the eight categories of the toolbar, in order', () => {
    expect(TOOL_GROUPS.map((g) => [g.label, g.tools])).toEqual([
      ['Consulta', ['query', 'bulldoze']],
      ['Calles y luz', ['roadDirt', 'road', 'roadPaved', 'roadBoulevard', 'line']],
      ['Zonas', ['zoneR', 'zoneC', 'zoneI', 'park']],
      ['Servicios', ['school', 'clinic', 'police', 'fire', 'hospital', 'university']],
      ['Usinas', ['plant', 'plantGas', 'plantWind']],
      ['Costa', ['fishing', 'promenade', 'port', 'resort', 'lighthouse']],
      ['Transportes', ['bus', 'harbor', 'airport']],
      ['Únicos', ['obelisco', 'calvario', 'puente', 'teatro', 'estadio']],
    ]);
  });

  it('finds the group of a tool', () => {
    expect(groupOfTool('park').id).toBe('zones');
    expect(groupOfTool('plantWind').id).toBe('plants');
    for (const g of TOOL_GROUPS) for (const t of g.tools) expect(groupOfTool(t)).toBe(g);
  });
});

describe('tool prices in the toolbar', () => {
  it('shows what one lot or one building costs', () => {
    expect(toolPrice('road')).toBe(COSTS.road);
    expect(toolPrice('roadPaved')).toBe(ROAD_TIERS[1].cost);
    expect(toolPrice('roadBoulevard')).toBe(ROAD_TIERS[2].cost);
    expect(toolPrice('line')).toBe(COSTS.line);
    expect(toolPrice('zoneC')).toBe(COSTS.zone);
    expect(toolPrice('park')).toBe(COSTS.park);
    expect(toolPrice('bulldoze')).toBe(COSTS.bulldoze);
    expect(toolPrice('plant')).toBe(PLANTS.coal.cost);
    expect(toolPrice('plantGas')).toBe(PLANTS.gas.cost);
    expect(toolPrice('plantWind')).toBe(PLANTS.wind.cost);
    expect(toolPrice('police')).toBe(SERVICES.police.cost);
  });

  it('has no price for the query tool', () => {
    expect(toolPrice('query')).toBeNull();
  });
});
