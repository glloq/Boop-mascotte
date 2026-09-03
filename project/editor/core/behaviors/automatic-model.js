// Pure operations behind the Automatic presets, so the Automatic panel and the
// Starter kit turn "life" on through exactly the same code (one rule, one
// place). Commands wrap these; nothing here touches history or the store.
import { normalizeBehavior } from '../../../runtime/runtime.js';
import { automaticPresetById, matchBehavior } from './automatic-presets.js';

export const requireAutomaticPreset = (id) => {
  const preset = automaticPresetById(id);
  if (!preset) throw new Error(`Unknown automatic preset "${id}".`);
  return preset;
};

/** Movements a preset needs that the project does not have (empty when it can run). */
export function automaticPresetBlockers(document, id) {
  const preset = requireAutomaticPreset(id), params = document?.params || {};
  return preset.behaviors.filter((spec) => !spec.optional && !params[spec.parameter]);
}

/**
 * Add the preset's behaviors with their preset values, re-enabling the ones
 * that are already there so hand tweaks survive. Optional behaviors are added
 * only when the movement they need exists.
 *
 * @returns {string[]} the behavior ids the preset now owns.
 */
export function enableAutomaticPreset(document, id) {
  const preset = requireAutomaticPreset(id), params = document.params || {};
  const missing = automaticPresetBlockers(document, id);
  if (missing.length) throw new Error(`${preset.title} needs a movement that is off: ${missing.map((spec) => spec.parameter).join(', ')}. Turn it on in Face Setup first.`);
  document.behaviors ||= [];
  const ids = [];
  for (const spec of preset.behaviors) {
    if (!params[spec.parameter]) continue;
    const existing = matchBehavior(document, spec);
    if (existing) { existing.enabled = true; ids.push(existing.id); continue; }
    const { optional, ...fields } = spec;
    const behavior = normalizeBehavior({ ...fields, id: document.behaviors.some((item) => item.id === spec.id) ? `${spec.id}-${document.behaviors.length + 1}` : spec.id, enabled: true });
    document.behaviors.push(behavior);
    ids.push(behavior.id);
  }
  return ids;
}

/** Turn the preset off by disabling its behaviors; they are kept so tweaks survive. */
export function disableAutomaticPreset(document, id) {
  const preset = requireAutomaticPreset(id);
  const matched = preset.behaviors.map((spec) => matchBehavior(document, spec)).filter(Boolean);
  if (!matched.length) throw new Error(`${preset.title} is not on.`);
  for (const behavior of matched) behavior.enabled = false;
  return matched.map((item) => item.id);
}
