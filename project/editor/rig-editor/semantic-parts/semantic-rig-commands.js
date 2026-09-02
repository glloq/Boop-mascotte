import { assignSemanticRole, calibrateSemanticPart, captureSemanticMorph, createSemanticPart, enableSemanticControl, removeSemanticPart, resetSemanticMorph, setSemanticControlMethod } from './part-model.js';

/** Atomic V2 commands. Preflight keeps failed operations out of history. */
export function createSemanticRigCommands(store, history) {
  const run = (type, domains, operation) => { operation(structuredClone(store.getDocument())); history?.snapshot(); return store.execute({ type, source: 'semantic-rig', domains, apply: operation }); };
  return {
    createPart(type, options) { let id; run('semantic/create-part', ['semanticRig'], d => { id = createSemanticPart(d, type, options).id; }); return id; },
    assignRole(partId, role, elementId) { return run('semantic/assign-role', ['semanticRig', 'artwork'], d => assignSemanticRole(d, partId, role, elementId)); },
    enableControl(partId, control, options) { return run('semantic/enable-control', ['semanticRig', 'rig', 'stateMachine', 'artwork'], d => enableSemanticControl(d, partId, control, options)); },
    setMethod(partId, control, method) { return run('semantic/set-control-method', ['semanticRig', 'artwork'], d => setSemanticControlMethod(d, partId, control, method)); },
    captureCalibration(partId, control, sample) { return run('semantic/capture-calibration', ['semanticRig'], d => { const record=d.semanticParts[partId].calibration[control]||{samples:[]};record.samples=record.samples.filter(x=>x.key!==sample.key);record.samples.push(structuredClone(sample));record.samples.sort((a,b)=>a.value-b.value);d.semanticParts[partId].calibration[control]=record; }); },
    calculateCalibration(partId, control) { return run('semantic/calculate-calibration', ['semanticRig', 'artwork'], d => calibrateSemanticPart(d, partId, control)); },
    captureMorph(partId, control, pose, paths) { return run('semantic/capture-morph', ['semanticRig', 'artwork'], d => captureSemanticMorph(d, partId, control, pose, paths)); },
    resetMorph(partId, control) { return run('semantic/reset-morph', ['semanticRig', 'artwork'], d => resetSemanticMorph(d, partId, control)); },
    removePart(partId) { return run('semantic/remove-part', ['semanticRig', 'artwork', 'rig', 'stateMachine'], d => removeSemanticPart(d, partId)); }
  };
}
