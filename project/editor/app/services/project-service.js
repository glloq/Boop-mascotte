/**
 * Everything that opens, replaces or writes out a project (VNX-02,
 * docs/VNEXT_ROADMAP.md): SVG import, templates, presets, the generated face,
 * snapshot files and the restore behind local recovery.
 *
 * These six paths do the same five things in the same order — ask before
 * destroying unsaved work, stop playback, swap the document, clear undo,
 * establish a new saved baseline — and they used to be six closures over
 * `main.js` module variables. That made the two parts that matter most
 * untestable: whether a refused replacement really touches nothing, and
 * whether a load that fails halfway really puts the previous document back.
 *
 * Every collaborator is injected — store, canvas, preview, timeline, history,
 * autosave, narrow shell callbacks and the download itself — so a load, a
 * refusal and a failed commit all run in Node. Nothing here reaches for
 * `window`, `document`, `Blob` or `URL`.
 *
 * The service decides *what happens to the project*, never what the shell
 * looks like: it reports through the callbacks it was given, and `main.js`
 * keeps the bindings.
 */
import { createCleanProjectState } from '../../core/state/store.js';
import { createProjectDocument } from '../../core/state/project-document.js';
import { createEditorSession } from '../../core/state/editor-session.js';
import { applyProjectSnapshot, createProjectSnapshot, hasValidProjectDocument, prepareProjectSnapshot } from '../../core/state/project-snapshot.js';
import { commitProjectReplacement } from '../../core/state/project-replacement.js';
import { PROJECT_TEMPLATES } from '../../core/sample/templates/index.js';
import { loadProjectTemplate } from '../../core/sample/template-loader.js';
import { buildFaceProjectTemplate } from '../../core/assets/face-builder.js';
import { validateRig } from '../../core/validation/rig-validator.js';
import { applyImportedRig } from '../../core/state/import-rig.js';
import { identifyFaceParts } from '../../core/face-library/face-part-migration.js';
import { imageNodeId, imageNodeMarkup, placeBaseInArtboard, placeImageInArtboard } from '../../core/assets/asset-placement.js';
import { readBoopPackage, writeBoopPackage } from '../../core/export/boop-package.js';
import { restMesh } from '../../../runtime/mesh-warp.js';
import { createExportRig } from '../../core/export/export-rig.js';
import { readArtboard } from '../../core/artwork/artboard.js';
import { createArtworkCommands } from '../../core/commands/artwork-commands.js';

/**
 * Why a picture was refused, in words rather than in codes.
 *
 * The validator speaks in codes so that tests and callers can branch on them
 * (core/assets/asset-validate.js); an author needs a sentence, and one that
 * says what to do next where there is anything to do.
 */
const REFUSALS = Object.freeze({
  empty: 'the file is empty',
  'unknown-format': 'this is not a picture this editor can read — PNG, WebP or SVG',
  'convert-first': 'JPEG and GIF have to be saved as PNG or WebP first',
  'no-dimensions': 'the file looks damaged — its size could not be read',
  'too-large': 'it is far larger than a mascot needs',
  'too-many-pixels': 'it is far larger than a mascot needs',
  'too-many-bytes': 'the file is too big to import',
  'unsafe-svg': 'this SVG carries something executable, which cannot be imported'
});
const importRefusal = (issues = []) => REFUSALS[issues[0]?.code] || 'it could not be imported';

/** Every domain `applyImportedRig` can write, so every panel that shows one redraws. */
const RIG_IMPORT_DOMAINS = Object.freeze(['artwork', 'rig', 'stateMachine', 'keyforms', 'constraints', 'hands', 'hierarchy']);

/**
 * The only browser step in the file, and the reason it is one injected
 * function rather than four: a save needs `Blob`, `URL`, an `<a>` and a timer,
 * and a fake that records `(name, text)` is a better test seam than four DOM
 * shims. The globals are read when a download happens, never at import time.
 */
export const browserDownload = (name, data, type = 'application/json') => {
  const blob = new globalThis.Blob([data], { type });
  const link = globalThis.document.createElement('a');
  link.href = globalThis.URL.createObjectURL(blob);
  link.download = name;
  link.click();
  // Revoked on the next tick, not straight away: the click has to have read it.
  globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(link.href), 0);
};

export function createProjectService({
  store, history, canvas, preview, timeline, autosave,
  // How a picture becomes an asset. Absent in a service wired without one, and
  // `addImageFile` then says so rather than throwing.
  assets = null,
  // The shell, as the four things this service actually asks of it.
  setStatus = () => {}, setProjectLoaded = () => {}, closeHome = () => {},
  navigate = () => {},
  // `false` is the answer `commitProjectReplacement` reads as "cancel", so a
  // service wired without a dialog refuses to destroy work rather than
  // destroying it silently.
  confirmReplacement = () => false,
  resetContext = () => {},
  // Leaving preview is partly the editor's own state and partly a class on the
  // app root; neither belongs here, both must happen before the swap.
  exitPreviewMode = () => {},
  createDownload = browserDownload,
  // Destructured under another name on purpose, as in autosave-service.js:
  // `requestAnimationFrame = requestAnimationFrame` would be a temporal-dead-zone
  // self reference, and the DOM timer needs the global as its receiver.
  requestAnimationFrame: afterPaint = (callback) => globalThis.requestAnimationFrame(callback)
} = {}) {
  // Its own instance, as the canvas has: a command is a document mutation plus
  // a history step, and both are stateless.
  const commands = createArtworkCommands(store, history);
  /**
   * The one destructive path. `commit` prepares nothing and validates nothing:
   * whatever can fail must have failed before this is called, so a bad file
   * costs the author a status line rather than the project on screen.
   *
   * `keepRecovery` is for the restore path, where the local record being
   * restored from has to survive the baseline that restore establishes.
   */
  const replaceProject = (commit, { keepRecovery = false } = {}) => commitProjectReplacement({
    hasUnsavedChanges: () => autosave.isDirty(),
    confirmReplacement: () => confirmReplacement(),
    saveProject: () => saveProject(),
    stop: () => { timeline.reset(); preview.stop(); preview.reset(); exitPreviewMode(); },
    resetContext: () => resetContext(),
    captureRollback: () => ({ document: structuredClone(store.getDocument()), session: structuredClone(store.getSession()), markup: hasValidProjectDocument(store.getDocument()) ? canvas.serializeCurrentSvg() : '' }),
    commit,
    rollback: async (previous) => { if (previous.markup) await canvas.loadSvgFromText(previous.markup, previous.document.layerMetadata, { recordHistory: false, updateStore: false }); store.replaceProject(previous.document, previous.session, { source: 'rollback' }); preview.apply(); },
    clearHistory: () => history.clear(), establishBaseline: () => autosave.markSaved({ keepRecovery })
  });

  const downloadJson = (name, data) => createDownload(name, JSON.stringify(data, null, 2));

  /**
   * Save the project, in whichever form does not lose part of it.
   *
   * A project of paths is a JSON file and always was. A project with pictures
   * in it is a package, because a JSON snapshot references assets by id and
   * carries none of them: handing an author a file that silently drops their
   * drawings is worse than handing them a file type they did not choose.
   */
  const saveProject = () => {
    // Serialized from the canvas rather than from `svgMarkup`: the store copy
    // lags behind whatever the author has just drawn.
    if (!hasValidProjectDocument(store.getState(), () => canvas.serializeCurrentSvg())) { setStatus('Create or open a project before saving.', 'warn'); return false; }
    if (Object.keys(store.getDocument().assets || {}).length) return saveBoopPackage();
    const snapshot = createProjectSnapshot(store.getState(), () => canvas.serializeCurrentSvg());
    downloadJson('mascot-project.json', snapshot);
    setStatus('Project snapshot exported.');
    autosave.markSaved();
    return true;
  };

  /** The tail shared by every path that puts a new project on the canvas. */
  const openProject = (mode = 'design.artwork') => {
    setProjectLoaded(true);
    navigate(mode);
    closeHome();
    // Fitting needs the artwork laid out, which has not happened yet.
    afterPaint(() => canvas.fitToCanvas());
  };

  /**
   * A snapshot back into the editor. `sourceLabel` is the only difference
   * between a project file and a local draft; `recovered` is the difference
   * between the two of them and a saved project.
   */
  const restoreSnapshot = async (snapshot, sourceLabel, { recovered = false } = {}) => {
    let identified = [];
    const committed = await replaceProject(async () => {
      await canvas.loadSvgFromText(snapshot.document.svgMarkup, snapshot.document.layerMetadata, { recordHistory: false, updateStore: false });
      const nextState = createCleanProjectState(); applyProjectSnapshot(nextState, snapshot);
      // A project from before the part library: the parts that are a library
      // asset drawn exactly are identified, so the builder knows them; the rest
      // are the author's own (docs/FACE_PART_LIBRARY.md, "Migration").
      identified = identifyFaceParts(nextState).identified;
      const nextDocument = createProjectDocument(nextState), nextSession = createEditorSession(nextState);
      store.replaceProject(nextDocument, nextSession, { source: 'project-snapshot' });
      preview.setClip(nextSession.animationEditor.activeClipId);
      preview.seek(nextSession.animationEditor.playhead);
      preview.apply();
    }, { keepRecovery: recovered });
    if (!committed) return false;
    // Every path that puts a project on the canvas fetches its pictures, not
    // just the one that opens a package. A draft recovered after a browser
    // restart is the case this was missing: the canvas paints as it loads,
    // synchronously, so without this the raster pieces come back blank and
    // stay blank until something unrelated redraws them.
    const short = (await canvas.refreshAssets?.())?.missing ?? [];
    navigate('design.artwork');
    setProjectLoaded(true);
    closeHome();
    setStatus(identified.length ? `${sourceLabel} restored. ${identified.length === 1 ? 'One part is' : `${identified.length} parts are`} the library's own drawing, and the Character Builder knows ${identified.length === 1 ? 'it' : 'them'}.` : `${sourceLabel} restored.`);
    // A recovered draft matches the record it came from, so the version token
    // would call it clean — yet the author has never saved it anywhere.
    if (recovered) { autosave.markDirty(); setStatus('Recovered local copy — unsaved changes.', 'warn'); }
    // Said, not drawn as a hole. A project whose pictures are gone is a
    // specific thing that happened -- site data cleared, a package opened
    // without them -- and the author can only act on it if they are told.
    if (short.length) setStatus(`${sourceLabel} restored, but ${short.length} picture${short.length === 1 ? '' : 's'} could not be found. ${short.length === 1 ? 'That piece is' : 'Those pieces are'} blank until it is added again.`, 'warn');
    return true;
  };

  /**
   * Add a picture to the artwork that is already open.
   *
   * Not `loadSvgFile`, which replaces the project: this puts one more piece on
   * the canvas, in the middle, at a size its author can see all of
   * (core/assets/asset-placement.js).
   *
   * The node and the asset record are written in one command, so one undo takes
   * both back. Splitting them would leave a step where the artwork points at a
   * record the project does not list.
   */
  const addImageFile = async (file) => {
    if (!assets) { setStatus('Pictures cannot be added in this editor build.', 'error'); return false; }
    let imported;
    try {
      imported = await assets.import(new Uint8Array(await file.arrayBuffer()), { name: file.name, type: file.type });
    } catch {
      setStatus(`Could not read ${file.name}.`, 'error');
      return false;
    }
    if (!imported.ok) { setStatus(`${file.name}: ${importRefusal(imported.issues)}`, 'error'); return false; }

    const before = store.getDocument();
    const box = placeImageInArtboard(imported.asset, readArtboard(before.svgMarkup));
    if (!box) { setStatus(`${file.name} has no size to place.`, 'error'); return false; }
    const id = imageNodeId(file.name, new Set(Object.keys(before.elements || {})));
    const artwork = canvas.appendArtwork(imageNodeMarkup({ id, assetId: imported.asset.id, box }), null, { updateStore: false });
    if (!artwork) { setStatus(`Could not place ${file.name}.`, 'error'); return false; }

    commands.syncSvg({ ...artwork, assets: { ...(before.assets || {}), [imported.asset.id]: imported.asset } },
      { domains: ['artwork', 'layers', 'assets'], source: 'add-image' });
    await canvas.refreshAssets();
    preview.apply();
    setStatus(imported.stored
      ? `Added ${file.name}. Drag it, or resize it from the Inspector.`
      : `Added ${file.name} — you already had this picture, so it is the same asset.`);
    return true;
  };

  /**
   * Put a different picture on a piece that is already rigged.
   *
   * What the raster model is for: the rig, the animations, the pivot, the
   * depth and the place in the paint order all belong to the node, and none of
   * them knows which picture it draws. So this changes one reference and
   * nothing else -- a redrawn mouth arrives already animated.
   *
   * **The picture that was there is kept.** Collecting it here would be
   * correct right up until the author pressed undo: undo restores the
   * document, and nothing restores bytes deleted from the store, so the piece
   * would come back pointing at an asset that no longer exists. A record is a
   * few dozen bytes; the bytes themselves go when collection is asked for
   * deliberately (`assets.collect`), where there is nothing to undo.
   */
  const replaceImageFile = async (id, file) => {
    if (!assets) { setStatus('Pictures cannot be replaced in this editor build.', 'error'); return false; }
    const before = store.getDocument();
    let imported;
    try {
      imported = await assets.import(new Uint8Array(await file.arrayBuffer()), { name: file.name, type: file.type });
    } catch {
      setStatus(`Could not read ${file.name}.`, 'error');
      return false;
    }
    if (!imported.ok) { setStatus(`${file.name}: ${importRefusal(imported.issues)}`, 'error'); return false; }

    const artwork = canvas.replaceImageAsset(id, assets.reference(imported.asset.id));
    if (!artwork) { setStatus(`${id} is not a picture, so there is nothing to replace.`, 'error'); return false; }

    commands.syncSvg({ ...artwork, assets: { ...(before.assets || {}), [imported.asset.id]: imported.asset } },
      { domains: ['artwork', 'assets'], source: 'replace-image' });
    await canvas.refreshAssets();
    preview.apply();
    setStatus(`${id} now draws ${file.name}. Its movements are unchanged.`);
    return true;
  };

  /**
   * Import a picture as the head or the body: the thing the rest of the mascot
   * sits on.
   *
   * The same import as `addImageFile`, placed as a base rather than as a
   * piece. Three differences, and each is a thing an author would otherwise do
   * by hand immediately: it takes most of the frame rather than a corner of
   * it, it is painted behind everything already there, and its pivot is
   * offered at its own centre, which is where a head turns from.
   *
   * Offered, not imposed. All three land in the document where they can be
   * seen and changed; none of them is a mode the author is now in.
   */
  const addBaseImageFile = async (file) => {
    if (!assets) { setStatus('Pictures cannot be added in this editor build.', 'error'); return false; }
    let imported;
    try {
      imported = await assets.import(new Uint8Array(await file.arrayBuffer()), { name: file.name, type: file.type });
    } catch {
      setStatus(`Could not read ${file.name}.`, 'error');
      return false;
    }
    if (!imported.ok) { setStatus(`${file.name}: ${importRefusal(imported.issues)}`, 'error'); return false; }

    const before = store.getDocument();
    const box = placeBaseInArtboard(imported.asset, readArtboard(before.svgMarkup));
    if (!box) { setStatus(`${file.name} has no size to place.`, 'error'); return false; }
    const id = imageNodeId(file.name, new Set(Object.keys(before.elements || {})));
    const artwork = canvas.appendArtwork(imageNodeMarkup({ id, assetId: imported.asset.id, box }), null, { updateStore: false, position: 'back' });
    if (!artwork) { setStatus(`Could not place ${file.name}.`, 'error'); return false; }

    const elements = { ...artwork.elements };
    if (elements[id]) elements[id] = {
      ...elements[id],
      baseTransform: { ...elements[id].baseTransform, pivotX: box.pivot.x, pivotY: box.pivot.y },
      // The base plane: everything placed on top of it takes a depth in front.
      depth: 0
    };
    commands.syncSvg({ ...artwork, elements, assets: { ...(before.assets || {}), [imported.asset.id]: imported.asset } },
      { domains: ['artwork', 'layers', 'assets'], source: 'add-base-image' });
    await canvas.refreshAssets();
    preview.apply();
    setStatus(`${file.name} is the base. Add eyes and a mouth on top of it — they will be painted in front.`);
    return true;
  };

  /**
   * The whole project as one file, pictures included.
   *
   * Saving a `.json` beside a folder of pictures is a thing that works until
   * somebody moves one of them. This is the version that survives being
   * emailed (docs/V4_ROADMAP.md, Phase 4).
   */
  const saveBoopPackage = async () => {
    if (!hasValidProjectDocument(store.getState(), () => canvas.serializeCurrentSvg())) { setStatus('Create or open a project before saving.', 'warn'); return false; }
    const snapshot = createProjectSnapshot(store.getState(), () => canvas.serializeCurrentSvg());
    const { bytes, missing } = await writeBoopPackage({
      snapshot,
      bytesFor: async (id) => (assets ? assets.bytes(id) : null),
      rig: createExportRig(store.getState())
    });
    createDownload('mascot.boop', bytes, 'application/zip');
    // Said rather than swallowed: a package short a picture still opens, and
    // its author should hear it from the save and not from the reopen.
    setStatus(missing.length
      ? `Project exported — ${missing.length} picture${missing.length === 1 ? '' : 's'} could not be included.`
      : 'Project exported as a package, pictures included.', missing.length ? 'warn' : undefined);
    autosave.markSaved();
    return true;
  };

  /**
   * Open a package: its pictures into the store, its project through the same
   * door a `.json` goes through.
   *
   * The assets land first, because the canvas paints as it loads and a picture
   * that arrives afterwards is a piece drawn as a hole until something
   * redraws it.
   */
  const loadBoopFile = async (file) => {
    let read;
    try { read = await readBoopPackage(new Uint8Array(await file.arrayBuffer())); }
    catch (error) { setStatus(`${file.name}: ${error.message}`, 'error'); return false; }

    const refused = [];
    for (const [id, bytes] of read.assets) if (!assets || !(await assets.adopt(id, bytes, read.snapshot.document.assets?.[id]?.format))) refused.push(id);
    let prepared;
    try { prepared = prepareProjectSnapshot(read.snapshot, (svg) => canvas.prepareSvgImport(svg)); }
    catch { setStatus(`${file.name} is not a project this editor can open.`, 'error'); return false; }

    const restored = await restoreSnapshot(prepared, `Package ${file.name}`);
    if (!restored) return false;
    // What the package itself could not give, on top of whatever the canvas
    // then could not find: a picture refused for failing its checksum never
    // reached the store, so it would show up in both, and is counted once.
    const short = [...new Set([...read.missing, ...read.damaged, ...refused])];
    if (short.length) setStatus(`Opened ${file.name} — ${short.length} picture${short.length === 1 ? '' : 's'} in it could not be read.`, 'warn');
    return true;
  };

  /**
   * Let a picture bend, or stop it bending.
   *
   * The deformation and the record of it are written in one command. Splitting
   * them would leave a step where the artwork is a group of triangles and
   * nothing in the project knows it is a mesh -- which is a piece nobody can
   * edit and an undo that half works.
   */
  const setPictureMesh = (id, size) => {
    const before = store.getDocument();
    const mesh = size ? (before.meshes || []).find((item) => item.target === id) || restMesh(id, size) : null;
    // A size that differs from the mesh on record is a change of grid, and a
    // grid change starts from rest: there is no honest way to carry nine
    // dragged points onto sixteen.
    const wanted = mesh && mesh.size !== size ? restMesh(id, size) : mesh;
    const artwork = canvas.setMesh(id, wanted);
    if (!artwork) { setStatus(`${id} is not a picture, so it has nothing to bend.`, 'error'); return false; }
    const meshes = (before.meshes || []).filter((item) => item.target !== id);
    commands.syncSvg({ ...artwork, meshes: wanted ? [...meshes, wanted] : meshes },
      { domains: ['artwork', 'keyforms'], source: 'picture-mesh' });
    preview.apply();
    setStatus(wanted
      ? `${id} bends now. Drag its points to shape it; ${wanted.size}×${wanted.size} to start.`
      : `${id} is a plain picture again.`);
    return true;
  };

  const loadSvgFile = async (file) => {
    try {
      // Read and sanitized before the confirm dialog: an unreadable file must
      // not cost the author the project that is open.
      const prepared = canvas.prepareSvgImport(await file.text());
      const committed = await replaceProject(async () => {
        const artwork = await canvas.loadSvgFromText(prepared, {}, { recordHistory: false, updateStore: false });
        const candidate = Object.assign(createCleanProjectState(), artwork);
        store.replaceProject(createProjectDocument(candidate), createEditorSession(candidate), { source: 'svg-import' });
        preview.apply();
      });
      if (!committed) return false;
      openProject();
      setStatus(`Loaded SVG: ${file.name}`);
      return true;
    } catch {
      // Covers the rollback path too: the previous document is already back,
      // and the author is told the file was the problem.
      setStatus(`Invalid or unsupported SVG: ${file.name}`, 'error');
      return false;
    }
  };

  /**
   * @param {string} kind  a `PROJECT_TEMPLATES` key
   * @param {{ mode?: string }} [options]  where the new project lands: Artwork, or the
   *   Character Builder for the one-minute path (docs/CHARACTER_BUILDER.md)
   */
  // A template is a mascot, so it opens where a mascot is dressed. It used to
  // open in the vector editor, which is where an author who wanted to *draw*
  // one would go (docs/AUDIT_UI_2026-09/§1.5).
  //
  // Except the blank one, which is not a mascot: there is nothing for Design
  // ▸ Face to show and nothing to swap, and the only reason to ask for an
  // empty artboard is to draw on it. It lands where the drawing tools are, for
  // the same reason an imported SVG does.
  const loadTemplate = async (kind, { mode = kind === 'blank' ? 'design.artwork' : 'design.face' } = {}) => {
    const template = PROJECT_TEMPLATES[kind] || PROJECT_TEMPLATES.basic;
    const committed = await replaceProject(() => loadProjectTemplate(template, { store, canvas, history, preview, validate: validateRig }));
    if (!committed) return false;
    openProject(mode);
    setStatus(`${template.name || 'Mascot'} created.`);
    return true;
  };

  // The face builder produces a template, so generation and templates are the
  // same path -- including what happens afterwards. It is offered on Home now,
  // beside the other two ways to start, so a generated face opens its project
  // the way a template does: Home closes and Artwork is where you land.
  const generateFace = async (options) => {
    const committed = await replaceProject(() => loadProjectTemplate(buildFaceProjectTemplate(options), { store, canvas, history, preview, validate: validateRig }));
    if (committed) { openProject('design.face'); setStatus('Face built. Swap any part for another in Design ▸ Face, or give it movements in Rig ▸ Controls.'); }
    return committed;
  };

  const loadProjectFile = async (file) => {
    try {
      // A package and a snapshot arrive through the same button, because to
      // the author they are the same thing: their project. `PK\x03\x04` is a
      // ZIP, and a name is not asked because a name can be anything.
      //
      // Read through `text()` and not `slice()`: a `File` has both, but this
      // service is also handed file-*likes* -- by the e2e hooks and by the
      // tests -- and the one method all of them have is the one that was
      // always used here. The four bytes are ASCII, so they survive being
      // decoded whatever follows them does.
      if ((await file.text()).startsWith('PK\u0003\u0004')) return await loadBoopFile(file);
      const imported = JSON.parse(await file.text());
      // Parsed, versioned and normalized against a throwaway state first, so an
      // unsupported snapshot never reaches the live store.
      const prepared = prepareProjectSnapshot(imported, (svg) => canvas.prepareSvgImport(svg));
      return await restoreSnapshot(prepared, `Project ${file.name}`);
    } catch {
      setStatus(`Invalid project snapshot: ${file.name}`, 'error');
      return false;
    }
  };

  /**
   * Import an exported `rig.json` over the current artwork.
   *
   * Parameters, states, behaviors, bindings, keyforms, shape keys, warps and
   * hands land on the elements the artwork already has; anything naming an
   * element that is not there is left out. The importer has existed since the
   * schema-v1 migrations and the docs promised it; this is the first button
   * that reaches it. One undo step.
   */
  const importRigFile = async (file) => {
    if (!hasValidProjectDocument(store.getState())) { setStatus('Import or create artwork first: a rig is applied onto artwork.', 'error'); return false; }
    let imported;
    try {
      imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('A rig file is a JSON object.');
      if (imported.document && imported.version) throw new Error('This is a project file: use Open Project for it.');
    } catch (error) {
      setStatus(`Invalid rig file: ${file.name}. ${error.message}`, 'error');
      return false;
    }
    try {
      preview.stop?.();
      history.snapshot();
      store.execute({ type: 'rig/import', domains: RIG_IMPORT_DOMAINS, source: 'import', apply: (document) => applyImportedRig(document, imported) });
      preview.apply?.();
      setStatus(`Rig imported from ${file.name}. Undo puts the previous rig back.`);
      return true;
    } catch (error) {
      history.undo();
      setStatus(`Could not import the rig: ${error.message}`, 'error');
      return false;
    }
  };

  return { replaceProject, restoreSnapshot, saveProject, downloadJson, addImageFile, addBaseImageFile, replaceImageFile, setPictureMesh, saveBoopPackage, loadBoopFile, loadSvgFile, loadTemplate, generateFace, loadProjectFile, importRigFile };
}
