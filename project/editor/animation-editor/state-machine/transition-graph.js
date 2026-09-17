import { esc } from '../../ui/escape-html.js';

/**
 * The transitions leaving one state, as a list.
 *
 * What used to live here as well was the graph: every state on one horizontal
 * line, every transition a bar in a lane above it, positions recomputed on
 * every render. `state-machine/graph-view.js` replaced it in Phase 10 — a
 * position is authored now, so there is such a thing as moving a node — and
 * this list stayed, because a list answers a different question: not "what does
 * this machine look like" but "what can I do from here".
 */
export function renderTransitionList(rig, from, selectedEdge){return `<section><div class="section-heading"><h3>From ${esc(from||'State')}</h3><button data-action="add-transition">+ Transition</button></div><div class="transition-list" role="list">${(rig.transitions?.[from]||[]).map(to=>{const key=`${from}->${to}`,set=rig.transitionSettings?.[key]||{};return `<button data-select-transition="${esc(key)}" class="${selectedEdge===key?'selected':''}"><span>→ <b>${esc(to)}</b></span><small>${set.duration??300} ms · ${({'easeIn':'Ease In','easeOut':'Ease Out','easeInOut':'Ease In Out','linear':'Linear'})[set.easing||'easeInOut']}</small></button>`}).join('')||'<p class="empty">No explicit outgoing transitions. Legacy projects remain unrestricted until you add one.</p>'}</div></section>`}
