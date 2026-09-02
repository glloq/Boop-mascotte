import { test, expect } from '@playwright/test';
import {
  createBasicMascot,
  editorSession,
  exportStandaloneMascot,
  assignImportedArtworkAsHead,
  importArtwork,
  inspectExportReadiness,
  monitorUnexpectedErrors,
  openBoop,
  openEditableProject,
  ownershipCheckpoint,
  projectDocument,
  recoverMissingArtworkWithBasicMascot,
  renameAuthoredHead,
  saveEditableProject,
  startNewProject,
  testHorizontalGaze,
  testMascot
} from './product-journey-helpers.js';

test.beforeEach(async ({ page }) => openBoop(page));

test('@critical user can create a Basic mascot, test gaze and export it', async ({ page }) => {
  const errors = monitorUnexpectedErrors(page);
  await createBasicMascot(page);
  const before = await ownershipCheckpoint(page);

  const right = await testHorizontalGaze(page, .8);
  expect(Math.abs(right.x)).toBeGreaterThan(0);
  const left = await testHorizontalGaze(page, -.8);
  expect(Math.sign(left.x)).toBe(-Math.sign(right.x));
  const afterLiveTest = await ownershipCheckpoint(page);
  expect(afterLiveTest.document).toEqual(before.document);
  expect(afterLiveTest.versionToken).toBe(before.versionToken);
  expect(afterLiveTest.revisions).toEqual(before.revisions);
  expect(afterLiveTest.history).toEqual(before.history);
  expect(afterLiveTest.dirty).toBe(before.dirty);
  expect(afterLiveTest.session).not.toEqual(before.session);

  await testMascot(page);
  const afterPreview = await ownershipCheckpoint(page);
  expect(afterPreview.document).toEqual(before.document);
  expect(afterPreview.revisions).toEqual(before.revisions);
  expect(afterPreview.history).toEqual(before.history);
  expect(afterPreview.dirty).toBe(before.dirty);
  expect(afterPreview.session.workspace).toBe('preview');

  const readiness = await inspectExportReadiness(page);
  expect(readiness.readiness.export.status).toBe('ready');
  expect(readiness.issues.filter(issue => issue.severity === 'error')).toEqual([]);
  await exportStandaloneMascot(page);
  expect(errors).toEqual([]);
});

test('@critical user can import artwork, assign a semantic face part and test it', async ({ page }) => {
  const errors = monitorUnexpectedErrors(page);
  await importArtwork(page);
  const imported = await ownershipCheckpoint(page);
  await assignImportedArtworkAsHead(page);
  const assignedDocument = await projectDocument(page);
  const assignedSession = await editorSession(page);
  expect(assignedDocument).not.toEqual(imported.document);
  expect(assignedDocument.semanticParts.head.roles).toEqual({ head: 'journeyHead' });
  expect(assignedSession.selectedId).toBe('journeyHead');
  expect(assignedSession.activeSemanticPartId).toBe('head');
  expect((await ownershipCheckpoint(page)).history.canUndo).toBe(true);

  const beforePreview = await projectDocument(page);
  await testMascot(page);
  expect(await projectDocument(page)).toEqual(beforePreview);
  expect(errors).toEqual([]);
});

test('@critical user can understand an export blocker and recover', async ({ page }) => {
  const errors = monitorUnexpectedErrors(page);
  const blocked = await inspectExportReadiness(page);
  expect(blocked.readiness.export.status).toBe('error');
  expect(blocked.issues.map(issue => issue.id)).toContain('artwork.missing');
  expect(blocked.issues.find(issue => issue.id === 'artwork.missing')?.fix).toMatchObject({ workspace: 'create' });

  await recoverMissingArtworkWithBasicMascot(page);
  const recovered = await inspectExportReadiness(page);
  expect(recovered.readiness.export.status).toBe('ready');
  expect(recovered.issues.some(issue => issue.severity === 'error')).toBe(false);
  await exportStandaloneMascot(page);
  expect(errors).toEqual([]);
});

test('@critical editable project survives a save, reset and open round trip', async ({ page }) => {
  const errors = monitorUnexpectedErrors(page);
  await createBasicMascot(page);
  await renameAuthoredHead(page, 'Round-trip Head');
  const authored = await projectDocument(page);
  const saved = await saveEditableProject(page);
  expect(saved.snapshot.version).toBe(3);
  expect(saved.snapshot.document.svgMarkup).toContain('<svg');
  expect(saved.snapshot.document.editor.semanticParts).toBeDefined();
  expect(saved.snapshot.document.rig.elements).toEqual(authored.elements);
  expect(saved.snapshot.document.rig.stateConstraints).toEqual(authored.stateConstraints);

  await startNewProject(page);
  expect((await projectDocument(page)).svgMarkup).toBe('');
  await openEditableProject(page, saved.path);
  const restored = await projectDocument(page);
  expect(restored).toEqual(authored);
  expect(restored.svgMarkup).toContain('<svg');
  expect(restored.semanticParts.gaze.roles).toMatchObject({ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' });
  expect(restored.params.lookX).toBeDefined();
  expect(restored.layerMetadata.head.name).toBe('Round-trip Head');

  const movement = await testHorizontalGaze(page, .6);
  expect(Math.abs(movement.x)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
