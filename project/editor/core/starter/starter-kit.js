// Starter kit: one press that fills an empty mascot with the faces, motions,
// reactions and automatic life a beginner would otherwise author one card at a
// time. It creates nothing new — every item is an ordinary preset going
// through the ordinary model operations, so the result is exactly what the
// author would have built by hand, and one undo removes all of it.
import { createExpression, findExpression } from '../expressions/expression-model.js';
import { EXPRESSION_PRESETS, instantiatePreset, presetById as expressionPresetById } from '../expressions/expression-presets.js';
import { REQUIRED_VISEME_KEYS, VISEME_KEYS } from '../face-library/face-states.js';
import { installVisemes, installedVisemes, visemeExpressionName } from '../face-library/face-state-install.js';
import { createMotionClip } from '../motion/motion-model.js';
import { MOTION_PRESETS, presetById as motionPresetById } from '../motion/motion-presets.js';
import { createReaction, findReaction } from '../reactions/reaction-model.js';
import { REACTION_PRESETS, instantiateReactionPreset } from '../reactions/reaction-presets.js';
import { automaticPresetBlockers, enableAutomaticPreset, requireAutomaticPreset } from '../behaviors/automatic-model.js';
import { deriveAutomaticStatus } from '../behaviors/automatic-presets.js';

/**
 * The curated set. Deliberately short: enough that the mascot feels finished,
 * few enough that the lists stay readable. The whole catalogue is one click
 * further, in each panel.
 */
export const STARTER_KIT = Object.freeze({
  expressions: Object.freeze(['happy', 'sad', 'surprised', 'angry', 'curious', 'excited', 'sleepy', 'confused']),
  motions: Object.freeze(['nod', 'shake', 'bounce', 'tilt', 'blink', 'look-around']),
  reactions: Object.freeze(['surprise', 'greet', 'notice', 'glance']),
  automatic: Object.freeze(['blink', 'natural-gaze', 'idle-head']),
  // The eight a mouth needs to read as speaking (docs/VISEME_SYSTEM.md). `WQ`
  // is the ninth and is offered rather than shipped: a `w` is an `OO` that
  // opens, and a mascot without it loses very little.
  visemes: REQUIRED_VISEME_KEYS
});

/**
 * Everything, for a mascot that is meant to arrive finished.
 *
 * The template ships this: a beginner opening Basic Face gets every face,
 * every motion and every reaction the catalogues can build on it, rather than
 * six clips and two empty lists. The kit skips whatever a project cannot do,
 * so the same list serves a face the Face Builder generated.
 *
 * The automatic behaviours are the one part that is *not* everything, and not
 * for want of ambition: two behaviours writing the same parameter fight, so
 * `eye-wander` cannot run beside `natural-gaze` nor `head-drift` beside
 * `idle-head`. These three are the set that runs together; the alternatives
 * are one press away in Animate.
 */
export const FULL_KIT = Object.freeze({
  expressions: Object.freeze(EXPRESSION_PRESETS.map((preset) => preset.id)),
  motions: Object.freeze(MOTION_PRESETS.map((preset) => preset.id)),
  reactions: Object.freeze(REACTION_PRESETS.map((preset) => preset.id)),
  automatic: Object.freeze(['blink', 'natural-gaze', 'idle-head']),
  visemes: VISEME_KEYS
});

const entry = (kind, id, name, action, reason = null) => ({ kind, id, name, action, reason });

/**
 * A throwaway document to plan against. The kit only appends to four lists and
 * re-enables existing behaviors, so copying those is enough — and it keeps the
 * plan off `structuredClone`, which the panels would otherwise pay for on every
 * render of a long project.
 */
export const starterKitDraft = (document = {}) => ({
  ...document,
  expressions: [...(document.expressions || [])],
  animationClips: [...(document.animationClips || [])],
  reactions: [...(document.reactions || [])],
  behaviors: (document.behaviors || []).map((item) => ({ ...item }))
});
const labels = (missing) => missing.map((item) => item.label).join(', ');

/**
 * Build a kit into `document`, in place, and report what happened item by
 * item: `add` (created), `have` (already there, left alone) or `skip` (the
 * project cannot do it yet, with the reason). `STARTER_KIT` by default, and
 * `FULL_KIT` for the template, which ships everything.
 *
 * Order matters: expressions and motions first, so the reactions that
 * reference them resolve against what this same pass has just created.
 */
export function buildStarterKit(document, kit = STARTER_KIT) {
  const entries = [];

  for (const id of kit.expressions) {
    const preset = expressionPresetById(id);
    if (!preset) continue;
    if (findExpression(document, id)) { entries.push(entry('expression', id, preset.name, 'have')); continue; }
    const resolved = instantiatePreset(document, preset);
    if (!resolved.usable) { entries.push(entry('expression', id, preset.name, 'skip', `needs ${labels(resolved.missing)}`)); continue; }
    createExpression(document, { name: preset.name, id: preset.id, controls: resolved.controls, source: 'preset' });
    entries.push(entry('expression', id, preset.name, 'add'));
  }

  // Speech before the motions, and after the faces: a viseme is an expression
  // record like any other (docs/VISEME_SYSTEM.md), so it goes in with them and
  // the *Talk* clip that plays over them finds them already there.
  //
  // A viseme is installed under the naming rule and nothing else --
  // `viseme-ae`, carrying `viseme: 'AE'` -- which is how `mascot.setViseme`
  // finds it on a rig it has never seen. A mouth missing `mouthRound` still
  // gets the eight, a little less roundly, and the report says which movement
  // would make them exact.
  for (const key of kit.visemes || []) {
    const name = visemeExpressionName(key);
    const had = installedVisemes(document).includes(key);
    const report = installVisemes(document, { keys: [key] });
    if (had) { entries.push(entry('viseme', key, name, 'have')); continue; }
    if (report.added.includes(key)) { entries.push(entry('viseme', key, name, 'add')); continue; }
    const missing = report.skipped.find((item) => item.key === key)?.missing || [];
    entries.push(entry('viseme', key, name, 'skip', `needs ${missing.length ? missing.join(', ') : 'a mouth'}`));
  }

  for (const id of kit.motions) {
    const preset = motionPresetById(id);
    if (!preset) continue;
    if ((document.animationClips || []).some((clip) => clip.motion?.preset === id)) { entries.push(entry('motion', id, preset.name, 'have')); continue; }
    try { createMotionClip(document, id); entries.push(entry('motion', id, preset.name, 'add')); }
    catch (error) { entries.push(entry('motion', id, preset.name, 'skip', error.message)); }
  }

  for (const id of kit.reactions) {
    let resolved;
    try { resolved = instantiateReactionPreset(document, id); } catch { continue; }
    if (findReaction(document, id)) { entries.push(entry('reaction', id, resolved.name, 'have')); continue; }
    if (!resolved.usable) { entries.push(entry('reaction', id, resolved.name, 'skip', `needs ${resolved.missing.map((item) => item.label).join(' or ')}`)); continue; }
    createReaction(document, {
      name: resolved.name, id: resolved.id, trigger: resolved.trigger, timing: resolved.timing, after: resolved.after,
      expressionId: resolved.expressionId, clipId: resolved.clipId, gestures: resolved.gestures
    });
    entries.push(entry('reaction', id, resolved.name, 'add'));
  }

  const status = new Map(deriveAutomaticStatus(document).presets.map((item) => [item.id, item.status]));
  for (const id of kit.automatic) {
    const preset = requireAutomaticPreset(id);
    const blockers = automaticPresetBlockers(document, id);
    if (blockers.length) { entries.push(entry('automatic', id, preset.title, 'skip', `needs ${blockers.map((spec) => spec.parameter).join(', ')}`)); continue; }
    if (status.get(id) === 'on') { entries.push(entry('automatic', id, preset.title, 'have')); continue; }
    enableAutomaticPreset(document, id);
    entries.push(entry('automatic', id, preset.title, 'add'));
  }

  const count = (action) => entries.filter((item) => item.action === action).length;
  return { entries, added: count('add'), present: count('have'), skipped: count('skip') };
}

const KIND_WORDS = { expression: ['face', 'faces'], viseme: ['speech shape', 'speech shapes'], motion: ['motion', 'motions'], reaction: ['reaction', 'reactions'], automatic: ['automatic behaviour', 'automatic behaviours'] };

/** "8 faces, 8 speech shapes, 6 motions, 4 reactions and 3 automatic behaviours". */
export function starterKitSummary(report, action = 'add') {
  const parts = Object.keys(KIND_WORDS)
    .map((kind) => ({ kind, count: report.entries.filter((item) => item.kind === kind && item.action === action).length }))
    .filter((item) => item.count)
    .map((item) => `${item.count} ${KIND_WORDS[item.kind][item.count === 1 ? 0 : 1]}`);
  if (!parts.length) return 'nothing';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The kit as one atomic command: it spans four domains, so adding it — and
 * undoing it — is a single step for the author.
 */
export function createStarterKitCommands(store, history) {
  // The three studios each ask for the plan on every render: cache it until
  // the document actually changes.
  let cached = null, cachedAt = -1;
  const plan = () => {
    const revision = store.getPersistentRevision();
    if (!cached || cachedAt !== revision) { cached = buildStarterKit(starterKitDraft(store.getDocument())); cachedAt = revision; }
    return cached;
  };
  return {
    plan,
    add() {
      const preflight = plan();
      if (!preflight.added) return preflight;
      history?.snapshot();
      let result;
      store.execute({ type: 'starter/add', source: 'starter-kit', domains: ['expressions', 'animation', 'reactions', 'stateMachine'], apply: (document) => { result = buildStarterKit(document); } });
      return result;
    }
  };
}
