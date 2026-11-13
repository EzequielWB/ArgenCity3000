import type { ToolId } from '../world/tools';

const svg = (body: string) => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;

/** Small isometric pictograms for the toolbar. */
export const TOOL_ICONS: Record<ToolId, string> = {
  query: svg(
    '<circle cx="13" cy="13" r="8" fill="#6fb7e0" stroke="#f6ead0" stroke-width="2.5"/><path d="M19 19l8 8" stroke="#e0a526" stroke-width="4" stroke-linecap="round"/><text x="13" y="17.5" text-anchor="middle" font-size="12" font-weight="800" fill="#1f1611">?</text>',
  ),
  bulldoze: svg(
    '<path d="M4 22h18v-8h-6l-3-5H7v13z" fill="#e0a526" stroke="#5a3a22" stroke-width="1.2"/><path d="M22 12l6 2v10l-6-2" fill="#9aa3a6" stroke="#5a3a22" stroke-width="1.2"/><rect x="3" y="22" width="20" height="5" rx="2.5" fill="#3a2a20"/><circle cx="7" cy="24.5" r="1.4" fill="#9aa3a6"/><circle cx="13" cy="24.5" r="1.4" fill="#9aa3a6"/><circle cx="19" cy="24.5" r="1.4" fill="#9aa3a6"/>',
  ),
  road: svg(
    '<path d="M2 20L16 13l14 7-14 7z" fill="#cbbfa8"/><path d="M5 20L16 14.5 27 20 16 25.5z" fill="#55545a"/><path d="M9 18l3-1.5m4-2l3-1.5M13 22l3 1.5m4 2" stroke="#f2e7b6" stroke-width="1.3"/>',
  ),
  line: svg(
    '<path d="M10 28V7M22 28V9" stroke="#8a5a34" stroke-width="2.2"/><path d="M5 8h10M17 10h10" stroke="#8a5a34" stroke-width="2"/><path d="M6 8q10 6 16 2M14 8q6 5 12 2" stroke="#1f1611" stroke-width="1" fill="none"/><path d="M16 15l-3 5h3l-2 5 5-7h-3l2-3z" fill="#ffd84a"/>',
  ),
  zoneR: svg(
    '<path d="M3 21l13-6.5L29 21l-13 6.5z" fill="#7cc06a" opacity=".6"/><path d="M9 21v-6l7-3.5 7 3.5v6l-7 3.5z" fill="#f1e3c6"/><path d="M7 15l9-8 9 8-9-3.5z" fill="#b4532f"/><path d="M14 23v-4l3-1.5v4z" fill="#5b3b26"/>',
  ),
  zoneC: svg(
    '<path d="M3 21l13-6.5L29 21l-13 6.5z" fill="#6fb7e0" opacity=".6"/><path d="M8 21V12l8-4 8 4v9l-8 4z" fill="#e7dccb"/><path d="M8 15l8 4 8-4v-3l-8 4-8-4z" fill="#c8392f"/><path d="M8 17l8 4v-2l-8-4zM16 19l8-4" stroke="#f4ece0" stroke-width="1"/><path d="M10 20l5 2.5v-3l-5-2.5z" fill="#7fb6cf"/>',
  ),
  zoneI: svg(
    '<path d="M3 21l13-6.5L29 21l-13 6.5z" fill="#e0b542" opacity=".6"/><path d="M6 21v-7l6-3 6 3v-3l6 3v7l-9 4.5z" fill="#b36a45"/><rect x="20" y="3" width="4" height="12" fill="#c8462f"/><rect x="20" y="6" width="4" height="2" fill="#efe6d8"/><rect x="20" y="10" width="4" height="2" fill="#efe6d8"/><circle cx="25" cy="2.5" r="2" fill="#d9d4cc"/>',
  ),
  park: svg(
    '<path d="M3 21l13-6.5L29 21l-13 6.5z" fill="#7fb55a"/><path d="M9 17.5l14 7M23 17.5l-14 7" stroke="#e3d2a6" stroke-width="2"/><rect x="15" y="11" width="2" height="9" fill="#6b4a2e"/><circle cx="16" cy="9" r="6" fill="#8e6cc2"/><circle cx="14" cy="7.5" r="2.5" fill="#b49ae2"/>',
  ),
  plant: svg(
    '<path d="M3 23l13-6.5L29 23l-13 6.5z" fill="#b9b2a4"/><rect x="7" y="4" width="4" height="16" fill="#c8462f"/><rect x="7" y="8" width="4" height="2.5" fill="#efe6d8"/><rect x="7" y="14" width="4" height="2.5" fill="#efe6d8"/><path d="M12 24V15l7-3.5 8 4V24l-7.5 3.5z" fill="#b36a45"/><path d="M20 14l-3 5h3l-2 5 5-7h-3l2-3z" fill="#ffd84a"/>',
  ),
  plantGas: svg(
    '<path d="M3 23l13-6.5L29 23l-13 6.5z" fill="#b9b2a4"/><rect x="6" y="6" width="3" height="14" fill="#9aa3a8"/><ellipse cx="15" cy="12" rx="5" ry="2.5" fill="#f4f0e6"/><path d="M10 12v8a5 2.5 0 0010 0v-8" fill="#d9d4cc"/><path d="M19 24v-7l8-2v7l-4 3z" fill="#b9c4cc"/><path d="M13 5c-2-2 0-3 1-4 1 1.5 3 2 1 4z" fill="#3f8fe0"/>',
  ),
  plantWind: svg(
    '<path d="M3 24l13-6.5L29 24l-13 6.5z" fill="#b8ad8c"/><path d="M15 25l.6-15h.8l.6 15z" fill="#f4f0e6" stroke="#9aa3a8" stroke-width=".5"/><path d="M16 10L16 1M16 10l8 4.5M16 10l-8 4.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="10" r="1.6" fill="#c8462f"/>',
  ),
  school: svg(
    '<path d="M4 22V14l12-6 12 6v8l-12 6z" fill="#f4f0e6" stroke="#5a3a22" stroke-width="1"/><path d="M4 18l12 6 12-6" stroke="#6fb7e0" stroke-width="2" fill="none"/><path d="M3 14l13-7 13 7-13 2z" fill="#b4532f"/><path d="M7 3v11" stroke="#d9d4cc" stroke-width="1.2"/><rect x="7.6" y="3" width="8" height="2" fill="#74acdf"/><rect x="7.6" y="5" width="8" height="2" fill="#fff"/><rect x="7.6" y="7" width="8" height="2" fill="#74acdf"/>',
  ),
  clinic: svg(
    '<path d="M5 23v-8l11-5.5L27 15v8l-11 5.5z" fill="#f4f0e6" stroke="#5a3a22" stroke-width="1"/><path d="M5 21l11 5.5L27 21" stroke="#3a8f5c" stroke-width="2" fill="none"/><path d="M13.5 3h5v5h5v5h-5v5h-5v-5h-5V8h5z" fill="#2f9a55" stroke="#f4f0e6" stroke-width="1"/>',
  ),
  police: svg(
    '<path d="M5 24V13l11-5.5L27 13v11l-11 5.5z" fill="#3f5f8a" stroke="#1f1611" stroke-width="1"/><path d="M5 18l11 5.5L27 18" stroke="#f4f0e6" stroke-width="2" fill="none"/><rect x="11" y="3" width="5" height="3" fill="#2f63e0"/><rect x="16" y="3" width="5" height="3" fill="#e03a2f"/>',
  ),
  fire: svg(
    '<path d="M4 24v-9l11-5.5L26 15v9l-11 5.5z" fill="#b8322a" stroke="#5a1a14" stroke-width="1"/><path d="M6 23v-5l4 2v5zM12 26v-5l4 2v5z" fill="#efe6d8"/><path d="M20 12V4h6v11z" fill="#a52b24"/><path d="M22.5 10c-2-2 0-4 1-6 1 2 3 3 1 6z" fill="#ffd84a"/>',
  ),
};
