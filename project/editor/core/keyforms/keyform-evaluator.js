/**
 * Keyform evaluation. There is exactly one implementation and it lives in the
 * runtime, so the editor preview and an exported mascot cannot drift apart.
 */
export {
  compileKeyform, compileKeyforms, evaluateKeyform, evaluateCompiledKeyform,
  normalizeKeyform, normalizeKeyforms, keyformChannelNeutral,
  KEYFORM_CHANNELS, KEYFORM_CHANNEL_NEUTRAL, KEYFORM_EXTRAPOLATIONS
} from '../../../runtime/keyforms.js';
