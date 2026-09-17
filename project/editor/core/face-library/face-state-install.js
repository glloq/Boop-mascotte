/**
 * Giving a mouth the speech shapes (docs/VISEME_SYSTEM.md).
 *
 * A viseme is an expression record, so installing one is `createExpression`
 * and nothing else. What this module owns is the *naming*: the id comes from
 * `runtime/visemes.js`, the values from the catalogue, and the record carries
 * `viseme: 'AE'` so `mascot.setViseme('AE')` finds it on a rig the runtime has
 * never seen.
 *
 * One implementation, two callers: the starter kit ships the eight with the
 * template, and the Face states panel offers them to a project that predates
 * them. A project that already has one keeps it exactly as authored — an
 * author who tuned `OO` does not lose it to a second press.
 */
import { createExpression, findExpression, setExpressionControls } from '../expressions/expression-model.js';
import { REQUIRED_VISEME_KEYS, VISEME_PRESETS, resolveViseme, visemeExpressionId, visemeKey } from './face-states.js';

/** What a viseme's expression record is called in the lists. */
export const visemeExpressionName = (key) => {
  const preset = VISEME_PRESETS.find((item) => item.id === visemeKey(key));
  return preset ? `Say ${preset.name}` : `Say ${key}`;
};

/**
 * Install the visemes a project has not got.
 *
 * @param {object} document mutated in place
 * @param {object} [options]
 * @param {string[]} [options.keys] which visemes; the eight a mouth needs by default
 * @param {boolean} [options.retune] rewrite the values of ones already there
 * @returns {{ok: boolean, added: string[], present: string[], skipped: {key, missing}[], message?: string}}
 */
export function installVisemes(document, { keys = REQUIRED_VISEME_KEYS, retune = false } = {}) {
  const added = [];
  const present = [];
  const skipped = [];
  for (const raw of keys) {
    const key = visemeKey(raw);
    if (!key) continue;
    const id = visemeExpressionId(key);
    const resolved = resolveViseme(document, key);
    if (!resolved.usable) { skipped.push({ key, missing: resolved.missing }); continue; }
    const existing = findExpression(document, id);
    if (existing) {
      // Retuning is the author asking for the catalogue's numbers back, and it
      // is never the default: a viseme somebody adjusted is their work.
      if (retune) setExpressionControls(document, id, resolved.controls);
      existing.viseme = key;
      present.push(key);
      continue;
    }
    const created = createExpression(document, { name: visemeExpressionName(key), id, controls: resolved.controls, source: 'viseme' });
    created.viseme = key;
    added.push(key);
  }
  if (!added.length && !present.length) {
    return { ok: false, added, present, skipped, message: `The mouth has no movement these can use${skipped.length ? ` — ${[...new Set(skipped.flatMap((item) => item.missing))].join(', ')} would need turning on` : ''}.` };
  }
  return { ok: true, added, present, skipped };
}

/** Which visemes a project already carries, in catalogue order. */
export const installedVisemes = (document = {}) =>
  VISEME_PRESETS.filter((preset) => findExpression(document, visemeExpressionId(preset.id))).map((preset) => preset.id);
