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
  roadDirt: svg(
    '<path d="M2 20L16 13l14 7-14 7z" fill="#cbbfa8"/><path d="M5 20L16 14.5 27 20 16 25.5z" fill="#a07c52"/><path d="M9 19l3-1.5M15 22l3-1.5M19 17l2-1" stroke="#7d5c38" stroke-width="1.6"/><circle cx="12" cy="21" r="0.9" fill="#7d5c38"/><circle cx="21" cy="20" r="0.9" fill="#7d5c38"/>',
  ),
  road: svg(
    '<path d="M2 20L16 13l14 7-14 7z" fill="#cbbfa8"/><path d="M5 20L16 14.5 27 20 16 25.5z" fill="#55545a"/><path d="M9 18l3-1.5m4-2l3-1.5M13 22l3 1.5m4 2" stroke="#f2e7b6" stroke-width="1.3"/>',
  ),
  roadPaved: svg(
    '<path d="M2 20L16 13l14 7-14 7z" fill="#cbbfa8"/><path d="M5 20L16 14.5 27 20 16 25.5z" fill="#3c3b42"/><path d="M9 18l3-1.5m4-2l3-1.5M13 22l3 1.5m4 2M7 19.6l3-1.5m6-3l3-1.5" stroke="#fff6c8" stroke-width="1.4"/>',
  ),
  roadBoulevard: svg(
    '<path d="M2 20L16 13l14 7-14 7z" fill="#cbbfa8"/><path d="M5 20L16 14.5 27 20 16 25.5z" fill="#3c3b42"/><path d="M14 15.6l4 2v2.2l-4-2z" fill="#7cc06a"/><path d="M9 18l3-1.5m4-2l3-1.5M13 22l3 1.5m4 2" stroke="#fff6c8" stroke-width="1.2"/><circle cx="19" cy="14.6" r="1.2" fill="#ffd84a"/><circle cx="11" cy="21.4" r="1.2" fill="#ffd84a"/>',
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
  hospital: svg(
    '<path d="M4 24V9l12-6 12 6v15l-12 6z" fill="#f4f0e6" stroke="#5a3a22" stroke-width="1"/><path d="M4 20l12 6 12-6" stroke="#6fb7e0" stroke-width="2" fill="none"/><path d="M14 8h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill="#d23a32" stroke="#f4f0e6" stroke-width="1"/>',
  ),
  university: svg(
    '<path d="M4 24V15l12-6 12 6v9l-12 6z" fill="#b4532f" stroke="#3a1f12" stroke-width="1"/><path d="M4 20l12 6 12-6" stroke="#f4f0e6" stroke-width="2" fill="none"/><path d="M16 2l11 5-11 5-11-5z" fill="#1f1611" stroke="#f4f0e6" stroke-width="1"/><path d="M27 7v6" stroke="#e0a526" stroke-width="1.6"/>',
  ),
  police: svg(
    '<path d="M5 24V13l11-5.5L27 13v11l-11 5.5z" fill="#3f5f8a" stroke="#1f1611" stroke-width="1"/><path d="M5 18l11 5.5L27 18" stroke="#f4f0e6" stroke-width="2" fill="none"/><rect x="11" y="3" width="5" height="3" fill="#2f63e0"/><rect x="16" y="3" width="5" height="3" fill="#e03a2f"/>',
  ),
  fishing: svg(
    '<path d="M2 20l14-7 14 7-14 7z" fill="#4f8fb0"/><path d="M2 20l14 7 14-7" stroke="#cfe6ec" stroke-width="1" fill="none"/><path d="M7 21l14-7 3 1.5-14 7z" fill="#a9763f" stroke="#5a3a22" stroke-width="1"/><path d="M9 24v4M15 21v4M21 18v4" stroke="#5a3a22" stroke-width="1.8"/><path d="M20 22q5 3.5 10 0l-2 3.5q-3 1-6 0z" fill="#c8462f" stroke="#5a1a14" stroke-width=".8"/><path d="M25 22v-7l3 5z" fill="#f4f0e6"/>',
  ),
  promenade: svg(
    '<path d="M3 21l13-6.5L29 21l-13 6.5z" fill="#d6cdbb"/><path d="M9 21.5l7-3.5 7 3.5M13 23.5l3-1.5" stroke="#b9ae9a" stroke-width="1" fill="none"/><path d="M3 21l13 6.5L29 21" stroke="#7a6a58" stroke-width="1.4" fill="none"/><path d="M3 16.5l13 6.5 13-6.5" stroke="#efe9dc" stroke-width="1.6" fill="none"/><path d="M3 16.5v4.5M10 20v4.5M16 23v4.5M22 20v4.5M29 16.5v4.5" stroke="#efe9dc" stroke-width="1.2"/><path d="M25 5v13" stroke="#5a5560" stroke-width="1.8"/><circle cx="25" cy="4.5" r="3.2" fill="#ffe08a" stroke="#5a5560" stroke-width="1"/>',
  ),
  port: svg(
    '<path d="M2 23l14-7 14 7-14 7z" fill="#b9b2a4"/><path d="M4 22v-5l5-2.5 5 2.5v5l-5 2.5z" fill="#c8462f" stroke="#5a1a14" stroke-width=".8"/><path d="M13 25v-5l5-2.5 5 2.5v5l-5 2.5z" fill="#3f6f9f" stroke="#1f3a52" stroke-width=".8"/><path d="M9 14v-5l5-2.5 5 2.5v5z" fill="#e0a526" stroke="#5a3a22" stroke-width=".8" transform="translate(0 2)"/><path d="M24 26V5M29 23V8M22 6h9" stroke="#e0a526" stroke-width="2.2"/><path d="M22 6l-4 5" stroke="#e0a526" stroke-width="1.6"/><path d="M18 11v4" stroke="#3a2a20" stroke-width="1"/>',
  ),
  resort: svg(
    '<path d="M2 22l14-7 14 7-14 7z" fill="#e2cc94"/><path d="M2 22l14 7 14-7" stroke="#cfe6ec" stroke-width="1" fill="none"/><path d="M7 14q8-9 16 0z" fill="#e0453a"/><path d="M11 14q1.5-8 5-9.5M19 14q-1.5-8-5-9.5" stroke="#f4f0e6" stroke-width="1.6" fill="none"/><path d="M15 5v18" stroke="#5a3a22" stroke-width="1.6"/><path d="M19 24l5-2.5 5 2.5v3l-5 2.5-5-2.5z" fill="#a9763f" stroke="#5a3a22" stroke-width=".8"/><path d="M18 24l6-3 6 3" fill="#e9c46a" stroke="#8a6a22" stroke-width=".8"/>',
  ),
  lighthouse: svg(
    '<path d="M3 26l13-6.5L29 26l-13 6.5z" fill="#e2cc94"/><path d="M11 27l2-17h6l2 17z" fill="#f4f0e6" stroke="#5a3a22" stroke-width="1"/><path d="M12.2 21.5l.4-4.5h6.8l.4 4.5zM13.2 14.5l.4-3h4.8l.4 3z" fill="#c8392f"/><path d="M12 10h8v-2.5h-8z" fill="#5a5560"/><rect x="13.5" y="4.5" width="5" height="3" fill="#ffd84a"/><path d="M12.5 4.5l3.5-3.5 3.5 3.5z" fill="#c8392f"/><path d="M22 6l7-2M22 6l7 2.5M10 6l-7-2M10 6l-7 2.5" stroke="#ffd84a" stroke-width="1.2" opacity=".8"/>',
  ),
  airport: svg(
    '<path d="M2 23l14-7 14 7-14 7z" fill="#b9b2a4"/><path d="M5 23l11-5.5L27 23l-11 5.5z" fill="#4a4a52"/><path d="M9 23.5l3-1.5m3 2.2l3-1.5m3 2.2l3-1.5" stroke="#f4f0e6" stroke-width="1.2"/><path d="M10 18l11-5.5 2 1-11 5.5z" fill="#f4f0e6" stroke="#5a5560" stroke-width=".8"/><path d="M15 15.5l-1.5-6 2.6 1.3 1.4 4.2zM21 12.5l1.2-3.2 1.4.7-.6 3.2z" fill="#d9d4cc" stroke="#5a5560" stroke-width=".6"/>',
  ),
  harbor: svg(
    '<path d="M2 23l14-7 14 7-14 7z" fill="#4f8fb0"/><path d="M3 19l8-4 5 2.5-8 4z" fill="#a9763f" stroke="#5a3a22" stroke-width=".8"/><path d="M16 23l8-3.2 4 2-8 3.6z" fill="#f4f0e6" stroke="#5a5560" stroke-width=".8"/><path d="M20 19l3-1.2v3.4l-3 1.2z" fill="#6fb7e0"/><path d="M23 15.5l2.2-.9v3l-2.2.9z" fill="#c8392f"/>',
  ),
  bus: svg(
    '<path d="M2 22l14-7 14 7-14 7z" fill="#b9b2a4"/><path d="M4 19v-7l12-6 12 6v7l-12 6z" fill="#c8392f" stroke="#5a1a14" stroke-width="1"/><path d="M4 12l12-6 12 6-12 6z" fill="#e8c0b8"/><path d="M6 14l3.5 1.8v3L6 17zM11 16.6l3.5 1.8v3L11 19.6z" fill="#9fd3ee"/><circle cx="9" cy="23" r="2" fill="#1f1611"/><circle cx="21" cy="20" r="2" fill="#1f1611"/>',
  ),
  fire: svg(
    '<path d="M4 24v-9l11-5.5L26 15v9l-11 5.5z" fill="#b8322a" stroke="#5a1a14" stroke-width="1"/><path d="M6 23v-5l4 2v5zM12 26v-5l4 2v5z" fill="#efe6d8"/><path d="M20 12V4h6v11z" fill="#a52b24"/><path d="M22.5 10c-2-2 0-4 1-6 1 2 3 3 1 6z" fill="#ffd84a"/>',
  ),
  obelisco: svg(
    '<path d="M2 22l14-7 14 7-14 7z" fill="#8fbf6a"/><path d="M9 24l3-9h8l3 9z" fill="#f4f0e6" stroke="#6b6459" stroke-width="1"/><path d="M12 15l1-8h6l1 8z" fill="#fbf8f0" stroke="#6b6459" stroke-width="1"/><path d="M13 7l3-5 3 5z" fill="#d9d4cc" stroke="#6b6459" stroke-width="1"/><path d="M14 12h4M13.4 15.5h5.2" stroke="#b9b2a4" stroke-width="1"/><path d="M20 5v5" stroke="#5a5560" stroke-width="1"/><circle cx="20" cy="4" r="1.6" fill="#ffd84a"/>',
  ),
  calvario: svg(
    '<path d="M2 25l14-7 14 7-14 7z" fill="#8fbf6a"/><path d="M8 26l4-6 10-3 6 3-10 3z" fill="#b9b2a4"/><path d="M11 21l2.5-4.5 9-2.5 4 2.5-9 2.5z" fill="#a8a196"/><path d="M13.5 17l2-3.5 8-2 3 2-8 2z" fill="#cfc8bb"/><path d="M18 14v-6M15.5 10.5h5" stroke="#6b4a2e" stroke-width="1.8"/><path d="M24 13v-5M22 10h4" stroke="#6b4a2e" stroke-width="1.6"/><path d="M12 14.5v-4M10.5 12.5h3" stroke="#6b4a2e" stroke-width="1.4"/><circle cx="26" cy="17" r="2" fill="#4f8a3c"/><circle cx="7" cy="19" r="1.8" fill="#4f8a3c"/>',
  ),
  puente: svg(
    '<path d="M0 20l16-6 16 6-16 8z" fill="#4f8fb0"/><path d="M1 19.5l15 7 15-7" stroke="#cfe6ec" stroke-width="1.2" fill="none"/><path d="M3 18l13 5.5v2L2 19.8z" fill="#efe6d8" stroke="#7a6a58" stroke-width=".8"/><path d="M5 17l3-9h2l-3 9zM24 17l-3-9h-2l3 9z" fill="#8a5a34" stroke="#5a3a22" stroke-width=".7"/><path d="M6 8h20" stroke="#5a3a22" stroke-width="1.2"/><path d="M6.5 8.6q10 6 19 0" stroke="#5a3a22" stroke-width=".9" fill="none"/><path d="M11 8.6v8M16 8.6v7.6M21 8.6v8" stroke="#5a3a22" stroke-width=".8"/>',
  ),
  teatro: svg(
    '<path d="M3 22l13-6.5L29 22l-13 6.5z" fill="#c9b48a"/><path d="M6 22v-7l10-5 10 5v7l-10 5z" fill="#f1e3c6" stroke="#5a3a22" stroke-width="1"/><path d="M10 22v-4.5l6-3 6 3V22" fill="#efe6d8"/><path d="M12 22v-4M16 22v-4.5M20 22v-4" stroke="#b9a98a" stroke-width="1.4"/><path d="M6 15l10-5 10 5-10 2z" fill="#7a2f3a"/><path d="M16 4c3.5 0 5 2 5 4.5h-10C11 6 12.5 4 16 4z" fill="#8a9a86" stroke="#5a5560" stroke-width=".8"/><path d="M16 2v2" stroke="#e0a526" stroke-width="1.4"/><circle cx="8" cy="10" r="1.4" fill="#ffd84a"/><circle cx="24" cy="10" r="1.4" fill="#ffd84a"/>',
  ),
  cabildo: svg(
    '<path d="M2 24l14-7 14 7-14 7z" fill="#8fbf6a"/><path d="M4 23v-8l12-6 12 6v8l-12 6z" fill="#efe6d2" stroke="#6b6459" stroke-width="1"/><path d="M4 15l12-6 12 6-12 3z" fill="#a8503c"/><path d="M6 18h2.4v4.4H6zM10 18h2.4v4.4H10zM14 18h2.4v4.4H14zM18 18h2.4v4.4H18zM22 18h2.4v4.4H22z" fill="#6b6257"/><path d="M13 13h6v10h-6z" fill="#f7f2e6" stroke="#6b6459" stroke-width=".8"/><path d="M16 9l4 4h-8z" fill="#a8503c"/><circle cx="16" cy="17" r="1.4" fill="#3b352e"/><path d="M16 6v2" stroke="#5d554b" stroke-width="1"/><path d="M16.5 5h3v2h-3z" fill="#7cb0d8"/>',
  ),
  regimiento: svg(
    '<path d="M2 24l14-7 14 7-14 7z" fill="#b9a888"/><path d="M4 22v-5l9-4.5 9 4.5v5l-9 4.5z" fill="#e2dccb" stroke="#6b6459" stroke-width="1"/><path d="M4 17l9-4.5 9 4.5-9 2z" fill="#5d7a54"/><path d="M7 19h1.8v2.6H7zM11 19h1.8v2.6H11zM15 19h1.8v2.6H15z" fill="#5a5348"/><path d="M23 12v12" stroke="#8f8b82" stroke-width="1.4"/><path d="M23 6v6" stroke="#8f8b82" stroke-width="1.2"/><path d="M24 5h6v4h-6z" fill="#7cb0d8"/><path d="M24 6.6h6v1.6h-6z" fill="#f4f1e8"/><path d="M25 11h3v9h-3z" fill="#efe9da" stroke="#6b6459" stroke-width=".8"/><path d="M25 8.6l1.5-1.6 1.5 1.6z" fill="#5d7a54"/>',
  ),
  planetario: svg(
    '<path d="M2 25l14-7 14 7-14 7z" fill="#c9c4b4"/><path d="M6 24l10-5 10 5-10 5z" fill="#79a95f"/><path d="M12 22v-5h8v5z" fill="#eae4d6" stroke="#8f8b82" stroke-width=".8"/><circle cx="16" cy="12" r="7.5" fill="#dfe7ea" stroke="#8f8b82" stroke-width=".8"/><path d="M8.8 12.6a7.5 4 0 0014.4 0" stroke="#4a5560" stroke-width="1.6" fill="none"/><path d="M15 4.6h2v3h-2z" fill="#e8e2d4"/><path d="M13.6 4.6h4.8l-2.4-2.2z" fill="#b9b2a4"/><circle cx="11" cy="8" r="1.6" fill="#4f8a3c"/><circle cx="21" cy="20" r="1.4" fill="#4f8a3c"/>',
  ),
  santuario: svg(
    '<path d="M2 25l14-7 14 7-14 7z" fill="#c9c2b1"/><path d="M6 24v-11l10-5 10 5v11l-10 5z" fill="#9c5a44" stroke="#5a3228" stroke-width="1"/><path d="M6 13l10-5 10 5-10 2.4z" fill="#7d4433"/><path d="M7 20v-6l3-1.5 3 1.5v6l-3 1.5z" fill="#7d4433"/><path d="M19 20v-6l3-1.5 3 1.5v6l-3 1.5z" fill="#7d4433"/><path d="M13.6 21v-6l2.4-1.2 2.4 1.2v6l-2.4 1.2z" fill="#b06a4e"/><circle cx="16" cy="15" r="2" fill="#3f5a72" stroke="#e5ddc8" stroke-width=".7"/><path d="M10 8l3 3h-6z" fill="#8a4a3a"/><path d="M22 8l3 3h-6z" fill="#8a4a3a"/><path d="M10 5v3M22 5v3" stroke="#5d554b" stroke-width=".9"/>',
  ),
  sindicato: svg(
    '<path d="M2 24l14-7 14 7-14 7z" fill="#c2bba9"/><path d="M4 23v-10l12-6 12 6v10l-12 6z" fill="#d8d2c2" stroke="#6b6459" stroke-width="1"/><path d="M4 13l12-6 12 6-12 2.6z" fill="#e6e0d0"/><path d="M7 17h18v3H7z" fill="#54707f"/><path d="M12 21h8v5h-8z" fill="#4a423a"/><path d="M6 19.4h20v2.4H6z" fill="#b23a2e" transform="translate(0,1)"/><circle cx="16" cy="21.8" r="1.2" fill="#f2efe6"/><path d="M23 8v11" stroke="#7d776d" stroke-width="1.2"/><path d="M24 7h4v3h-4z" fill="#b23a2e"/>',
  ),  estadio: svg(
    '<path d="M2 22l14-7 14 7-14 7z" fill="#b9b2a4"/><path d="M16 12l13 6.5-13 6.5-13-6.5z" fill="#8a8b90" stroke="#4a4a52" stroke-width="1"/><path d="M16 15l8 4-8 4-8-4z" fill="#3f8f4a"/><path d="M16 15l8 4-8 4-8-4z" stroke="#f4f0e6" stroke-width=".8" fill="none"/><path d="M16 15v8M8 19h16" stroke="#e8f0e0" stroke-width=".7"/><path d="M5 12V4M27 12V4" stroke="#5a5560" stroke-width="1.6"/><rect x="3.5" y="2.5" width="3" height="2" fill="#ffd84a"/><rect x="25.5" y="2.5" width="3" height="2" fill="#ffd84a"/><path d="M6.5 4h19" stroke="#5a5560" stroke-width=".8" opacity=".6"/>',
  ),
};
