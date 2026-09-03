/**
 * Parameter mixer (docs/PARAMETER_MIXER.md).
 *
 * ```text
 * Base State + Motion + Reaction + Expression + Behavior + Live Override
 *                              ↓
 *                      Parameter Mixer
 *                              ↓
 *                     Final Parameters
 * ```
 *
 * Composition used to be a chain of `{ ...a, ...b }` spreads whose order was
 * implicit. This makes the order explicit, gives every layer a declared
 * combination mode, and puts the whole thing under test.
 */
import { finite, clamp } from './numeric.js';

/** The order layers are applied in. Later layers see earlier ones' results. */
export const MIXER_ORDER = Object.freeze(['base', 'motion', 'reaction', 'expression', 'behavior', 'override']);

/**
 * | Mode | Rule | Typical use |
 * | --- | --- | --- |
 * | `additive` | `current + (value − neutral) × weight` | translation, corrective rotation |
 * | `multiplicative` | `current × (1 + (value − 1) × weight)` | scale, opacity factors |
 * | `override` | `value` (blended by weight when < 1) | live control, a playing clip |
 * | `weightedOverride` | `current + (value − current) × weight` | a partially applied pose |
 */
export const MIX_MODES = Object.freeze(['additive', 'multiplicative', 'override', 'weightedOverride']);

export function parameterNeutral(params, name) {
  const param = params?.[name];
  if (param && typeof param === 'object') return finite(param.default, 0);
  return finite(param, 0);
}

/**
 * @param {Record<string, number>} base starting vector
 * @param {{source?:string, mode?:string, weight?:number, values:Record<string,number>}[]} layers
 * @param {object} params parameter descriptors, for neutrals and bounds
 * @param {{clampToBounds?: boolean}} options
 */
export function mixParameters(base = {}, layers = [], params = {}, { clampToBounds = false } = {}) {
  const result = { ...base };
  const touched = new Set();
  for (const layer of layers) {
    if (!layer?.values) continue;
    const weight = layer.weight === undefined ? 1 : finite(layer.weight, 1);
    if (weight === 0) continue;
    const mode = MIX_MODES.includes(layer.mode) ? layer.mode : 'override';
    for (const [name, raw] of Object.entries(layer.values)) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const neutral = parameterNeutral(params, name);
      const current = finite(result[name], neutral);
      if (mode === 'additive') result[name] = current + (value - neutral) * weight;
      else if (mode === 'multiplicative') result[name] = current * (1 + (value - 1) * weight);
      else if (mode === 'weightedOverride' || weight !== 1) result[name] = current + (value - current) * weight;
      else result[name] = value;
      touched.add(name);
    }
  }
  if (clampToBounds) for (const name of touched) {
    const param = params?.[name];
    if (param && typeof param === 'object' && Number.isFinite(Number(param.min)) && Number.isFinite(Number(param.max))) {
      result[name] = clamp(result[name], Number(param.min), Number(param.max));
    }
  }
  return result;
}

/** Sort layers into the canonical order, so a caller cannot get it wrong. */
export function orderLayers(layers = []) {
  const rank = (layer) => {
    const index = MIXER_ORDER.indexOf(layer?.source);
    return index < 0 ? MIXER_ORDER.length : index;
  };
  return [...layers].sort((a, b) => rank(a) - rank(b));
}
