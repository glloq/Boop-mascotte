import { normalizeBehavior } from '../../../runtime/runtime.js';
import { automaticPresetById, matchBehavior } from './automatic-presets.js';

/**
 * Atomic commands that turn an automatic preset on (adding the missing
 * behaviors with the preset values, re-enabling kept ones) or off (disabling
 * the matching behaviors so hand tweaks survive). Behaviors live in the
 * `stateMachine` domain like the advanced Behaviors panel writes them.
 */
export function createAutomaticCommands(store, history) {
  const run = (type, operation) => {
    operation(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'automatic', domains: ['stateMachine'], apply: (document) => { result = operation(document); } });
    return result;
  };
  const requirePreset = (id) => { const preset = automaticPresetById(id); if (!preset) throw new Error(`Unknown automatic preset "${id}".`); return preset; };
  return {
    enable(id) {
      return run('automatic/enable', (document) => {
        const preset = requirePreset(id), params = document.params || {};
        const missing = preset.behaviors.filter((spec) => !spec.optional && !params[spec.parameter]);
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
      });
    },
    disable(id) {
      return run('automatic/disable', (document) => {
        const preset = requirePreset(id);
        const matched = preset.behaviors.map((spec) => matchBehavior(document, spec)).filter(Boolean);
        if (!matched.length) throw new Error(`${preset.title} is not on.`);
        for (const behavior of matched) behavior.enabled = false;
        return matched.map((item) => item.id);
      });
    }
  };
}
