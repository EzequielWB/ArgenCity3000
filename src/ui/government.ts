/** The government picker of the founding window, as markup: pure, so it can be tested without a DOM. */
import { GOVERNMENTS, GOVERNMENT_KINDS, type GovernmentKind } from '../config';
import { escapeHtml } from './dom';

/**
 * One closed card per form of government: its name and a line, and the pros and cons when it is opened. None is
 * open (and so none chosen) unless `open` says so; opening one closes the others (see `openGovernment`).
 */
export function governmentCardsHtml(open: GovernmentKind | null = null): string {
  return GOVERNMENT_KINDS.map((id) => {
    const g = GOVERNMENTS[id];
    const pros = g.pros.map((p) => `<li class="pro">+ ${escapeHtml(p)}</li>`).join('');
    const cons = g.cons.map((c) => `<li class="con">− ${escapeHtml(c)}</li>`).join('');
    const isOpen = id === open;
    const recommended = id === 'democracia' ? ' <small>(recomendada)</small>' : '';
    return `<div class="gov-card${isOpen ? ' open' : ''}" data-gov="${id}"><button type="button" class="gov-head" aria-expanded="${isOpen}"><span class="gov-name">${escapeHtml(g.label)}${recommended}</span><span class="gov-blurb">${escapeHtml(g.blurb)}</span></button><ul class="gov-list"${isOpen ? '' : ' hidden'}>${pros}${cons}</ul></div>`;
  }).join('');
}
