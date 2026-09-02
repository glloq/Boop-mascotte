const SNAPSHOT_VERSION = 3;
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';

export function hasValidProjectDocument(state, serializeSvg) {
  const markup = serializeSvg ? serializeSvg() : state?.svgMarkup;
  return typeof markup === 'string' && /<svg\b/i.test(markup) && /<(?:path|rect|circle|ellipse|line|polyline|polygon|text|image|use|g)\b/i.test(markup);
}

export function createProjectSnapshot(state, serializeSvg) {
  if (!hasValidProjectDocument(state, serializeSvg)) throw new Error('Project has no valid SVG document');
  const rig = normalizeRig({
    schemaVersion: RIG_SCHEMA_VERSION, params: state.params, states: state.states, elements: state.elements,
    activeState: state.activeState, transitions: state.transitions, transitionSettings: state.transitionSettings,
    globalConstraints: state.globalConstraints, stateConstraints: state.stateConstraints,
    runtimeConfig: state.runtimeConfig, behaviors: state.behaviors
  });
  return {
    version: SNAPSHOT_VERSION,
    capturedAt: new Date().toISOString(),
    document: {
      svgMarkup: serializeSvg ? serializeSvg() : (state.svgMarkup || ''),
      layers: state.layers || [],
      layerMetadata: state.layerMetadata || {},
      rig,
      editor: { semanticParts: structuredClone(state.semanticParts || {}), animationClips: structuredClone(state.animationClips || []), expressions: structuredClone(state.expressions || []), reactions: structuredClone(state.reactions || []), animationEditor: structuredClone(state.animationEditor || {}) }
    }
  };
}

export function applyProjectSnapshot(state, snapshot) {
  if (!snapshot?.document?.rig) throw new Error('Invalid project snapshot');
  if (![1, 2, 3].includes(snapshot.version ?? 1)) throw new Error('Unsupported project snapshot version');
  const { svgMarkup } = snapshot.document;
  const rig = normalizeRig(snapshot.document.rig);

  state.svgMarkup = svgMarkup || '';
  state.layers = Array.isArray(snapshot.document.layers) ? [...snapshot.document.layers] : Object.keys(rig.elements || {});
  state.layerMetadata = snapshot.document.layerMetadata && typeof snapshot.document.layerMetadata === 'object' ? structuredClone(snapshot.document.layerMetadata) : {};
  // Selection is editor context, not authored project data. Older snapshots may
  // contain selectedId; deliberately ignore it for backwards compatibility.
  state.selectedId = null;
  if (rig.params) state.params = { ...rig.params };
  if (rig.states) state.states = { ...rig.states };
  if (rig.transitions) state.transitions = { ...rig.transitions };
  state.transitionSettings = rig.transitionSettings && typeof rig.transitionSettings === 'object' ? structuredClone(rig.transitionSettings) : {};
  if (rig.activeState && rig.states?.[rig.activeState]) state.activeState = rig.activeState;
  if (rig.globalConstraints) state.globalConstraints = { ...rig.globalConstraints };
  if (rig.stateConstraints) state.stateConstraints = { ...rig.stateConstraints };
  if (rig.runtimeConfig) state.runtimeConfig = { ...rig.runtimeConfig };
  state.behaviors = Array.isArray(rig.behaviors) ? structuredClone(rig.behaviors) : [];
  if (rig.elements) state.elements = { ...rig.elements };
  const editor = snapshot.document.editor || {};
  state.semanticParts = editor.semanticParts && typeof editor.semanticParts === 'object' ? structuredClone(editor.semanticParts) : {};
  state.animationClips = Array.isArray(editor.animationClips) ? structuredClone(editor.animationClips) : [];
  // Additive since UX-09: older snapshots simply have no expressions.
  state.expressions = Array.isArray(editor.expressions) ? structuredClone(editor.expressions) : [];
  // Additive since UX-13: older snapshots simply have no reactions.
  state.reactions = Array.isArray(editor.reactions) ? structuredClone(editor.reactions) : [];
  state.animationEditor = editor.animationEditor && typeof editor.animationEditor === 'object' ? structuredClone(editor.animationEditor) : { activeClipId: null, playhead: 0, panel: 'preview' };
  const activeClip = state.animationClips.find(clip => clip.id === state.animationEditor.activeClipId) || state.animationClips[0];
  state.animationEditor.activeClipId = activeClip?.id || null;
  state.animationEditor.playhead = Math.max(0, Math.min(Number(state.animationEditor.playhead) || 0, activeClip?.duration || 0));
}

/** Purely validates and normalizes a snapshot before the live editor is touched. */
export function prepareProjectSnapshot(snapshot, sanitizeSvg) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid project snapshot');
  if (![1, 2, 3].includes(snapshot.version ?? 1)) throw new Error('Unsupported project snapshot version');
  if (!snapshot.document || typeof snapshot.document !== 'object' || !snapshot.document.rig) throw new Error('Invalid project snapshot');
  if (typeof snapshot.document.svgMarkup !== 'string' || !snapshot.document.svgMarkup.trim()) throw new Error('Project has no SVG document');
  const prepared = structuredClone(snapshot);
  prepared.document.svgMarkup = sanitizeSvg(prepared.document.svgMarkup);
  const candidate = {};
  applyProjectSnapshot(candidate, prepared);
  prepared.document.rig = normalizeRig(prepared.document.rig);
  prepared.document.layers = Array.isArray(prepared.document.layers) ? prepared.document.layers : [];
  prepared.document.layerMetadata = prepared.document.layerMetadata && typeof prepared.document.layerMetadata === 'object' ? prepared.document.layerMetadata : {};
  prepared.document.editor ||= {};
  prepared.document.editor.semanticParts = candidate.semanticParts;
  prepared.document.editor.animationClips = candidate.animationClips;
  prepared.document.editor.animationEditor = candidate.animationEditor;
  delete prepared.document.selectedId;
  return prepared;
}
