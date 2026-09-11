/**
 * The Character Builder (docs/CHARACTER_BUILDER.md): the simple surface over
 * the same document the rest of the editor edits.
 *
 * ```text
 * Parts (left)          Canvas (the existing one)        Properties (right)
 *   Presets · Head ·      select, drag, rotate, scale     the part in hand:
 *   Eyes · … · Hands      with the existing gizmo         position, size, turn,
 *   ─ Advanced ─                                          colours, Edit Shape
 * ```
 *
 * It creates nothing of its own: a category is a reading of the semantic
 * parts, a selection is the session's selection, a move is the artwork
 * command the Artwork inspector runs, a colour is `setAppearance`, a style
 * is the face part command (docs/FACE_PART_LIBRARY.md, "Installing"), and
 * *Edit Shape* is a route into Artwork with the piece selected. So there is
 * no second document, no second undo, and no second canvas -- and an old
 * project opens here with nothing migrated.
 *
 * This file is the wiring between the two panels and the editor; everything
 * with a rule in it is in `character-model.js`, where it can be tested pure.
 */
import { createArtworkCommands } from '../../core/commands/artwork-commands.js';
import { facePartThumbnail } from '../../core/face-library/face-part-artwork.js';
import { presetThumbnail } from '../../core/face-library/face-presets.js';
import { describeFacePartCapabilities } from '../../core/face-library/face-part-model.js';
import { createSelector } from '../../core/selectors/create-selector.js';
import { selectMany } from '../../core/state/selection.js';
import { elementDisplayName } from '../../rig-editor/semantic-parts/face-roles.js';
import { findSemanticPartByRole } from '../../rig-editor/semantic-parts/part-model.js';
import { activePiece, characterSnapshot, deriveCharacterParts, instanceNodes, instanceRootOf, mirrorTransformPatch, pairLabel, pairOf, pairSpacing, paletteOfPaints, pieceTransform, resolveActiveCategory, roleLabel, scalePatch, spacingPatch } from './character-model.js';
import { boxInMountSpace } from '../../core/face-library/face-layout.js';
import { createPartBrowser } from './part-browser.js';
import { createPartInspector } from './part-inspector.js';
import { HAND_LABELS, OTHER_HAND, describeHands } from './hand-placement-panel.js';
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { readArtboard } from '../../core/artwork/artboard.js';
import { FACE_MOUNT_POINTS, FACE_PART_CATEGORIES, artworkIds } from '../../core/face-library/face-part-model.js';
import { elementSpan } from '../../core/face-library/face-part-artwork.js';
import { CHARACTER_PRESETS, characterPreset } from './preset-browser.js';
import { carriesPart, parsePartDrag, readPartDrag } from './part-drag.js';

/** Where a route button in either panel goes. */
const ROUTES = Object.freeze({
  'hand-setup': () => ({ task: 'face-setup', focus: 'hand-setup' }),
  'face-setup': () => ({ task: 'face-setup', focus: 'face-setup-checklist' }),
  'face-part': ({ partId, selectedId }) => (partId ? { task: 'face-setup', target: { kind: 'semantic-part', id: partId } } : { task: 'face-setup', focus: 'face-setup-checklist', target: selectedId ? { kind: 'artwork-element', id: selectedId } : undefined }),
  artwork: ({ selectedId }) => ({ task: 'artwork', target: selectedId ? { kind: 'artwork-element', id: selectedId } : undefined })
});

/**
 * @param {object} deps
 * @param {HTMLElement} deps.browserHost   the left column's host
 * @param {HTMLElement} deps.inspectorHost the inspector adapter's host
 * @param {object} deps.store
 * @param {object} deps.history
 * @param {object} deps.canvas  the existing canvas: `applyElementTransform`, `setAppearance`, `describePaints`, `elementKind`, `measureElement`
 * @param {HTMLElement} [deps.dropHost]  the canvas's element: a card from the browser dropped on it is the card's press
 * @param {() => boolean} [deps.isActive]  whether the builder is the surface showing: a drop lands only then
 * @param {(route: object) => void} [deps.navigate]      the task router
 * @param {(tool: string) => void} [deps.setDesignTool]  the vector toolbar
 * @param {(options: object) => void} [deps.openColour]  the colour dialog
 * @param {(kind: string) => any} [deps.loadTemplate]    the project service's template loader
 * @param {object} [deps.facePartCommands]  `createFacePartCommands`: the library, `plan` and `replace`
 * @param {(message: string, tone?: string) => void} [deps.onStatus]
 */
export function createCharacterBuilder({ browserHost, inspectorHost, store, history, canvas, dropHost = null, isActive = () => true, navigate = () => {}, setDesignTool = () => {}, openColour = null, loadTemplate = () => false, drawHandStyle = () => false, revealInspector = () => false, facePartCommands = null, onStatus = () => {} } = {}) {
  if (!browserHost || !inspectorHost) throw new Error('Missing required UI element: #part-browser and #part-inspector');
  const commands = createArtworkCommands(store, history);
  const handCommands = createHandCommands(store, history);
  // One derivation per document revision: a selection change rereads nothing.
  const partsOf = createSelector(deriveCharacterParts);
  const doc = () => store.getDocument();
  const session = () => store.getSession();
  const model = () => partsOf(store.getPersistentRevision(), doc());
  /** The category the author pressed, kept until the canvas picks another part. */
  let chosen = null;
  /** Which pairs are edited as one; every pair is, until its box is unticked. */
  const unlinked = new Set();
  // What the author has typed into "Save as a library part" so far: the
  // panel redraws when the category changes, and must not lose the name.
  let partDraft = { category: null, name: '' };
  const isLinked = (categoryId) => !unlinked.has(categoryId);

  const select = (ids, primary = null) => store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectMany(ids, primary)); });
  const locked = (id) => Boolean(doc().layerMetadata?.[id]?.locked);
  const nameOf = (id) => elementDisplayName(doc(), id);

  /** What both panels read: the categories, and the one that is showing. */
  function current() {
    const document = doc(), parts = model();
    // A selection the document no longer holds -- the part Undo just took
    // away -- is no selection: the category the author pressed stays open.
    const selectedId = session().selectedId && document.elements?.[session().selectedId] ? session().selectedId : null;
    const state = { ...session(), selectedId };
    const active = resolveActiveCategory(parts, { chosen, selectedId });
    // The canvas picked a piece of another part: the browser follows it, and
    // stays there until the next press.
    if (selectedId && active !== chosen) chosen = active;
    const category = parts.categories.find((item) => item.id === active) || null;
    return { document, state, parts, active, category };
  }

  /**
   * The library's assets for a category, as the browser offers them: which
   * one the part is, whether each can go on right now and why not, and what
   * movements it would leave out.
   */
  function stylesOf(category) {
    if (!facePartCommands || !category?.part) return [];
    return facePartCommands.library.list(category.id).map((asset) => {
      const plan = facePartCommands.plan(category.id, asset.id);
      const { controls, missing } = describeFacePartCapabilities(asset);
      return {
        id: asset.id, name: asset.name, description: asset.description || '', thumbnail: facePartThumbnail(asset),
        current: (category.assetIds || []).includes(asset.id), available: plan.ok, reason: plan.ok ? '' : plan.reason, limited: missing, joins: Boolean(category.multiple), custom: asset.origin === 'custom', pack: asset.pack || null,
        // Every movement of the category, carried or not: what the card's title says (roadmap phase 26).
        animation: controls.map((control) => ({ control, carried: !missing.includes(control) }))
      };
    });
  }

  /** The face's colours as tokens, read from the canvas when the Colours category is open. */
  const paletteOf = (category) => (category?.kind === 'palette' && facePartCommands?.palette ? facePartCommands.palette() : null);

  /** The face-style presets, each with its picture, the one the face wears marked. */
  function facePresetsOf(category) {
    if (category?.kind !== 'presets' || !facePartCommands?.presets) return null;
    const current = facePartCommands.presetOf?.()?.id || null;
    return {
      loaded: Boolean(doc().svgMarkup), current,
      styles: facePartCommands.presets.list().map((item) => ({ id: item.id, name: item.name, description: item.description, thumbnail: presetThumbnail(item, facePartCommands.library), current: item.id === current, custom: item.origin === 'custom', pack: item.pack || null }))
    };
  }

  const browserView = () => {
    const { document, state, parts, active, category } = current();
    return { loaded: Boolean(document.svgMarkup), active, selectedId: state.selectedId, categories: parts.categories, styles: stylesOf(category), palette: paletteOf(category), facePresets: facePresetsOf(category), hands: describeHands(document), presets: CHARACTER_PRESETS };
  };

  /** A category as the inspector shows it, with the library style its part came from. */
  const describeCategory = (category) => {
    const asset = category.assetId && facePartCommands ? facePartCommands.library.get(category.assetId) : null;
    return { id: category.id, label: category.label, kind: category.kind || null, part: category.part || null, status: category.status, summary: category.summary, styleId: asset?.id || null, styleName: asset?.name || null };
  };

  const inspectorView = () => {
    const { document, state, category } = current();
    const loaded = Boolean(document.svgMarkup);
    const selectedId = state.selectedId;
    if (!loaded) return { loaded: false, kind: 'empty' };
    const piece = category ? activePiece(category, selectedId) : null;
    if (!piece && !selectedId) return category
      ? { loaded, kind: 'category', category: describeCategory(category), palette: paletteOf(category) }
      : { loaded, kind: 'empty' };
    // Something is in hand: a piece of the category, or artwork no part owns.
    const id = piece?.id || selectedId;
    const part = findSemanticPartByRole(document, id) || (piece?.partId ? document.semanticParts?.[piece.partId] || null : null);
    const hand = category?.kind === 'hands' ? describeHands(document, { pictures: false }).find((item) => item.element === id) || null : null;
    // The fields move the instance a library shape sits in, not the shape.
    const instance = instanceRootOf(model(), id);
    const pair = category && piece ? pairOf(document, category, piece.id) : null;
    return {
      loaded, kind: 'piece',
      category: category ? describeCategory(category) : null,
      pieces: category ? category.pieces.map((item) => ({ id: item.id, label: item.label })) : [],
      piece: {
        id, label: piece?.label || nameOf(id), roleLabel: piece?.roleLabel || '', partId: part?.id || piece?.partId || null, partName: part?.name || null,
        nodeKind: canvas.elementKind?.(id) || document.elements[id]?.meta?.nodeType || null,
        locked: locked(instance),
        instance: instance !== id ? { id: instance, label: nameOf(instance) } : null,
        removable: Boolean(piece?.removable),
        custom: Boolean(piece?.custom), from: piece?.from || '',
        library: Boolean(part?.assetId && part.assetRoot === instance && facePartCommands?.repaint),
        save: hand ? null : saveFormOf(document, id, category, part),
        transform: pieceTransform(document, instance),
        pair: pair ? { peerId: pair.peer.id, peerLabel: pair.peer.label, side: pair.side, linked: isLinked(category.id), label: pairLabel(category), spacing: isLinked(category.id) ? spacingOf(pair) : null } : null,
        palette: paletteOfPaints(canvas.describePaints?.(id) || []).map((entry) => ({ colour: entry.colour, count: entry.uses.length })),
        hand: hand ? { side: hand.side, label: hand.label, style: hand.style, styleCount: hand.styleCount, depth: hand.depth, other: { side: OTHER_HAND[hand.side], label: HAND_LABELS[OTHER_HAND[hand.side]], present: Boolean(describeHands(document).find((item) => item.side === OTHER_HAND[hand.side])?.element) } } : null
      }
    };
  };

  /* ── What a press does ─────────────────────────────────────────────────── */

  function chooseCategory(id) {
    const category = model().categories.find((item) => item.id === id);
    if (!category) return false;
    chosen = id;
    const ids = category.pieces.map((piece) => piece.id);
    // A category with pieces selects them all; one without takes the selection
    // away, so the inspector shows the category and not the last thing picked.
    if (ids.length) select(ids);
    else if (session().selectedId) select([]);
    render();
    return true;
  }

  /** One piece of the set in hand, the rest staying selected. */
  function choosePiece(id) {
    if (!doc().elements?.[id]) return false;
    const ids = session().selectedIds || [];
    if (ids.includes(id)) select(ids, id); else select([id]);
    render();
    // On a phone the parts are the drawer and the inspector the sheet: a piece chosen is a piece to edit.
    revealInspector();
    return true;
  }

  /** The centre of a piece in the space it shares with its pair, as the canvas measures it. */
  const centreOf = (id) => {
    const document = doc(), box = canvas.measureElement?.(id);
    if (!box || !(box.width > 0)) return null;
    const placed = boxInMountSpace(document, id, box, model().parents[id] ?? null);
    return { x: placed.x + placed.width / 2, y: placed.y + placed.height / 2 };
  };
  const spacingOf = (pair) => { const [left, right] = pair.side === 'left' ? [pair.piece.id, pair.peer.id] : [pair.peer.id, pair.piece.id]; return pairSpacing(centreOf(left), centreOf(right)); };

  /** The other side of a piece, when the pair is edited as one. */
  function linkedPeer(pieceId) {
    const { category } = current();
    if (!category || !isLinked(category.id)) return null;
    const pair = pairOf(doc(), category, pieceId);
    return pair && !locked(pair.peer.id) ? pair.peer.id : null;
  }

  /**
   * One write or several as one undo step: a pair edited as one is undone
   * as one, and a library part's root and the pieces it paints behind the
   * face take the same transform, so the drawing moves as one.
   */
  function writeTransforms(writes) {
    const all = writes.flatMap(([id, patch]) => instanceNodes(model(), id).filter((node) => doc().elements?.[node] && !locked(node)).map((node) => [node, patch]));
    if (all.length > 1) history.beginTransaction?.();
    try { for (const [id, patch] of all) { commands.setTransform(id, patch, { source: 'character-builder' }); canvas.applyElementTransform(id, doc().elements[id]); } }
    finally { if (all.length > 1) history.commitTransaction?.(); }
    return true;
  }

  function moveBy(pieceId, key, value) {
    const id = instanceRootOf(model(), pieceId);
    if (!doc().elements?.[id] || locked(id) || !Number.isFinite(Number(value))) return false;
    const patch = { [key]: Number(value) }, peer = linkedPeer(pieceId);
    return writeTransforms(peer ? [[id, patch], [peer, mirrorTransformPatch(patch)]] : [[id, patch]]);
  }

  function resize(pieceId, value) {
    const id = instanceRootOf(model(), pieceId);
    if (!doc().elements?.[id] || locked(id) || !Number.isFinite(Number(value))) return false;
    const peer = linkedPeer(pieceId);
    return writeTransforms(peer ? [[id, scalePatch(doc(), id, value)], [peer, scalePatch(doc(), peer, value)]] : [[id, scalePatch(doc(), id, value)]]);
  }

  /** The pair apart or together, half each, whichever side is in hand. */
  function setSpacing(pieceId, value) {
    const { category } = current();
    const pair = category ? pairOf(doc(), category, pieceId) : null;
    if (!pair || locked(pair.piece.id) || locked(pair.peer.id) || !Number.isFinite(Number(value))) return false;
    const [left, right] = pair.side === 'left' ? [pair.piece.id, pair.peer.id] : [pair.peer.id, pair.piece.id];
    const patch = spacingPatch(doc(), left, right, value, pairSpacing(centreOf(left), centreOf(right)));
    if (!patch) return false;
    return writeTransforms([[left, patch.left], [right, patch.right]]);
  }

  /** A whole preset on the face that is there, as one undo step (docs/FACE_PART_LIBRARY.md, "Presets"). */
  function useFacePreset(id) {
    if (!facePartCommands?.applyPreset) return false;
    const item = facePartCommands.presets.get(id);
    const result = facePartCommands.applyPreset(id);
    if (!result.ok) { onStatus(result.refused?.reason || 'The preset could not be applied.', 'error'); if (!result.steps) return false; }
    chosen = 'presets';
    select([]);
    if (result.ok) onStatus(`${item.name} is on: ${result.steps} ${result.steps === 1 ? 'step' : 'steps'}, one undo. Every part is still yours to change.`);
    render();
    return result.ok;
  }

  /** Every part back where the preset the face wears puts it. */
  function resetFacePreset() {
    const current = facePartCommands?.presetOf?.();
    return current ? useFacePreset(current.id) : false;
  }

  /** The face as it is, as a preset of the author's own. */
  function saveFacePreset(name) {
    if (!facePartCommands?.saveAsPreset || !doc().svgMarkup) return false;
    const result = facePartCommands.saveAsPreset({ name });
    onStatus(result.ok ? `${result.preset.name} is saved as a preset of yours.` : result.reason, result.ok ? undefined : 'error');
    render();
    return result.ok;
  }

  function forgetFacePreset(id) {
    const result = facePartCommands?.removePreset?.(id);
    if (!result?.ok) { if (result) onStatus(result.reason, 'error'); return false; }
    onStatus('The preset is forgotten.');
    render();
    return true;
  }

  /** A library part off the face -- an accessory, a beard -- as one undo step. */
  function removePart(pieceId) {
    const { category } = current();
    const piece = category?.pieces.find((item) => item.id === pieceId);
    if (!facePartCommands?.remove || !piece?.removable) return false;
    const result = facePartCommands.remove(piece.partId);
    if (!result.ok) { onStatus(result.reason, 'error'); return false; }
    chosen = category.id;
    select([]);
    onStatus(`${piece.label} is off. Undo puts it back.`);
    render();
    return true;
  }

  /** Edit both sides as one, or each on its own. Remembered for the session, never written to the project. */
  function setLinked(on) {
    const { category } = current();
    if (!category?.part || !category.pieces.some((piece) => pairOf(doc(), category, piece.id))) return false;
    if (on) unlinked.delete(category.id); else unlinked.add(category.id);
    render();
    return true;
  }

  /**
   * Change one colour everywhere the piece uses it, as one undo step.
   *
   * The transaction is what makes it one: `setAppearance` snapshots per shape,
   * and a hair drawn in three pieces would otherwise take three undos.
   */
  function recolour(id, from) {
    const entry = paletteOfPaints(canvas.describePaints?.(id) || []).find((item) => item.colour === from);
    if (!entry || !openColour) return false;
    openColour({
      title: `Colour of ${nameOf(id)}`, value: from,
      onPick: (value) => {
        history.beginTransaction?.();
        try { for (const use of entry.uses) canvas.setAppearance(use.id, use.property, value); }
        finally { history.commitTransaction?.(); }
        onStatus(`${entry.uses.length === 1 ? 'One piece' : `${entry.uses.length} pieces`} recoloured. Undo puts the colour back.`);
        render();
      }
    });
    return true;
  }

  /**
   * One colour of the face, everywhere the face uses it, as one undo step
   * (docs/FACE_PART_LIBRARY.md, "Palette tokens").
   */
  function retint(token) {
    const palette = facePartCommands?.palette?.();
    const entry = palette?.tokens?.find((item) => item.token === token);
    if (!entry || !openColour) return false;
    openColour({
      title: `${entry.label} colour`, value: entry.colour,
      onPick: (value) => {
        const result = facePartCommands.retint(token, value);
        if (result.ok) onStatus(`${entry.label} is ${result.colour} now, on ${result.uses === 1 ? 'one piece' : `${result.uses} pieces`}. Undo puts it back.`);
        else onStatus(result.reason, 'error');
        render();
      }
    });
    return true;
  }

  /* ── Reset (roadmap phase 29) ────────────────────────────────────────────
   *
   * Position: a library instance back where its fit put it, at the size the
   * fit gave it; the template's own piece back to where it was drawn.
   * Colours: a library instance painted again in the face's tokens. Shape:
   * the library drawing back, for an instance reshaped by hand. All: the
   * three, as one undo step.
   */
  const partOfInstance = (id) => Object.values(doc().semanticParts || {}).find((part) => part?.assetRoot === id) || null;

  /** The placement a reset puts a piece at: its fit, or where it was drawn. */
  function placementOf(id) {
    const fit = partOfInstance(id)?.assetFit;
    return fit && Number.isFinite(Number(fit.x)) ? { x: Number(fit.x), y: Number(fit.y) || 0, rotation: 0, scaleX: Number(fit.scaleX) || 1, scaleY: Number(fit.scaleY) || 1 } : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }

  function resetPart(pieceId, what = 'all') {
    const id = instanceRootOf(model(), pieceId);
    if (!doc().elements?.[id] || locked(id)) return false;
    if (handOf(pieceId)) return false;
    const part = partOfInstance(id);
    const category = part ? FACE_PART_CATEGORIES.find((item) => item.part === part.type) : null;
    const done = [];
    // Before anything is written: a drawing that cannot come back (the asset
    // forgotten, the plan refused) leaves the place as it was, rather than a
    // half-done reset recorded as one step and reported as an error.
    const restoring = (what === 'shape' || what === 'all') && Boolean(part?.assetId && category && facePartCommands?.replace);
    if (restoring) {
      const plan = facePartCommands.library?.get?.(part.assetId) ? facePartCommands.plan(category.id, part.assetId) : { ok: false, reason: `There is no part called "${part.assetId}" in the library any more: nothing to put the drawing back from.` };
      if (!plan.ok) { onStatus(plan.reason, 'error'); return false; }
    }
    // The drawing restored may come back under another id: what is in hand afterwards is what came back.
    let rootId = id;
    history.beginTransaction?.();
    try {
      // The place first: a drawing restored afterwards is fitted through the
      // root as it stands, and would carry a move the reset meant to take off.
      if (what === 'position' || what === 'all') {
        const peer = linkedPeer(pieceId);
        writeTransforms(peer ? [[id, placementOf(id)], [peer, placementOf(peer)]] : [[id, placementOf(id)]]);
        done.push('its place, turn and size');
      }
      if (restoring) {
        const result = facePartCommands.replace(category.id, part.assetId);
        if (!result.ok) { onStatus(result.reason, 'error'); return false; }
        rootId = result.rootId || id;
        done.push('the library drawing');
      }
      if ((what === 'colours' || what === 'all') && part && facePartCommands?.repaint) {
        const result = facePartCommands.repaint(part.id);
        if (result.ok) done.push('its colours'); else if (what === 'colours') { onStatus(result.reason, 'error'); return false; }
      }
    } finally { history.commitTransaction?.(); }
    select([rootId]);
    onStatus(`${nameOf(rootId)}: ${done.join(', ')} back. Undo puts it as it was.`);
    render();
    return true;
  }

  /* ── A part of the author's own (docs/FACE_PART_LIBRARY.md, "Custom parts") ──
   *
   * Any piece in hand can be saved into the library: the form names the
   * category, the roles among the shapes the piece carries, and the mount
   * point; the command reads the artwork from the document. A saved part is
   * a style card like any other, marked as the author's, with Forget beside it.
   */
  const SAVEABLE = FACE_PART_CATEGORIES.filter((category) => category.installable);

  /** The form's model for this piece: what it can be saved as, with the draft so far. */
  function saveFormOf(document, id, category, part) {
    if (!facePartCommands?.saveAsPart) return null;
    const span = elementSpan(document.svgMarkup || '', id);
    if (!span) return null;
    const inside = artworkIds(document.svgMarkup.slice(span.start, span.end));
    const owner = category?.part && SAVEABLE.find((item) => item.id === category.id) ? category.id : null;
    const chosen = SAVEABLE.find((item) => item.id === partDraft.category) ? partDraft.category : owner || SAVEABLE[0].id;
    const target = SAVEABLE.find((item) => item.id === chosen);
    // The roles the part it belongs to already names, when it is a part of that category; else the piece itself for the one role a lone shape plays.
    const named = part?.type === target.part ? part.roles || {} : {};
    const options = inside.map((elementId) => ({ id: elementId, label: nameOf(elementId) }));
    const roles = target.roles.map((role) => ({
      role, label: roleLabel(role), required: target.required.includes(role),
      value: inside.includes(named[role]) ? named[role] : (target.required.includes(role) && inside.length === 1 ? inside[0] : ''),
      options
    }));
    return { categories: SAVEABLE.map((item) => ({ id: item.id, label: item.label })), category: chosen, name: partDraft.name, roles, mountPoints: [...FACE_MOUNT_POINTS], mountPoint: target.mountPoint };
  }

  /**
   * What the author typed so far, kept across the panel's redraw. Remembered
   * only: a redraw here, on the name's own change, would replace the Save
   * button under the press that blurred the field.
   */
  function saveDraft(patch = {}) {
    partDraft = { ...partDraft, ...patch };
    return true;
  }

  /** The piece in hand into the library, as the form says. */
  function savePart(pieceId, { name, category, roles = {}, mountPoint = null } = {}) {
    if (!facePartCommands?.saveAsPart) return false;
    const result = facePartCommands.saveAsPart({ rootId: pieceId, category, name, roles, mountPoint });
    if (!result.ok) { onStatus(result.reason, 'error'); return false; }
    partDraft = { category: null, name: '' };
    onStatus(`${result.asset.name} is in the library now, under ${SAVEABLE.find((item) => item.id === result.asset.category)?.label || result.asset.category}: a style card of yours, on this face and the next.`);
    render();
    return true;
  }

  /** One of the author's own parts, forgotten; a face wearing it keeps its drawing. */
  function forgetPart(assetId) {
    if (!facePartCommands?.removeCustomPart) return false;
    const name = facePartCommands.library.get(assetId)?.name || assetId;
    const result = facePartCommands.removeCustomPart(assetId);
    onStatus(result.ok ? `${name} is forgotten. A face wearing it keeps its drawing.` : result.reason, result.ok ? undefined : 'error');
    render();
    return result.ok;
  }

  /* ── The hands ─────────────────────────────────────────────────────────
   *
   * A hand is moved, turned and resized like any piece: the rig adds its
   * own movement on top of the artwork's base transform. What is the hand's
   * alone is its depth and the mirror of its placement (docs/CHARACTER_BUILDER.md, "Hands").
   */
  const handOf = (pieceId) => describeHands(doc(), { pictures: false }).find((item) => item.element === pieceId) || null;

  /** A hand's depth: -1 rests behind the head, 1 in front; the rig adds its own on top. */
  function setHandDepth(pieceId, value) {
    const hand = handOf(pieceId);
    if (!hand || !Number.isFinite(Number(value))) return false;
    const depth = Math.max(-1, Math.min(1, Number(value)));
    if (!handCommands.setDepth(hand.side, depth)) return false;
    onStatus(`${hand.label} rests at depth ${depth}${depth < 0 ? ', behind the head' : depth > 0 ? ', in front' : ''}. Undo puts it back.`);
    render();
    return true;
  }

  /**
   * The other hand made the mirror image of this one, as one undo step: its
   * artwork's place, turn and size mirrored across the face, and its anchor,
   * rest, reach and depth mirrored by the hand model. Its drawings stay its own.
   */
  function mirrorHandPlacement(pieceId) {
    const hand = handOf(pieceId);
    if (!hand) return false;
    const other = describeHands(doc(), { pictures: false }).find((item) => item.side === OTHER_HAND[hand.side]);
    if (!other?.element) { onStatus(`Draw the ${other.label.toLowerCase()} first: Hand setup draws the pair.`, 'warn'); return false; }
    if (locked(other.element)) { onStatus(`${other.label} is locked. Unlock it in Artwork to mirror onto it.`, 'warn'); return false; }
    const box = readArtboard(doc().svgMarkup || '');
    const base = doc().elements[pieceId]?.baseTransform || {};
    history.beginTransaction?.();
    try {
      handCommands.mirror(hand.side, { mirrorX: box ? box.x + box.width / 2 : 0, element: other.element });
      commands.setTransform(other.element, { x: -(Number(base.x) || 0), y: Number(base.y) || 0, rotation: -(Number(base.rotation) || 0), scaleX: Number.isFinite(Number(base.scaleX)) ? Number(base.scaleX) : 1, scaleY: Number.isFinite(Number(base.scaleY)) ? Number(base.scaleY) : 1 }, { source: 'character-builder' });
      canvas.applyElementTransform(other.element, doc().elements[other.element]);
    } finally { history.commitTransaction?.(); }
    onStatus(`${other.label} is the mirror of the ${hand.label.toLowerCase()} now: place, turn, size, depth, anchor and reach. Undo puts it back.`);
    render();
    return true;
  }

  /**
   * The drawing a hand rests on, from its cards (docs/HAND_STYLES.md): one it
   * has becomes the resting style; one it has not is drawn first -- the same
   * press as the picker beside the face -- and rested on, as one undo step.
   */
  function useHandStyle(key) {
    const [side, styleId] = String(key || '').split(':');
    const hand = describeHands(doc(), { pictures: false }).find((item) => item.side === side && item.element);
    const style = hand?.styles.find((item) => item.id === styleId);
    if (!hand || !style) return false;
    if (style.resting) { select([hand.element]); render(); return true; }
    let ok = false;
    history.beginTransaction?.();
    try {
      ok = style.drawn
        ? handCommands.setStyles(side, { showing: style.id })
        : drawHandStyle(side, style.id) === true && handCommands.setStyles(side, { showing: style.id });
    } finally { history.commitTransaction?.(); }
    if (!ok) {
      onStatus(style.drawn ? `${hand.label} could not rest on ${style.name}.` : `${style.name} could not be drawn on the ${hand.label.toLowerCase()}: give the hand its drawings in Hand setup first.`, 'error');
      render();
      return false;
    }
    select([hand.element]);
    onStatus(style.drawn
      ? `${hand.label} rests on ${style.name} now; its movements still swap drawings as they did. Undo puts it back.`
      : `${style.name} is drawn on the ${hand.label.toLowerCase()}, and the hand rests on it. One undo takes both back.`);
    render();
    return true;
  }

  /**
   * The vector tools, on this piece: Artwork, with the piece selected, the
   * visible edit limited to it (the rest dimmed and inert, a shape drawn
   * going inside it), and the Node tool when it has nodes.
   */
  function editShape(id) {
    if (!doc().elements?.[id]) return false;
    navigate({ task: 'artwork', target: { kind: 'artwork-element', id } });
    const scoped = canvas.setEditScope?.(id) === true;
    const back = scoped ? 'Back to Character, or the Character tab, brings you back with it in hand.' : 'The Character tab brings you back.';
    if (canvas.elementKind?.(id) === 'path') {
      setDesignTool('node');
      onStatus(`Editing the shape of ${nameOf(id)}: drag its points; Esc leaves the Node tool. ${back}`);
    } else onStatus(`${nameOf(id)} is selected in Artwork${scoped ? ', the rest of the drawing out of the way' : ''}. Pick the Node tool to reshape it, or draw into it. ${back}`);
    return true;
  }

  function route(name) {
    const make = ROUTES[name];
    if (!make) return false;
    const { category, state } = current();
    navigate(make({ partId: category?.partId || findSemanticPartByRole(doc(), state.selectedId)?.id || null, selectedId: state.selectedId }));
    return true;
  }

  /** Back to the interface with every control: Artwork or Face Setup, on the same part. */
  function advanced(where) {
    return route(where === 'face-setup' ? 'face-part' : 'artwork');
  }

  function usePreset(id) {
    const preset = characterPreset(id);
    if (!preset) return false;
    return Boolean(loadTemplate(preset.template));
  }

  /**
   * Put a library asset on as the open category's part: one command, one
   * undo step, the part's movements kept (docs/FACE_PART_LIBRARY.md).
   */
  function useStyle(assetId) {
    if (!facePartCommands) return false;
    const asset = facePartCommands.library.get(assetId);
    // An asset the library has not got is refused whichever category is open: a stale drag says so too.
    if (!asset) { onStatus(`Could not use ${assetId}: There is no asset called "${assetId}".`, 'error'); return false; }
    let { category } = current();
    // A card dropped on the mascot is its own category's, whichever is open:
    // the browser opens that one first, as a press on it would.
    if (asset && category?.id !== asset.category && model().categories.some((item) => item.id === asset.category)) { chooseCategory(asset.category); category = current().category; }
    if (!category?.part) return false;
    const result = facePartCommands.replace(category.id, assetId);
    if (!result.ok) { onStatus(`Could not use ${asset?.name || assetId}: ${result.reason}`, 'error'); return false; }
    chosen = category.id;
    // The new part is what is in hand now, every piece of it -- or, where a
    // face wears several, the one that just went on.
    const pieces = category.multiple ? [result.rootId] : model().categories.find((item) => item.id === category.id)?.pieces.map((piece) => piece.id) || [];
    select(pieces.length ? pieces : [result.rootId]);
    const kept = result.enabled.length ? ` ${result.enabled.join(', ')} still work` : '';
    const lost = result.disabled.length ? `; ${result.disabled.join(', ')} ${result.disabled.length === 1 ? 'has' : 'have'} nothing to move on it` : '';
    onStatus(`${asset.name} is the ${category.label.toLowerCase()} now.${kept}${lost}. Undo puts the old one back.${result.warning ? ` (Preview: ${result.warning})` : ''}`);
    render();
    return true;
  }

  /** A card from the browser, dropped on the mascot: the card's press (docs/CHARACTER_BUILDER.md, "Drag & drop"). */
  function dropPart(drag) {
    const card = typeof drag === 'string' ? parsePartDrag(drag) : drag;
    if (!card) return false;
    return card.kind === 'hand-style' ? useHandStyle(card.id) : useStyle(card.id);
  }

  // The canvas as the drop target. Only a drag that carries a card is taken
  // (a file dropped on the page keeps doing what it did); while one is over
  // the mascot the canvas says so, for the stylesheet. Enter and leave are
  // counted because they fire for every child the drag crosses.
  const dropListeners = [];
  if (typeof dropHost?.addEventListener === 'function') {
    let inside = 0;
    const mark = (on) => { if (on) dropHost.dataset.characterDrop = 'true'; else delete dropHost.dataset.characterDrop; };
    // Only while the builder is the surface showing: a card dragged in from
    // another window onto Artwork or Preview is left to the browser.
    const wanted = (event) => isActive() && carriesPart(event.dataTransfer);
    const enter = (event) => { if (!wanted(event)) return; event.preventDefault?.(); inside += 1; mark(true); };
    const over = (event) => { if (!wanted(event)) return; event.preventDefault?.(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; };
    const leave = (event) => { if (!wanted(event)) return; inside = Math.max(0, inside - 1); if (!inside) mark(false); };
    const drop = (event) => {
      inside = 0;
      mark(false);
      if (!isActive()) return;
      const card = readPartDrag(event.dataTransfer);
      if (!card) return;
      event.preventDefault?.();
      dropPart(card);
    };
    for (const [type, handler] of [['dragenter', enter], ['dragover', over], ['dragleave', leave], ['drop', drop]]) { dropHost.addEventListener(type, handler); dropListeners.push([type, handler]); }
  }

  const browser = createPartBrowser(browserHost, { view: browserView, onCategory: chooseCategory, onPiece: choosePiece, onPreset: usePreset, onStyle: useStyle, onToken: retint, onFacePreset: useFacePreset, onPresetReset: resetFacePreset, onPresetSave: saveFacePreset, onPresetForget: forgetFacePreset, onRoute: route, onAdvanced: advanced, onHandStyle: useHandStyle, onStyleForget: forgetPart });
  const inspector = createPartInspector(inspectorHost, { view: inspectorView, onTransform: moveBy, onScale: resize, onSpacing: setSpacing, onLinked: setLinked, onPiece: choosePiece, onColour: recolour, onToken: retint, onEditShape: editShape, onRemove: removePart, onRoute: route, onHandDepth: setHandDepth, onHandMirror: mirrorHandPlacement, onSaveDraft: saveDraft, onSavePart: savePart, onReset: resetPart });

  function render() {
    const drewBrowser = browser.render();
    const drewInspector = inspector.render();
    return drewBrowser || drewInspector;
  }

  return {
    render,
    openCategory: chooseCategory,
    selectPiece: choosePiece,
    editShape,
    setHandDepth,
    mirrorHandPlacement,
    useHandStyle,
    savePart,
    forgetPart,
    resetPart,
    useStyle,
    setLinked,
    retint,
    removePart,
    useFacePreset,
    resetFacePreset,
    saveFacePreset,
    /** The builder as plain data, for the browser-test seam. */
    snapshot() {
      const { state, parts, active } = current();
      const palette = facePartCommands?.palette?.();
      return { ...characterSnapshot(parts, { active, selectedId: state.selectedId }), piece: inspectorView().piece?.id || null, palette: palette ? Object.fromEntries(palette.tokens.map((entry) => [entry.token, entry.colour])) : null, preset: facePartCommands?.presetOf?.()?.id || null, scope: canvas.getEditScope?.() ?? null, hands: describeHands(doc(), { pictures: false }).filter((hand) => hand.element).map((hand) => ({ side: hand.side, element: hand.element, resting: hand.resting, drawn: hand.styles.filter((style) => style.drawn).map((style) => style.id) })) };
    },
    counters: () => ({ browser: browser.counters(), inspector: inspector.counters() }),
    destroy() { browser.destroy(); inspector.destroy(); partsOf.clear(); for (const [type, handler] of dropListeners) dropHost.removeEventListener?.(type, handler); }
  };
}
