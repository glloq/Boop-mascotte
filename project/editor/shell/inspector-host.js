/**
 * The right-hand column: one inspector with an adapter per kind of selection,
 * the preview controls, and the readiness checklist.
 *
 * Which adapter answers is `ui/context-inspector.js`'s decision, from the
 * selection and the panels on screen. This is the markup it writes into and the
 * hosts the editor draws its inspectors in.
 */
import { gateMarkup } from '../ui/mobile-capabilities.js';

export const inspectorHostMarkup = () => `<aside class="panel-right" aria-label="Inspector and preview"><button class="collapse-panel" id="collapse-right" aria-label="Collapse right panel">›</button><div class="sheet-header" id="sheet-header"><span class="sheet-subject" data-sheet-subject>Inspector</span><div class="sheet-detents"><button type="button" data-sheet-detent="half" aria-label="Sheet half height">▴</button><button type="button" data-sheet-detent="full" aria-label="Sheet full height">▲</button><button type="button" data-sheet-detent="collapsed" aria-label="Collapse sheet">▾</button></div></div><section id="context-inspector" aria-labelledby="context-inspector-heading"><h2 id="context-inspector-heading" data-context-inspector-heading tabindex="-1">Inspector</h2><p class="small" data-context-inspector-empty></p><div id="rig-panel" data-inspector-adapter="semantic"></div><div data-inspector-adapter="artwork">${gateMarkup('bindings', 'mobile')}<div id="inspector"></div></div><div data-inspector-adapter="character" hidden><div id="part-inspector"></div></div><div data-inspector-adapter="expression" hidden><div id="expression-inspector"></div></div><div data-inspector-adapter="motion" hidden><div id="motion-inspector"></div></div><div data-inspector-adapter="reaction" hidden><div id="reaction-inspector"></div></div></section><section class="preview-actions"><div class="card-title"><h2>Preview</h2><div class="action-row"><button id="focus-preview">Focus</button></div></div><p class="small">Test the mascot here. Nothing you do in Preview changes the project.</p><div id="preview-panel"></div></section><section class="publish-tools"><div id="publish-panel"></div></section></aside>`;

export const inspectorHosts = (q) => ({
  contextInspectorEl: q('#context-inspector'),
  rigEl: q('#rig-panel'),
  inspectorEl: q('#inspector'),
  partInspectorEl: q('#part-inspector'),
  expressionInspectorEl: q('#expression-inspector'),
  motionInspectorEl: q('#motion-inspector'),
  reactionInspectorEl: q('#reaction-inspector'),
  previewPanelEl: q('#preview-panel'),
  publishPanelEl: q('#publish-panel')
});
