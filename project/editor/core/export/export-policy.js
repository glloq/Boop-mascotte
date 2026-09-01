import { hasValidProjectDocument } from '../state/project-snapshot.js';

export const EXPORT_ARTIFACTS = Object.freeze([
  { name: 'mascot.svg', description: 'sanitized artwork' },
  { name: 'rig.json', description: 'runtime rig configuration' },
  { name: 'runtime.js', description: 'standalone browser runtime' }
]);

/** Build presentation state without serializing artwork or creating an export. */
export function createExportUiModel(state) {
  const available = hasValidProjectDocument(state);
  return {
    available,
    message: available ? 'Use these files outside the editor:' : 'Add or import SVG artwork before exporting.',
    artifacts: EXPORT_ARTIFACTS.map((artifact) => ({ ...artifact, enabled: available }))
  };
}

/** Create export data only after the caller explicitly requests an artifact. */
export function createExportArtifacts({ state, serializeSvg, createRig, runtimeSource }) {
  const svg = serializeSvg();
  if (!hasValidProjectDocument({ svgMarkup: svg })) {
    throw new Error('Cannot export a project without a valid SVG document');
  }
  return [
    { name: 'mascot.svg', type: 'image/svg+xml', content: svg },
    { name: 'rig.json', type: 'application/json', content: JSON.stringify(createRig(state), null, 2) },
    { name: 'runtime.js', type: 'text/javascript', content: runtimeSource }
  ];
}
