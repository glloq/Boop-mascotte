// Kept as a stable module entry point; the implementation lives in the shared,
// single-file browser runtime used by both exports and the editor preview.
export { createMascotEngine, compileRigFrame } from './runtime.js';
