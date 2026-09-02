import { createMotionClip, detachMotion, duplicateMotionClip, removeMotionClip, renameClip, resetMotion, setClipLoop, updateMotionSettings } from './motion-model.js';

/** Atomic V2 commands for simple motions on the `animation` domain. Preflight keeps failures out of history. */
export function createMotionCommands(store, history) {
  const run = (type, operation) => {
    operation(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'motion', domains: ['animation'], apply: (document) => { result = operation(document); } });
    return result;
  };
  return {
    createFromPreset(presetId, options) { return run('motion/create', (d) => createMotionClip(d, presetId, options).id); },
    updateSettings(id, patch) { return run('motion/update-settings', (d) => structuredClone(updateMotionSettings(d, id, patch).tracks)); },
    reset(id) { return run('motion/reset', (d) => structuredClone(resetMotion(d, id).tracks)); },
    detach(id) { return run('motion/detach', (d) => detachMotion(d, id).id); },
    setLoop(id, loop) { return run('motion/set-loop', (d) => setClipLoop(d, id, loop).loop); },
    rename(id, name) { return run('motion/rename', (d) => renameClip(d, id, name).name); },
    duplicate(id) { return run('motion/duplicate', (d) => duplicateMotionClip(d, id).id); },
    remove(id) { return run('motion/remove', (d) => removeMotionClip(d, id).id); }
  };
}
