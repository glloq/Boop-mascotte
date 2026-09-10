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
import { describeFacePartCapabilities } from '../../core/face-library/face-part-model.js';
import { createSelector } from '../../core/selectors/create-selector.js';
import { selectMany } from '../../core/state/selection.js';
import { elementDisplayName } from '../../rig-editor/semantic-parts/face-roles.js';
import { findSemanticPartByRole } from '../../rig-editor/semantic-parts/part-model.js';
import { activePiece, characterSnapshot, deriveCharacterParts, paletteOfPaints, pieceTransform, resolveActiveCategory, scalePatch } from './character-model.js';
import { createPartBrowser } from './part-browser.js';
import { createPartInspector } from './part-inspector.js';
import { describeHands } from './hand-placement-panel.js';
import { CHARACTER_PRESETS, characterPreset } from './preset-browser.js';

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
 * @param {object} deps.canvas  the existing canvas: `applyElementTransform`, `setAppearance`, `describePaints`, `elementKind`
 * @param {(route: object) => void} [deps.navigate]      the task router
 * @param {(tool: string) => void} [deps.setDesignTool]  the vector toolbar
 * @param {(options: object) => void} [deps.openColour]  the colour dialog
 * @param {(kind: string) => any} [deps.loadTemplate]    the project service's template loader
 * @param {object} [deps.facePartCommands]  `createFacePartCommands`: the library, `plan` and `replace`
 * @param {(message: string, tone?: string) => void} [deps.onStatus]
 */
export function createCharacterBuilder({ browserHost, inspectorHost, store, history, canvas, navigate = () => {}, setDesignTool = () => {}, openColour = null, loadTemplate = () => false, facePartCommands = null, onStatus = () => {} } = {}) {
  if (!browserHost || !inspectorHost) throw new Error('Missing required UI element: #part-browser and #part-inspector');
  const commands = createArtworkCommands(store, history);
  // One derivation per document revision: a selection change rereads nothing.
  const partsOf = createSelector(deriveCharacterParts);
  const doc = () => store.getDocument();
  const session = () => store.getSession();
  const model = () => partsOf(store.getPersistentRevision(), doc());
  /** The category the author pressed, kept until the canvas picks another part. */
  let chosen = null;

  const select = (ids, primary = null) => store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectMany(ids, primary)); });
  const locked = (id) => Boolean(doc().layerMetadata?.[id]?.locked);
  const nameOf = (id) => elementDisplayName(doc(), id);

  /** What both panels read: the categories, and the one that is showing. */
  function current() {
    const document = doc(), state = session(), parts = model();
    const active = resolveActiveCategory(parts, { chosen, selectedId: state.selectedId });
    // The canvas picked a piece of another part: the browser follows it, and
    // stays there until the next press.
    if (state.selectedId && active !== chosen) chosen = active;
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
      const { missing } = describeFacePartCapabilities(asset);
      return {
        id: asset.id, name: asset.name, description: asset.description || '', thumbnail: facePartThumbnail(asset),
        current: category.assetId === asset.id, available: plan.ok, reason: plan.ok ? '' : plan.reason, limited: missing
      };
    });
  }

  const browserView = () => {
    const { document, state, parts, active, category } = current();
    return { loaded: Boolean(document.svgMarkup), active, selectedId: state.selectedId, categories: parts.categories, styles: stylesOf(category), hands: describeHands(document), presets: CHARACTER_PRESETS };
  };

  /** A category as the inspector shows it, with the library style its part came from. */
  const describeCategory = (category) => {
    const asset = category.assetId && facePartCommands ? facePartCommands.library.get(category.assetId) : null;
    return { id: category.id, label: category.label, kind: category.kind || null, part: category.part || null, status: category.status, summary: category.summary, styleId: asset?.id || null, styleName: asset?.name || null };
  };

  const inspectorView = () => {
    const { document, state, category } = current();
    const loaded = Boolean(document.svgMarkup);
    const selectedId = state.selectedId && document.elements?.[state.selectedId] ? state.selectedId : null;
    if (!loaded) return { loaded: false, kind: 'empty' };
    const piece = category ? activePiece(category, selectedId) : null;
    if (!piece && !selectedId) return category
      ? { loaded, kind: 'category', category: describeCategory(category) }
      : { loaded, kind: 'empty' };
    // Something is in hand: a piece of the category, or artwork no part owns.
    const id = piece?.id || selectedId;
    const part = findSemanticPartByRole(document, id);
    const hand = category?.kind === 'hands' ? describeHands(document).find((item) => item.element === id) || null : null;
    return {
      loaded, kind: 'piece',
      category: category ? describeCategory(category) : null,
      pieces: category ? category.pieces.map((item) => ({ id: item.id, label: item.label })) : [],
      piece: {
        id, label: piece?.label || nameOf(id), roleLabel: piece?.roleLabel || '', partId: part?.id || piece?.partId || null, partName: part?.name || null,
        nodeKind: canvas.elementKind?.(id) || document.elements[id]?.meta?.nodeType || null,
        locked: locked(id),
        transform: pieceTransform(document, id),
        palette: paletteOfPaints(canvas.describePaints?.(id) || []).map((entry) => ({ colour: entry.colour, count: entry.uses.length })),
        hand: hand ? { side: hand.side, label: hand.label, style: hand.style, styleCount: hand.styleCount } : null
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
    return true;
  }

  function moveBy(id, key, value) {
    if (!doc().elements?.[id] || locked(id) || !Number.isFinite(Number(value))) return false;
    commands.setTransform(id, { [key]: Number(value) }, { source: 'character-builder' });
    canvas.applyElementTransform(id, doc().elements[id]);
    return true;
  }

  function resize(id, value) {
    if (!doc().elements?.[id] || locked(id) || !Number.isFinite(Number(value))) return false;
    commands.setTransform(id, scalePatch(doc(), id, value), { source: 'character-builder' });
    canvas.applyElementTransform(id, doc().elements[id]);
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

  /** The vector tools, on this piece: Artwork, with the piece selected, and the Node tool when it has nodes. */
  function editShape(id) {
    if (!doc().elements?.[id]) return false;
    navigate({ task: 'artwork', target: { kind: 'artwork-element', id } });
    if (canvas.elementKind?.(id) === 'path') {
      setDesignTool('node');
      onStatus(`Editing the shape of ${nameOf(id)}: drag its points; Esc leaves the Node tool. The Character tab brings you back.`);
    } else onStatus(`${nameOf(id)} is selected in Artwork. Pick the Node tool to reshape it; the Character tab brings you back.`);
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
    const { category } = current();
    if (!facePartCommands || !category?.part) return false;
    const asset = facePartCommands.library.get(assetId);
    const result = facePartCommands.replace(category.id, assetId);
    if (!result.ok) { onStatus(`Could not use ${asset?.name || assetId}: ${result.reason}`, 'error'); return false; }
    chosen = category.id;
    // The new part is what is in hand now, every piece of it.
    const pieces = model().categories.find((item) => item.id === category.id)?.pieces.map((piece) => piece.id) || [];
    select(pieces.length ? pieces : [result.rootId]);
    const kept = result.enabled.length ? ` ${result.enabled.join(', ')} still work` : '';
    const lost = result.disabled.length ? `; ${result.disabled.join(', ')} ${result.disabled.length === 1 ? 'has' : 'have'} nothing to move on it` : '';
    onStatus(`${asset.name} is the ${category.label.toLowerCase()} now.${kept}${lost}. Undo puts the old one back.`);
    render();
    return true;
  }

  const browser = createPartBrowser(browserHost, { view: browserView, onCategory: chooseCategory, onPiece: choosePiece, onPreset: usePreset, onStyle: useStyle, onRoute: route, onAdvanced: advanced });
  const inspector = createPartInspector(inspectorHost, { view: inspectorView, onTransform: moveBy, onScale: resize, onPiece: choosePiece, onColour: recolour, onEditShape: editShape, onRoute: route });

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
    useStyle,
    /** The builder as plain data, for the browser-test seam. */
    snapshot() {
      const { state, parts, active } = current();
      return { ...characterSnapshot(parts, { active, selectedId: state.selectedId }), piece: inspectorView().piece?.id || null };
    },
    counters: () => ({ browser: browser.counters(), inspector: inspector.counters() }),
    destroy() { browser.destroy(); inspector.destroy(); partsOf.clear(); }
  };
}
