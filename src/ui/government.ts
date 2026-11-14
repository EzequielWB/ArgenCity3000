/** The government picker of the start screen, as markup: pure, so it can be tested without a DOM. */
import { GOVERNMENTS, GOVERNMENT_KINDS } from '../config';
import { escapeHtml } from './dom';

/** One card per form of government, with its pros and cons in sight and a default checked. */
export function governmentCardsHtml(): string {
  return GOVERNMENT_KINDS.map((id) => {
    const g = GOVERNMENTS[id];
    const pros = g.pros.map((p) => `<li class="pro">+ ${escapeHtml(p)}</li>`).join('');
    const cons = g.cons.map((c) => `<li class="con">− ${escapeHtml(c)}</li>`).join('');
    const checked = id === 'democracia' ? ' checked' : '';
    const recommended = id === 'democracia' ? ' <small>(recomendada)</small>' : '';
    return `<label class="gov-card"><input type="radio" name="startGov" value="${id}"${checked} /><span class="gov-name">${escapeHtml(g.label)}${recommended}</span><span class="gov-blurb">${escapeHtml(g.blurb)}</span><ul class="gov-list">${pros}${cons}</ul></label>`;
  }).join('');
}
