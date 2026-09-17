import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { canOpenProjectVersion, projectVersionFor, projectVersionOf } from './project-version.js';
import { normalizeAssets } from '../assets/asset-model.js';
import { migrateProject } from './migrations/project-migrations.js';

/**
 * A project is valid once it has an SVG document, drawn on or not: a blank
 * canvas is a project that can be saved, autosaved and exported, the same way
 * an empty file is a file. Imports still ask for artwork (`prepareSvgImport`),
 * because an SVG with nothing in it is almost always the wrong file.
 */
export function hasValidProjectDocument(state, serializeSvg) {
  const markup = serializeSvg ? serializeSvg() : state?.svgMarkup;
  return typeof markup === 'string' && /<svg\b/i.test(markup);
}

export function createProjectSnapshot(state, serializeSvg) {
  if (!hasValidProjectDocument(state, serializeSvg)) throw new Error('Project has no valid SVG document');
  const rig = normalizeRig({
    schemaVersion: RIG_SCHEMA_VERSION, params: state.params, states: state.states, elements: state.elements,
    activeState: state.activeState, transitions: state.transitions, transitionSettings: state.transitionSettings,
    globalConstraints: state.globalConstraints, stateConstraints: state.stateConstraints,
    runtimeConfig: state.runtimeConfig, behaviors: state.behaviors, keyforms: state.keyforms, shapeKeys: state.shapeKeys, warps: state.warps, rigPins: state.rigPins, rigConstraints: state.rigConstraints, rigAttachments: state.rigAttachments, rigHolds: state.rigHolds, hands: state.hands, deformers: state.deformers, parallax: state.parallax, followers: state.followers, expressionBlend: state.expressionBlend, motionBlend: state.motionBlend, gazeSolver: state.gazeSolver
  });
  const document = {
    svgMarkup: serializeSvg ? serializeSvg() : (state.svgMarkup || ''),
    layers: state.layers || [],
    layerMetadata: state.layerMetadata || {},
    // Beside the rig rather than inside it: what the artwork points at is a
    // project concern, and the runtime rig schema knows nothing about it.
    assets: normalizeAssets(state.assets),
    rig,
    editor: { semanticParts: structuredClone(state.semanticParts || {}), animationClips: structuredClone(state.animationClips || []), expressions: structuredClone(state.expressions || []), reactions: structuredClone(state.reactions || []), animationEditor: structuredClone(state.animationEditor || {}), rigHandles: structuredClone(state.rigHandles || []), rigLinks: structuredClone(state.rigLinks || []), arrangement: structuredClone(state.arrangement || { placements: [] }) }
  };
  // The oldest reader that can still read it, not the newest thing that wrote
  // it: a project that gained nothing new stays openable by an editor that
  // gained nothing new.
  return { version: projectVersionFor(document), capturedAt: new Date().toISOString(), document };
}

/**
 * A snapshot onto a state object. It checks the version but does not migrate:
 * migration happens once, at the boundary the file arrives through
 * (`prepareProjectSnapshot`), because callers read `document.svgMarkup`
 * *before* they apply -- the canvas is loaded from it first -- and a step that
 * rewrote the markup here would rewrite it after the canvas had already read
 * the old one.
 */
export function applyProjectSnapshot(state, snapshot) {
  if (!snapshot?.document?.rig) throw new Error('Invalid project snapshot');
  if (!canOpenProjectVersion(projectVersionOf(snapshot))) throw new Error('Unsupported project snapshot version');
  const { svgMarkup } = snapshot.document;
  const rig = normalizeRig(snapshot.document.rig);

  state.svgMarkup = svgMarkup || '';
  // Additive since V4: a snapshot written before assets simply has none.
  state.assets = normalizeAssets(snapshot.document.assets);
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
  // Additive since V2: older snapshots normalize to an empty pose-grid list.
  state.keyforms = Array.isArray(rig.keyforms) ? structuredClone(rig.keyforms) : [];
  state.shapeKeys = Array.isArray(rig.shapeKeys) ? structuredClone(rig.shapeKeys) : [];
  state.warps = Array.isArray(rig.warps) ? structuredClone(rig.warps) : [];
  // Additive since the control rig: a snapshot written before pins has none.
  state.rigPins = Array.isArray(rig.rigPins) ? structuredClone(rig.rigPins) : [];
  state.rigConstraints = Array.isArray(rig.rigConstraints) ? structuredClone(rig.rigConstraints) : [];
  state.rigAttachments = Array.isArray(rig.rigAttachments) ? structuredClone(rig.rigAttachments) : [];
  state.rigHolds = Array.isArray(rig.rigHolds) ? structuredClone(rig.rigHolds) : [];
  state.hands = rig.hands ? structuredClone(rig.hands) : null;
  state.deformers = Array.isArray(rig.deformers) ? structuredClone(rig.deformers) : [];
  state.parallax = rig.parallax ? structuredClone(rig.parallax) : null;
  // Additive since 3D-10: a snapshot written before anything trailed behind the
  // head simply has nothing trailing.
  state.followers = Array.isArray(rig.followers) ? structuredClone(rig.followers) : [];
  state.expressionBlend = rig.expressionBlend ? structuredClone(rig.expressionBlend) : null;
  // Additive since the control rig: a snapshot written before the gaze solver
  // simply has no solver, which normalizes to one that is switched off.
  state.gazeSolver = rig.gazeSolver ? structuredClone(rig.gazeSolver) : null;
  state.motionBlend = rig.motionBlend ? structuredClone(rig.motionBlend) : null;
  if (rig.elements) state.elements = { ...rig.elements };
  const editor = snapshot.document.editor || {};
  state.semanticParts = editor.semanticParts && typeof editor.semanticParts === 'object' ? structuredClone(editor.semanticParts) : {};
  state.animationClips = Array.isArray(editor.animationClips) ? structuredClone(editor.animationClips) : [];
  // Additive: a snapshot written before handles were authorable simply has none.
  state.rigHandles = Array.isArray(editor.rigHandles) ? structuredClone(editor.rigHandles) : [];
  // Additive: a snapshot written before controls could be linked has none linked.
  state.rigLinks = Array.isArray(editor.rigLinks) ? structuredClone(editor.rigLinks) : [];
  // Additive: a snapshot written before clips could be arranged simply has none.
  state.arrangement = editor.arrangement && typeof editor.arrangement === 'object' ? structuredClone(editor.arrangement) : { placements: [] };
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
  if (!canOpenProjectVersion(projectVersionOf(snapshot))) throw new Error('Unsupported project snapshot version');
  if (!snapshot.document || typeof snapshot.document !== 'object' || !snapshot.document.rig) throw new Error('Invalid project snapshot');
  if (typeof snapshot.document.svgMarkup !== 'string' || !snapshot.document.svgMarkup.trim()) throw new Error('Project has no SVG document');
  // The one place a file is brought up to the current format. A step that
  // throws throws here, before the live editor has been touched at all, and
  // the caller's own object is never the one that was migrated.
  const { snapshot: migrated, from, to, applied } = migrateProject(snapshot);
  const prepared = structuredClone(migrated);
  // What was done to open it, for whoever wants to say so -- session
  // information, since a save builds its snapshot from the store and never
  // carries this. Reported when the file was not already the version it now
  // is, or when a step actually rewrote something; a rung the reader absorbs
  // is neither.
  if (from !== to || applied.length) prepared.migratedFrom = { version: from, applied };
  prepared.document.svgMarkup = sanitizeSvg(prepared.document.svgMarkup);
  const candidate = {};
  applyProjectSnapshot(candidate, prepared);
  prepared.document.rig = normalizeRig(prepared.document.rig);
  prepared.document.layers = Array.isArray(prepared.document.layers) ? prepared.document.layers : [];
  prepared.document.layerMetadata = prepared.document.layerMetadata && typeof prepared.document.layerMetadata === 'object' ? prepared.document.layerMetadata : {};
  prepared.document.assets = candidate.assets;
  prepared.document.editor ||= {};
  prepared.document.editor.semanticParts = candidate.semanticParts;
  prepared.document.editor.animationClips = candidate.animationClips;
  prepared.document.editor.animationEditor = candidate.animationEditor;
  prepared.document.editor.rigHandles = candidate.rigHandles;
  prepared.document.editor.rigLinks = candidate.rigLinks;
  prepared.document.editor.arrangement = candidate.arrangement;
  delete prepared.document.selectedId;
  return prepared;
}
