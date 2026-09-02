import { assignSemanticRole, calibrateSemanticPart, captureSemanticMorph, createSemanticPart, disableSemanticControl, enableSemanticControl, removeSemanticPart, resetSemanticCalibration, resetSemanticMorph, setSemanticControlMethod } from './part-model.js';

const recordSample = (d, partId, control, sample) => { const record = d.semanticParts[partId].calibration[control] || { samples: [] }; record.samples = (record.samples || []).filter(x => x.key !== sample.key); record.samples.push(structuredClone(sample)); record.samples.sort((a, b) => a.value - b.value); d.semanticParts[partId].calibration[control] = record; return record; };

/** Atomic V2 commands. Preflight keeps failed operations out of history. */
export function createSemanticRigCommands(store, history) {
  const run = (type, domains, operation) => { operation(structuredClone(store.getDocument())); history?.snapshot(); return store.execute({ type, source: 'semantic-rig', domains, apply: operation }); };
  return {
    createPart(type, options) { let id; run('semantic/create-part', ['semanticRig'], d => { id = createSemanticPart(d, type, options).id; }); return id; },
    assignRole(partId, role, elementId) { return run('semantic/assign-role', ['semanticRig', 'artwork'], d => assignSemanticRole(d, partId, role, elementId)); },
    /** Face Setup checklist: create the owning basic part when absent, then assign, as one undoable command. */
    assignFaceRole(type, role, elementId) { let partId; run('semantic/assign-face-role', ['semanticRig', 'artwork'], d => { const part = Object.values(d.semanticParts || {}).find(candidate => candidate.type === type) || createSemanticPart(d, type); partId = part.id; assignSemanticRole(d, partId, role, elementId); }); return partId; },
    /** Accepted detection suggestions: every entry applies or none does, as one undo step. */
    assignFaceRoles(entries) { const ids = []; run('semantic/assign-face-roles', ['semanticRig', 'artwork'], d => { ids.length = 0; for (const { type, role, elementId } of entries) { const part = Object.values(d.semanticParts || {}).find(candidate => candidate.type === type) || createSemanticPart(d, type); assignSemanticRole(d, part.id, role, elementId); ids.push(part.id); } }); return ids; },
    enableControl(partId, control, options) { return run('semantic/enable-control', ['semanticRig', 'rig', 'stateMachine', 'artwork'], d => enableSemanticControl(d, partId, control, options)); },
    setMethod(partId, control, method) { return run('semantic/set-control-method', ['semanticRig', 'artwork'], d => setSemanticControlMethod(d, partId, control, method)); },
    captureCalibration(partId, control, sample) { return run('semantic/capture-calibration', ['semanticRig'], d => { recordSample(d, partId, control, sample); }); },
    /** Visual calibration: record one pose and, as soon as two poses exist, solve the movement in the same undo step. */
    captureAndCalibrate(partId, control, sample) { let solved = false; run('semantic/capture-and-calibrate', ['semanticRig', 'artwork'], d => { solved = recordSample(d, partId, control, sample).samples.length >= 2; if (solved) calibrateSemanticPart(d, partId, control); }); return solved; },
    resetCalibration(partId, control) { return run('semantic/reset-calibration', ['semanticRig', 'artwork'], d => resetSemanticCalibration(d, partId, control)); },
    enableControls(entries) { run('semantic/enable-controls', ['semanticRig', 'rig', 'stateMachine', 'artwork'], d => { for (const { partId, control } of entries) enableSemanticControl(d, partId, control); }); return entries.length; },
    disableControl(partId, control) { return run('semantic/disable-control', ['semanticRig', 'rig', 'stateMachine', 'artwork'], d => disableSemanticControl(d, partId, control)); },
    calculateCalibration(partId, control) { return run('semantic/calculate-calibration', ['semanticRig', 'artwork'], d => calibrateSemanticPart(d, partId, control)); },
    captureMorph(partId, control, pose, paths) { return run('semantic/capture-morph', ['semanticRig', 'artwork'], d => captureSemanticMorph(d, partId, control, pose, paths)); },
    resetMorph(partId, control) { return run('semantic/reset-morph', ['semanticRig', 'artwork'], d => resetSemanticMorph(d, partId, control)); },
    removePart(partId) { return run('semantic/remove-part', ['semanticRig', 'artwork', 'rig', 'stateMachine'], d => removeSemanticPart(d, partId)); }
  };
}
