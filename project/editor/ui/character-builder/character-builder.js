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
import { assetsFor, availableMorphologies, describeRestylePlan, morphologiesOfFace, presetsFor, restylePlan } from '../../core/face-library/compatibility.js';
import { FACE_MORPHOLOGY_IDS, FACE_SLOT_IDS, assetSlot, assetSupportsMorphology, faceMorphology, faceSlot } from '../../core/face-library/face-morphologies.js';
import { availableFaceStyles, faceStyle } from '../../core/face-library/face-styles.js';
import { createSelector } from '../../core/selectors/create-selector.js';
import { selectMany } from '../../core/state/selection.js';
import { elementDisplayName } from '../../rig-editor/semantic-parts/face-roles.js';
import { findSemanticPartByRole } from '../../rig-editor/semantic-parts/part-model.js';
import { activePiece, characterSnapshot, deriveCharacterParts, instanceNodes, instanceRootOf, mirrorTransformPatch, pairLabel, pairOf, pairSpacing, paletteOfPaints, pieceTransform, resolveActiveCategory, roleLabel, scalePatch, spacingPatch } from './character-model.js';
import { orderByMemory, readLibraryMemory, rememberUse, toggleFavourite } from './library-memory.js';
import { boxInMountSpace } from '../../core/face-library/face-layout.js';
import { deriveVisualRows, rowInstallTarget } from './visual-rows.js';
import { createPartBrowser } from './part-browser.js';
import { createPartInspector } from './part-inspector.js';
import { HAND_LABELS, OTHER_HAND, describeHands } from './hand-placement-panel.js';
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { restoreHandDrawingCommand } from '../../core/hands/hand-drawing.js';
import { readArtboard } from '../../core/artwork/artboard.js';
import { FACE_MOUNT_POINTS, FACE_PART_CATEGORIES, artworkIds, assetTags, facePartCategory, parseFaceTags } from '../../core/face-library/face-part-model.js';
import { elementSpan } from '../../core/face-library/face-part-artwork.js';
import { CHARACTER_PRESETS, characterPreset } from './preset-browser.js';
import { carriesPart, parsePartDrag, readPartDrag } from './part-drag.js';
import { pieceActionsFor } from '../piece-actions.js';

/** Where a route button in either panel goes. */
const ROUTES = Object.freeze({
  'hand-setup': () => ({ mode: 'rig.controls', focus: 'hand-setup' }),
  'face-setup': () => ({ mode: 'rig.assign', focus: 'face-setup-checklist' }),
  'face-part': ({ partId, selectedId }) => (partId ? { mode: 'rig.assign', target: { kind: 'semantic-part', id: partId } } : { mode: 'rig.assign', focus: 'face-setup-checklist', target: selectedId ? { kind: 'artwork-element', id: selectedId } : undefined }),
  artwork: ({ selectedId }) => ({ mode: 'design.artwork', target: selectedId ? { kind: 'artwork-element', id: selectedId } : undefined })
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
 * @param {(action: string, id: string) => void} [deps.runPieceAction]  app/editor-app.js's one runner
 */
export function createCharacterBuilder({ browserHost, inspectorHost, store, history, canvas, dropHost = null, isActive = () => true, navigate = () => {}, setDesignTool = () => {}, openColour = null, loadTemplate = () => false, drawHandStyle = () => false, revealInspector = () => false, facePartCommands = null, onStatus = () => {}, runPieceAction = () => {} } = {}) {
  if (!browserHost || !inspectorHost) throw new Error('Missing required UI element: #part-browser and #part-inspector');
  const commands = createArtworkCommands(store, history);
  const handCommands = createHandCommands(store, history);
  // One derivation per document revision: a selection change rereads nothing.
  const partsOf = createSelector(deriveCharacterParts);
  const doc = () => store.getDocument();
  const session = () => store.getSession();
  /**
   * What both panels are built out of: the **visual rows** (MASC-08B), not the
   * eleven semantic categories. Muzzle, Whiskers and Accessories are three rows
   * of one category, and everything below -- which cards are offered, which
   * part a press acts on, which row a click on the canvas opens -- reads this.
   * The regrouping is pure and cheap; the reading of the document underneath it
   * is still one derivation per revision.
   */
  const model = () => deriveVisualRows(partsOf(store.getPersistentRevision(), doc()), { document: doc(), library: facePartCommands?.library || null, morphology: activeMorphology() });
  /** The visual row the author pressed, kept until the canvas picks another part. */
  let chosen = null;
  /**
   * The kind of face Design is offering for (MASC-05).
   *
   * Session-only, like `chosen`: it decides what is *listed*, never what is on
   * the mascot, so it is not a project fact (§5, Règle D). Null until an author
   * presses one, and the face's own parts answer until then.
   */
  let morphology = null;
  /** What the last restyle did, shown under the cards until the author leaves the row. */
  let styleNotice = '';
  /**
   * What the author is looking for in the library.
   *
   * A hundred and fifty drawings and no way to look for one (the audit's
   * §8.2). Session-only, like `chosen` and `morphology`: it decides what is
   * *listed*, never what is on the mascot, so it is not a project fact.
   * Matching is over the name, the description and the **tags** — which every
   * asset has carried since MASC-02 and nothing had ever read.
   */
  let query = '';
  /**
   * Whether the library is offered whole, past the kind of face (MASC-07, and
   * the audit's §9.2).
   *
   * The filter is right and should stay the default: a person making a human
   * face has no use for four kinds of antenna. But it was **total** — the six
   * muzzles, six beaks, six crests and four antennae were simply absent, with
   * no way to see them — and putting a beak on a human face is a perfectly
   * reasonable thing to want. Session-only: it changes what is listed, never
   * what is on the mascot.
   */
  let showAll = false;
  /**
   * What this author reaches for (audit §8.3).
   *
   * A preference, never project data: it says what somebody keeps using, not
   * what this mascot is made of, so it does not travel with a save.
   */
  const memoryStore = (() => { try { return globalThis.localStorage || null; } catch { return null; } })();
  let memory = readLibraryMemory(memoryStore);
  /** Which pairs are edited as one; every pair is, until its box is unticked. */
  const unlinked = new Set();
  // What the author has typed into "Save as a library part" so far: the
  // panel redraws when the category changes, and must not lose the name.
  let partDraft = { slot: null, name: '', morphologies: null, tags: null, mountPoint: null };
  const isLinked = (categoryId) => !unlinked.has(categoryId);

  const select = (ids, primary = null) => store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectMany(ids, primary)); });
  const locked = (id) => Boolean(doc().layerMetadata?.[id]?.locked);
  const nameOf = (id) => elementDisplayName(doc(), id);
  /** Whether a piece is shown. Visibility is a `display` attribute on the node, which the tree reports. */
  const layerVisible = (items, id) => { for (const item of items || []) { if (item.id === id) return item.visible !== false; const found = layerVisible(item.children, id); if (found !== null) return found; } return null; };

  /**
   * Whether a drawing answers what the author typed.
   *
   * Every word has to be found somewhere, so "cat eye" finds the drawing
   * tagged both and not every drawing tagged either. The name, the description
   * and the tags, which is everything an author could reasonably have in mind
   * when they type — the id is deliberately not searched: `eyes.round-large`
   * would make "round" match things whose *name* says nothing of the sort.
   */
  function matchesQuery(asset) {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return true;
    const haystack = `${asset?.name || ''} ${asset?.description || ''} ${assetTags(asset).join(' ')}`.toLowerCase();
    return wanted.split(/\s+/).every((word) => haystack.includes(word));
  }

  /** Which rows have anything left to show once a search has narrowed them. */
  function searchHits(rows) {
    if (!query.trim() || !facePartCommands) return null;
    const hits = {};
    for (const row of rows) {
      if (!row.part) continue;
      hits[row.id] = assetsFor({ library: facePartCommands.library, morphology: showAll ? null : activeMorphology(), slot: row.id })
        .filter((item) => matchesQuery(item.card)).length;
    }
    return hits;
  }

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
   * The part on the face a card stands for, or null when the face is not
   * wearing it.
   *
   * The drawing on the face is the card's own, or a style of it: a preset that
   * dressed the face in its own look leaves the card it chose from marked (the
   * style is the preset's choice, and the column is the library's). So a press
   * acts on the part that is really there -- putting the card's drawing back,
   * or taking the restyle off -- and never on the id written on the card.
   */
  function wornPart(row, asset) {
    const library = facePartCommands?.library;
    if (!library || !asset) return null;
    // The row's own drawings, never the category's: pressing the cat's muzzle
    // must not find the whiskers, which are the same kind of part.
    return (row?.worn || []).find((item) => item.assetId === asset.id || library.get(item.assetId)?.variant?.of === asset.id) || null;
  }

  /**
   * The library's assets for a category, as the browser offers them: which
   * one the part is, whether each can go on right now and why not, and what
   * movements it would leave out.
   *
   * A category a face wears several of *toggles* (docs/FACE_PART_LIBRARY.md,
   * "Several at once"): the card of a drawing that is on takes it off, and
   * `removes` is the part it would take -- what the card says before it is
   * pressed, and what the press acts on. Whether a category toggles is the
   * category's own `multiple`, never a list of names.
   */
  function stylesOf(row) {
    if (!facePartCommands || !row?.part) return [];
    // Only the drawings this kind of face can wear (MASC-07). The **slot** is
    // the filter and the category is still the authority: what a press installs
    // is decided by `asset.category`, exactly as before, so the layer above the
    // library cannot change what the rig gets. That is why the row hands one id
    // to `assetsFor` and another to `plan`.
    const kind = activeMorphology();
    const offered = assetsFor({ library: facePartCommands.library, morphology: showAll ? null : kind, slot: row.id })
      .map((item) => item.card)
      .filter((asset) => matchesQuery(asset));
    // With the filter lifted, a card that is not this kind's says so: the
    // offer stays honest rather than silently mixing a duck's bill into a
    // list of human mouths.
    const otherKind = (asset) => (showAll && kind && !assetSupportsMorphology(asset, kind)
      ? (asset.morphologies || []).map((id) => faceMorphology(id)?.label).filter(Boolean).join(' · ') || 'another kind'
      : '');
    return orderByMemory(offered, memory).map((asset) => {
      const on = wornPart(row, asset);
      const removes = row.multiple && on ? on.partId : null;
      // Which press the card would make is which plan says whether it can be
      // made: taking off has its own refusals, and they are worth reading. The
      // plan is asked about the same part the press would act on, so a card
      // that says it can be pressed is a card whose press lands (MASC-08B).
      const plan = removes ? facePartCommands.planOff(removes) : facePartCommands.plan(row.categoryId, asset.id, rowInstallTarget(row));
      const { controls, missing } = describeFacePartCapabilities(asset);
      return {
        id: asset.id, name: asset.name, description: asset.description || '', thumbnail: facePartThumbnail(asset),
        favourite: memory.favourite.includes(asset.id),
        current: Boolean(on), removes, available: plan.ok, reason: plan.ok ? '' : plan.reason, limited: missing, joins: Boolean(row.multiple && !row.dedicated), custom: asset.origin === 'custom', pack: asset.pack || null, otherKind: otherKind(asset),
        // Every movement of the category, carried or not: what the card's title says (roadmap phase 26).
        animation: controls.map((control) => ({ control, carried: !missing.includes(control) }))
      };
    });
  }

  /**
   * The kind of face being browsed: what an author pressed, or what the face's
   * own drawings say.
   *
   * A face of drawings that suit every kind -- which is every face the library
   * makes today -- reads as `human`, because that is what the library draws. One
   * wearing a cat's muzzle suits only `muzzle`, and reads as that without
   * anybody having pressed anything.
   */
  function activeMorphology() {
    if (morphology) return morphology;
    const worn = facePartCommands ? morphologiesOfFace(doc(), { library: facePartCommands.library }) : [];
    return worn.length === 1 ? worn[0] : 'human';
  }

  /** The five kinds, each with what it is waiting for, when the Type row is open. */
  function typesOf() {
    if (!facePartCommands) return null;
    const current = activeMorphology();
    return {
      loaded: Boolean(doc().svgMarkup),
      types: availableMorphologies({ library: facePartCommands.library })
        .map((type) => ({ id: type.id, label: type.label, description: type.description, available: type.available, missing: [...type.missing], current: type.id === current }))
    };
  }

  /**
   * The styles on offer, each with how much of *this* face it could redraw.
   *
   * The count is read from the face that is there rather than from the
   * library at large, because that is the number an author is deciding on: a
   * style with fifty drawings and none of the nine this face wears would
   * redraw nothing, and a card saying "50 drawings" would be a card that lies.
   */
  function faceStylesOf() {
    if (!facePartCommands) return null;
    const library = facePartCommands.library, document = doc();
    return {
      loaded: Boolean(document.svgMarkup),
      notice: styleNotice,
      styles: availableFaceStyles(library).map((style) => {
        const plan = restylePlan(document, style.id, { library });
        return {
          id: style.id, label: style.label, description: style.description, base: Boolean(style.base),
          restyled: plan.replace.length, already: plan.already.length, kept: plan.kept.length,
          total: plan.replace.length + plan.already.length + plan.kept.length
        };
      })
    };
  }

  /** The face's colours as tokens, read from the canvas when the Colours category is open. */
  const paletteOf = (category) => (category?.kind === 'palette' && facePartCommands?.palette ? facePartCommands.palette() : null);

  /** The face-style presets, each with its picture, the one the face wears marked. */
  function facePresetsOf(category) {
    if (category?.kind !== 'presets' || !facePartCommands?.presets) return null;
    const current = facePartCommands.presetOf?.()?.id || null;
    // The presets this kind of face can actually be dressed in (MASC-08B §15).
    // Type promised "parts and presets" from MASC-05 on, and until now only the
    // parts followed it. A preset that says nothing about the kind of face it
    // makes is read from its own drawings rather than offered everywhere, so
    // the six the editor ships stay where they belong: under Human.
    return {
      loaded: Boolean(doc().svgMarkup), current,
      styles: presetsFor({ presets: facePartCommands.presets, library: facePartCommands.library, morphology: activeMorphology() }).map((item) => ({ id: item.id, name: item.name, description: item.description, thumbnail: presetThumbnail(item, facePartCommands.library), current: item.id === current, custom: item.origin === 'custom', pack: item.pack || null }))
    };
  }

  /**
   * The rows this kind of face has, plus every row the mascot is actually
   * wearing something in (MASC-07).
   *
   * The second half is the rule that makes filtering safe. A human face
   * browsed as a bird still shows its hair, because the hair is *on the
   * mascot*: hiding the only door to a part somebody has already put on would
   * be exactly the failure this whole layer is supposed to prevent. So the
   * filter narrows what is offered and never what is there.
   */
  function rowsFor(rows, active) {
    const slots = new Set(faceMorphology(activeMorphology())?.slots || []);
    if (!slots.size) return rows;
    return rows.filter((row) => row.kind || slots.has(row.id) || row.pieces.length || row.id === active);
  }

  const browserView = () => {
    const { document, state, parts, active, category } = current();
    const rows = rowsFor(parts.categories, active);
    return {
      loaded: Boolean(document.svgMarkup), active, selectedId: state.selectedId,
      categories: rows, styles: stylesOf(category),
      // The two settings over the list are drawn on every render, so they are
      // read on every render rather than only when their row was open.
      types: typesOf(), faceStyles: faceStylesOf(),
      palette: paletteOf(category), facePresets: facePresetsOf(category),
      hands: describeHands(document), presets: CHARACTER_PRESETS,
      query, showAll, memory, libraryCount: facePartCommands?.library?.cards?.().length || 0, hits: searchHits(rows)
    };
  };

  /** A category as the inspector shows it, with the library style its part came from. */
  const describeCategory = (row) => {
    const asset = row.assetId && facePartCommands ? facePartCommands.library.get(row.assetId) : null;
    // The **row** is what the inspector names -- "Muzzle", not "Accessories" --
    // and the semantic category is what its Rig, Remove and Save still call
    // (MASC-08B §13). Both travel, and neither is derived from the other here.
    return { id: row.id, label: row.label, kind: row.kind || null, categoryId: row.categoryId || null, part: row.part || null, status: row.status, summary: row.summary, styleId: asset?.id || null, styleName: asset?.name || null };
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
    // Without pictures -- the inspector draws no thumbnails -- but with the
    // drawings, because it lists them and offers the set's own back.
    const hand = category?.kind === 'hands' ? describeHands(document, { pictures: false, drawings: true }).find((item) => item.element === id) || null : null;
    // The fields move the instance a library shape sits in, not the shape.
    const instance = instanceRootOf(model(), id);
    const pair = category && piece ? pairOf(document, category, piece.id) : null;
    return {
      loaded, kind: 'piece',
      // The six gestures this piece offers, as the canvas bar and the menu
      // offer them (`ui/piece-actions.js`). Design ▸ Face is a simple surface,
      // so the rigging entries are never among them.
      actions: pieceActionsFor(describePiece(id) || {}, 'simple'),
      category: category ? describeCategory(category) : null,
      pieces: category ? category.pieces.map((item) => ({ id: item.id, label: item.label })) : [],
      piece: {
        id, label: piece?.label || nameOf(id), roleLabel: piece?.roleLabel || '', partId: part?.id || piece?.partId || null, partName: part?.name || null,
        nodeKind: canvas.elementKind?.(id) || document.elements[id]?.meta?.nodeType || null,
        locked: locked(instance),
        instance: instance !== id ? { id: instance, label: nameOf(instance) } : null,
        // Every piece of the mascot, by role rather than by SVG layer (audit
        // §1.3). Face hides the layer tree — rightly, it is a hundred and thirty
        // rows opening on the fingers of the left hand — and that left no list
        // of the mascot at all on the screen that builds it. This is the list a
        // person would draw: the parts, in the order the face wears them, each
        // saying whether it is hidden or locked.
        roster: model().categories
          .filter((row) => row.pieces?.length)
          .map((row) => ({
            id: row.id,
            label: row.label,
            pieces: row.pieces.map((item) => {
              const described = describePiece(item.id) || {};
              return { id: item.id, label: item.label, visible: described.visible !== false, locked: Boolean(described.locked), current: item.id === id };
            })
          })),
        // Where this piece sits — but only once a double-click has stepped
        // inside one, which is the case the trail exists to explain. A piece a
        // plain click would have selected is already the subject of the panel,
        // and a breadcrumb over it would be a line saying nothing (audit §2.1).
        trail: resolvePiece(id) === id ? [] : pieceTrail(id),
        removable: Boolean(piece?.removable),
        custom: Boolean(piece?.custom), from: piece?.from || '',
        library: Boolean(part?.assetId && part.assetRoot === instance && facePartCommands?.repaint),
        // A hand is not a face part, so it is not saved as one. What an author
        // saves off a hand is a **gesture**, into the hand set -- its own door,
        // in the hand workshop (docs/HAND_STYLES.md).
        save: hand ? null : saveFormOf(document, id, category, part),
        transform: pieceTransform(document, instance),
        pair: pair ? { peerId: pair.peer.id, peerLabel: pair.peer.label, side: pair.side, linked: isLinked(category.id), label: pairLabel(category), spacing: isLinked(category.id) ? spacingOf(pair) : null } : null,
        palette: paletteOfPaints(canvas.describePaints?.(id) || []).map((entry) => ({ colour: entry.colour, count: entry.uses.length })),
        hand: hand ? { side: hand.side, label: hand.label, style: hand.style, styleCount: hand.styleCount, depth: hand.depth, styles: hand.styles, other: { side: OTHER_HAND[hand.side], label: HAND_LABELS[OTHER_HAND[hand.side]], present: Boolean(describeHands(document, { pictures: false }).find((item) => item.side === OTHER_HAND[hand.side])?.element) } } : null
      }
    };
  };

  /* ── What a press does ─────────────────────────────────────────────────── */

  function chooseCategory(id) {
    const category = model().categories.find((item) => item.id === id);
    if (!category) return false;
    // What the last restyle did belongs to the row it happened in: leaving it
    // and coming back should not read as though it has just happened again.
    if (id !== 'style') styleNotice = '';
    chosen = id;
    const ids = category.pieces.map((piece) => piece.id);
    // A category with pieces selects them all; one without takes the selection
    // away, so the inspector shows the category and not the last thing picked.
    if (ids.length) select(ids);
    else if (session().selectedId) select([]);
    render();
    return true;
  }

  /**
   * Look for a drawing.
   *
   * Typing opens the first row that still has something in it, so the answer
   * is on screen rather than behind a press: a search whose results are all
   * inside collapsed rows has not found anything as far as the author is
   * concerned. Clearing it leaves the row where it is.
   */
  function search(value) {
    const next = String(value ?? '');
    if (next === query) return false;
    query = next;
    if (query.trim()) {
      const hits = searchHits(model().categories) || {};
      const first = model().categories.find((row) => hits[row.id] > 0);
      if (first) chosen = first.id;
    }
    render();
    return true;
  }

  /** Offer the library whole, or only what this kind of face is made of. */
  function setShowAll(on) {
    const next = Boolean(on);
    if (next === showAll) return false;
    showAll = next;
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

  /** Every element some part names by a role: the pieces that have a name. */
  const namedPieces = () => {
    const out = new Set();
    for (const part of Object.values(doc().semanticParts || {})) {
      for (const element of Object.values(part.roles || {})) if (element) out.add(element);
    }
    return out;
  };

  /**
   * Which piece a click on the canvas means (audit §2.1).
   *
   * An eye of the template is a group of seven shapes, so clicking the eye
   * selected `glintLeft` — a two-pixel highlight, shown as "Left eye glint" —
   * and a person who then pressed Delete would have removed a reflection
   * instead of an eye. A person pointing at an eye means the eye.
   *
   * Two kinds of face, one rule: the nearest thing up the tree that **has a
   * name**. On a library face that is the instance the fit placed; on the
   * template it is the element a semantic part calls `leftEye`. Whichever comes
   * first walking up, because both are the same question asked of two ways of
   * building a face.
   *
   * It stops at the first hit rather than climbing to the top, which is why
   * clicking an eye does not select the head: `faceRoot` is named too, and it
   * is further up.
   */
  function resolvePiece(id) {
    if (!id) return id;
    const named = namedPieces(), parents = model().parents || {}, instances = model().instances || {};
    const seen = new Set();
    for (let at = id; at && !seen.has(at); at = parents[at]) {
      seen.add(at);
      if (named.has(at)) return at;
      if (instances[at]) return instanceRootOf(model(), at);
    }
    return instanceRootOf(model(), id);
  }

  /** Whether `id` is drawn inside `root` — what a double-click descends into. */
  function containsPiece(root, id) {
    if (!root || !id || root === id) return false;
    const parents = model().parents || {}, detached = model().detached || {};
    if ((detached[root] || []).includes(id)) return true;
    const seen = new Set();
    for (let at = parents[id]; at && !seen.has(at); at = parents[at]) {
      seen.add(at);
      if (at === root) return true;
    }
    return false;
  }

  /** What a piece is called, for the trail that says where a click landed. */
  const pieceTrail = (id) => {
    const parents = model().parents || {}, named = namedPieces(), seen = new Set(), trail = [];
    for (let at = id; at && !seen.has(at); at = parents[at]) {
      seen.add(at);
      if (named.has(at) || at === id) trail.unshift({ id: at, label: nameOf(at) });
    }
    return trail;
  };

  /**
   * A canvas gesture, written the way the inspector's fields write (audit §2.2).
   *
   * The fields moved `instanceRootOf(...)` and mirrored a linked pair; the
   * gizmo moved `selectedId` and mirrored nothing. So an author ticked "edit
   * both eyes" (ticked by default), dragged the left eye, and only the left eye
   * moved — then typed a number and both moved. One path now, and the pair
   * follows a drag exactly as it follows a number.
   *
   * A pivot is a point in one drawing's own coordinates, so it is the only
   * channel that is never mirrored: the peer keeps its own.
   */
  function commitTransform(pieceId, transform = {}) {
    const id = instanceRootOf(model(), pieceId);
    if (!doc().elements?.[id] || locked(id)) return false;
    const patch = {};
    for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'pivotX', 'pivotY']) {
      if (Number.isFinite(Number(transform[key]))) patch[key] = Number(transform[key]);
    }
    if (!Object.keys(patch).length) return false;
    const peer = linkedPeer(pieceId);
    const { pivotX, pivotY, ...shared } = patch;
    return writeTransforms(peer ? [[id, patch], [peer, mirrorTransformPatch(shared)]] : [[id, patch]]);
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

  /**
   * A library part off the face -- an accessory, a beard -- as one undo step,
   * whichever way it was asked for: the inspector's Remove, or a press on the
   * card of the drawing that is on.
   *
   * What hangs inside the part comes off with it (docs/FACE_PART_LIBRARY.md,
   * "Hosted on a part"): a part whose drawing has gone is not a part, so the
   * badge on the hood goes with the hood, in the same step, and one undo puts
   * both back.
   */
  function takeOff(category, partId, label) {
    if (!facePartCommands?.remove || !category || !partId) return false;
    const result = facePartCommands.remove(partId);
    if (!result.ok) { onStatus(result.reason, 'error'); return false; }
    chosen = category.id;
    select([]);
    const guests = result.hosted?.length ? ', with what hung on it' : '';
    onStatus(`${label} is off${guests}. Undo puts it back.${result.warning ? ` (Preview: ${result.warning})` : ''}`);
    render();
    return true;
  }

  /**
   * Open the library on the row this piece lives in (`Replace` in the menu and
   * on the canvas bar).
   *
   * Replacing a part used to mean knowing which of eighteen rows it was in and
   * finding that row in the column: there was no path at all from the thing
   * selected to the drawings that could take its place. This is that path, and
   * it is the row's own — not the semantic category's, so pressing Replace on a
   * muzzle opens Muzzle rather than Accessories (MASC-08B).
   */
  function openReplace(id) {
    const row = model().owners?.[instanceRootOf(model(), id)] || model().owners?.[id];
    if (!row) { onStatus('This piece is not one of the face parts, so the library has nothing to swap it for.', 'warn'); return false; }
    chooseCategory(row);
    revealInspector();
    return true;
  }

  /**
   * What the piece in hand *is*, for the gestures that act on any piece
   * (`ui/piece-actions.js`).
   *
   * The builder is the only thing that can answer the question Delete turns
   * on: a shape may be one of a library part's drawings, in which case taking
   * it away means taking the **part** off the face — the artwork, its roles,
   * its movements and whatever hangs on it, in one step — or it may be a shape
   * somebody drew, in which case it is just artwork. Reading a face part off
   * the element id is what `findSemanticPartByRole` does and it is not enough:
   * a pupil inside a library pair of eyes belongs to the *gaze* part and its
   * drawing belongs to the eyes.
   *
   * @returns {{ id, label, partId, partLabel, library, locked, visible, roles, hosted }|null}
   */
  function describePiece(id) {
    const document = doc();
    if (!id || !document.elements?.[id]) return null;
    const parts = model();
    const root = instanceRootOf(parts, id);
    const byRole = findSemanticPartByRole(document, id);
    /*
     * The library part whose **drawing** this piece is inside.
     *
     * Not the part that names it in a role, and not the row it is listed
     * under: a pupil drawn inside a library pair of eyes is the *gaze* part's
     * by role and the *Pupils* row's by listing, and neither of those can be
     * taken off the face on its own — the gaze part has no artwork of its own
     * to remove, it names shapes that belong to the eyes.
     *
     * So this walks up from the piece to the nearest element some part calls
     * its `assetRoot`, which is the only thing `facePartCommands.remove` can
     * act on. Deleting a pupil therefore offers to take the eyes off, and
     * `deleteConfirmation` asks first because the eyes carry several
     * movements — rather than deleting the pupil's shape and leaving
     * `gaze.roles.leftPupil` pointing at nothing, which is the failure the
     * audit found in Artwork (02_PROBLEMES.md §4.2).
     */
    const rootOwner = Object.entries(document.semanticParts || {});
    let libraryRoot = null, partId = null;
    for (let walk = root, seen = new Set(); walk && !seen.has(walk); walk = parts.parents?.[walk]) {
      seen.add(walk);
      const found = rootOwner.find(([, candidate]) => candidate?.assetRoot === walk && candidate?.assetId);
      if (found) { libraryRoot = walk; partId = found[0]; break; }
    }
    const part = partId ? document.semanticParts[partId] : null;
    const rowId = parts.owners?.[libraryRoot || root] || parts.owners?.[id] || null;
    const row = rowId ? parts.categories.find((item) => item.id === rowId) : null;
    // How much of the rig stops working if this goes: every role, in every
    // part, that names this piece or anything drawn inside it. It is what
    // decides whether a delete is worth a question first
    // (`deleteConfirmation`) -- a pair of library eyes carries eight roles
    // across three parts, and taking it off is not the same kind of act as
    // taking off a pair of glasses.
    const anchor = libraryRoot || root;
    const inside = new Set([anchor, ...instanceNodes(parts, anchor)]);
    // `instanceNodes` names the root and what it paints behind the face; the
    // roles live on the shapes *inside* it, so the subtree is what counts.
    const collect = (items) => { for (const item of items || []) { if (inside.has(item.id)) gather(item); else collect(item.children); } };
    const gather = (item) => { inside.add(item.id); for (const child of item.children || []) gather(child); };
    collect(document.layers);
    let roles = 0;
    for (const candidate of Object.values(document.semanticParts || {})) {
      for (const element of Object.values(candidate.roles || {})) if (element === id || inside.has(element)) roles += 1;
    }
    return {
      id, label: nameOf(libraryRoot || root),
      partId, partLabel: part?.name || byRole?.name || null,
      // Two different questions: `row` is "the library lists drawings for this
      // slot", `library` is "this drawing is one of them".
      row: Boolean(row?.part),
      library: Boolean(partId),
      locked: locked(libraryRoot || root),
      visible: layerVisible(document.layers, libraryRoot || root) !== false,
      roles,
      // What hangs *on* this part: a badge on a hood, a lens in a frame
      // (docs/FACE_PART_LIBRARY.md, "Hosted on a part"). It comes off with it.
      hosted: partId ? Object.values(document.semanticParts || {}).filter((candidate) => candidate?.assetHost?.partId === partId).length : 0
    };
  }

  /**
   * Delete, as the simple surface means it.
   *
   * A library part comes **off the face**: `facePartCommands.remove` takes its
   * artwork, its roles and its movements together and leaves no dangling
   * reference — which is exactly what `canvas.delete` in Artwork does not do,
   * and why deleting an eye there ends with "role leftEye references missing
   * element eyeLeft" in Project check. Anything else is artwork, and the caller
   * deletes it; saying so rather than doing it keeps one delete path for the
   * canvas and one for the library.
   *
   * @returns {{ done: boolean, label: string, hosted: number, reason?: string }}
   */
  function removePiece(id) {
    const piece = describePiece(id);
    if (!piece) return { done: false, label: '', hosted: 0, reason: 'That piece is not on the mascot.' };
    if (piece.locked) return { done: false, label: piece.label, hosted: 0, reason: 'This piece is locked. Unlock it first.' };
    if (!piece.partId || !facePartCommands?.remove) return { done: false, label: piece.label, hosted: piece.hosted };
    const result = facePartCommands.remove(piece.partId);
    if (!result.ok) return { done: false, label: piece.label, hosted: piece.hosted, reason: result.reason };
    chosen = model().owners?.[id] || chosen;
    select([]);
    render();
    return { done: true, label: piece.label, hosted: result.hosted?.length || 0 };
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
      const plan = facePartCommands.library?.get?.(part.assetId) ? facePartCommands.plan(category.id, part.assetId, { targetPartId: part.id }) : { ok: false, reason: `There is no part called "${part.assetId}" in the library any more: nothing to put the drawing back from.` };
      if (!plan.ok) { onStatus(plan.reason, 'error'); return false; }
    }
    // The drawing restored may come back under another id: what is in hand afterwards is what came back.
    let rootId = id;
    history.beginTransaction?.();
    try {
      if (restoring) {
        // The drawing back, and for Reset all the place with it: a fresh
        // install puts the part where the library puts it on this head,
        // whatever the author had moved -- one command, so a refusal leaves
        // nothing half done. Restore drawing alone keeps the author's place.
        // The part in hand, by name: Reset on a muzzle must not reach the
        // whiskers beside it, which are the same category at the same mount.
        const result = facePartCommands.replace(category.id, part.assetId, { fresh: what === 'all', targetPartId: part.id });
        if (!result.ok) { onStatus(result.reason, 'error'); return false; }
        rootId = result.rootId || id;
        if (what === 'all') done.push('its place, turn and size');
        done.push('the library drawing');
      } else if (what === 'position' || what === 'all') {
        const peer = linkedPeer(pieceId);
        writeTransforms(peer ? [[id, placementOf(id)], [peer, placementOf(peer)]] : [[id, placementOf(id)]]);
        done.push('its place, turn and size');
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
   * Any piece in hand can be saved into the library. Since MASC-08C the form
   * names the **visual slot** -- *Muzzle*, *Beak*, *Accessories* -- and the
   * semantic category is derived from it, so an author who picked Muzzle is
   * never then asked to work out why they must also pick Accessory. It names
   * the kinds of face the drawing suits and the words to find it by as well,
   * and those are what close the round trip:
   *
   * ```text
   * Muzzle row → Save as a library part → slot 'muzzle' → the library → Muzzle row
   * ```
   *
   * A saved part is a style card like any other, marked as the author's, with
   * Forget beside it.
   */
  const SAVEABLE_SLOTS = FACE_SLOT_IDS.map((id) => faceSlot(id)).filter((slot) => slot.installable);

  /**
   * The kinds of face a drawing being saved is offered for, before the author
   * touches anything (MASC-08C §7).
   *
   * ```text
   * from a drawing the library knows   what that drawing says, `[]` included
   * a new drawing in a row a person                   the kind being browsed,
   *   has not got, browsed as a kind that has it        as a suggestion
   * anything else                                     universal
   * ```
   *
   * The middle line is a suggestion and nothing more: it is ticked, and an
   * author who disagrees unticks it before saving. The first line is the one
   * that matters most -- a drawing that said nothing about the kinds of face it
   * suits must not acquire a restriction by being edited, so `[]` comes back
   * as `[]` and `'*'` comes back as nothing ticked, which saves as `[]`.
   */
  function suggestedMorphologies(slotId, asset) {
    if (asset) return (asset.morphologies || []).filter((id) => faceMorphology(id));
    const active = activeMorphology();
    const person = new Set(faceMorphology('human')?.slots || []);
    return !person.has(slotId) && faceMorphology(active)?.slots.includes(slotId) ? [active] : [];
  }

  /** The form's model for this piece: what it can be saved as, with the draft so far. */
  function saveFormOf(document, id, row, part) {
    if (!facePartCommands?.saveAsPart) return null;
    const span = elementSpan(document.svgMarkup || '', id);
    if (!span) return null;
    const inside = artworkIds(document.svgMarkup.slice(span.start, span.end));
    // Only the slots whose semantic part this piece could actually fill: a lone
    // shape is not a pair of eyes, whatever anybody calls it. The library's own
    // required roles are the test, so there is no second validator here.
    const offered = SAVEABLE_SLOTS.filter((slot) => facePartCategory(slot.category).required.length <= inside.length);
    const list = offered.length ? offered : SAVEABLE_SLOTS;
    // The row the piece is already in, which for a drawing from the library is
    // that drawing's own slot and for anything else is its category (MASC-08B).
    const home = list.some((slot) => slot.id === row?.id) ? row.id : null;
    const chosen = list.find((slot) => slot.id === partDraft.slot)?.id || home || list[0].id;
    const slot = faceSlot(chosen);
    const target = facePartCategory(slot.category);
    const asset = part?.assetId && facePartCommands.library ? facePartCommands.library.get(part.assetId) : null;
    const suggested = suggestedMorphologies(chosen, asset);
    const ticked = new Set(partDraft.morphologies ?? suggested);
    // The roles the part it belongs to already names, when it is a part of that category; else the piece itself for the one role a lone shape plays.
    const named = part?.type === target.part ? part.roles || {} : {};
    const options = inside.map((elementId) => ({ id: elementId, label: nameOf(elementId) }));
    const roles = target.roles.map((role) => ({
      role, label: roleLabel(role), required: target.required.includes(role),
      value: inside.includes(named[role]) ? named[role] : (target.required.includes(role) && inside.length === 1 ? inside[0] : ''),
      options
    }));
    return {
      slots: list.map((item) => ({ id: item.id, label: item.label, category: item.category })),
      slot: chosen, category: target.id, categoryLabel: target.label,
      name: partDraft.name,
      morphologies: FACE_MORPHOLOGY_IDS.map((item) => ({ id: item, label: faceMorphology(item).label, on: ticked.has(item) })),
      tags: partDraft.tags ?? assetTags(asset).join(', '),
      roles, mountPoints: [...FACE_MOUNT_POINTS],
      // Where the drawing already mounts, and its category's default only when
      // nothing knows better (MASC-09 §5). A muzzle anchored at the nose that
      // came back anchored at the centre of the head would be a piece the
      // author has to re-place after every edit, and a fit is the one thing
      // they should never have to redo by hand.
      mountPoint: partDraft.mountPoint || (FACE_MOUNT_POINTS.includes(asset?.mountPoint) ? asset.mountPoint : target.mountPoint)
    };
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

  /**
   * The piece in hand into the library, as the form says.
   *
   * The slot is the truth and the category comes from it; `category` is still
   * read when nothing names a slot, for the calls written before MASC-08C.
   * Tags arrive as the author typed them -- `Cat, fox pointed` -- and a word
   * that is not a tag is refused by name rather than dropped.
   */
  function savePart(pieceId, { name, slot, category, roles = {}, mountPoint = null, morphologies = [], tags = '' } = {}) {
    if (!facePartCommands?.saveAsPart) return false;
    const result = facePartCommands.saveAsPart({
      rootId: pieceId, slot: slot || category, name, roles, mountPoint,
      morphologies: [...morphologies], tags: Array.isArray(tags) ? tags : parseFaceTags(tags)
    });
    if (!result.ok) { onStatus(result.reason, 'error'); return false; }
    partDraft = { slot: null, name: '', morphologies: null, tags: null, mountPoint: null };
    // Named for the row it will be found in, which is the whole point of asking
    // for a slot: a muzzle saved from Muzzle comes back under Muzzle.
    const where = faceSlot(result.asset.slot)?.label || facePartCategory(result.asset.category)?.label || result.asset.category;
    const kinds = result.asset.morphologies.length ? ` for ${result.asset.morphologies.map((id) => faceMorphology(id)?.label || id).join(' and ')} faces` : '';
    onStatus(`${result.asset.name} is in the library now, under ${where}${kinds}: a style card of yours, on this face and the next.`);
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
   * One drawing of a hand, open in the vector tools
   * (docs/HAND_STYLES.md, "A gesture is a file").
   *
   * The drawing's **group** is the scope, not the hand's: the rest of the
   * mascot goes out of the way, and so do the seven other drawings stacked in
   * the same place. Seven of the eight carry `opacity="0"`, so the one being
   * edited is revealed while it is the scope -- session chrome beside
   * `applyEditScope`, never the document.
   */
  function editHandDrawing(pieceId, style) {
    const hand = handOf(pieceId);
    const drawing = hand?.styles.find((item) => item.id === style && item.drawn);
    if (!drawing || !doc().elements?.[drawing.element]) return false;
    if (!editShape(drawing.element)) return false;
    onStatus(`Editing the ${drawing.name} drawing of the ${hand.label.toLowerCase()}: its palm, its fingers and its thumb are layers you can drag the points of.${drawing.resting ? '' : ' It is shown while you are inside it, and goes back behind the drawing the hand rests on when you leave.'}`);
    return true;
  }

  /**
   * The set's drawing back, where this one is.
   *
   * Only the layers are replaced: the hand does not move, the drawing it rests
   * on does not change, and one undo puts the author's edit back.
   */
  function restoreHandDrawing(pieceId, style) {
    const hand = handOf(pieceId);
    const drawing = hand?.styles.find((item) => item.id === style && item.drawn);
    if (!drawing) return false;
    if (!restoreHandDrawingCommand(store, history, hand.side, style, { measure: (id) => canvas.getElementBounds?.(id) })) {
      onStatus(`The set does not draw ${drawing.name} any more, so there is nothing to put back. The drawing on the hand stays as it is.`, 'warn');
      return false;
    }
    // Nothing to tell the canvas: the command writes the `artwork` domain, and
    // the render plan reconciles the drawing from the document for us.
    onStatus(`${drawing.name} is the set's drawing again on the ${hand.label.toLowerCase()}. Undo brings your edit back.`);
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
    navigate({ mode: 'design.artwork', target: { kind: 'artwork-element', id } });
    const scoped = canvas.setEditScope?.(id) === true;
    const back = scoped ? 'Back to Face, over the canvas, brings you back with it in hand.' : 'The Face tab brings you back.';
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
   *
   * For a category a face wears several of -- accessories, facial hair -- the
   * card is a toggle: press the card of something the face is wearing and it
   * comes off, press any other and it goes on, joining a free mount point or
   * replacing whatever is at the same one. Either way one press is one undo
   * step, because either way it is one command.
   */
  /** Star a drawing, or take the star off: it comes first in its row either way. */
  function favourite(assetId) {
    memory = toggleFavourite(memoryStore, assetId);
    render();
    return true;
  }

  function useStyle(assetId) {
    if (!facePartCommands) return false;
    const asset = facePartCommands.library.get(assetId);
    // An asset the library has not got is refused whichever row is open: a stale drag says so too.
    if (!asset) { onStatus(`Could not use ${assetId}: There is no asset called "${assetId}".`, 'error'); return false; }
    let { category: row } = current();
    // A card dropped on the mascot belongs to its own **visual row**, whichever
    // is open: the browser opens that one first, as a press on it would. The
    // row is the asset's slot, so a cat's muzzle opens Muzzle and not the
    // generic Accessories it is an accessory to the rig (MASC-08B).
    const home = assetSlot(asset);
    if (home && row?.id !== home && model().categories.some((item) => item.id === home)) { chooseCategory(home); row = current().category; }
    if (!row?.part) return false;
    // The part the card stands for, when the row is wearing it: the drawing
    // itself or the restyle of it a preset chose, and it is that part that
    // comes off rather than the id on the card.
    const on = row.multiple ? wornPart(row, asset) : null;
    if (on) return takeOff(row, on.partId, asset.name);
    // Where it lands in the row: what the row holds, or a part of its own. A
    // muzzle going on never reaches the glasses, and vice versa, even though
    // both are accessories mounted at the centre of the head (§10, §11).
    const result = facePartCommands.replace(row.categoryId, assetId, rowInstallTarget(row));
    if (!result.ok) { onStatus(`Could not use ${asset?.name || assetId}: ${result.reason}`, 'error'); return false; }
    chosen = row.id;
    // Used, so it comes back near the top of this row next time (audit §8.3).
    memory = rememberUse(memoryStore, assetId);
    // The new part is what is in hand now, every piece of it -- or, where a
    // face wears several, the one that just went on.
    const pieces = row.multiple ? [result.rootId] : model().categories.find((item) => item.id === row.id)?.pieces.map((piece) => piece.id) || [];
    select(pieces.length ? pieces : [result.rootId]);
    const kept = result.enabled.length ? ` ${result.enabled.join(', ')} still work` : '';
    const lost = result.disabled.length ? `; ${result.disabled.join(', ')} ${result.disabled.length === 1 ? 'has' : 'have'} nothing to move on it` : '';
    onStatus(`${asset.name} is the ${row.label.toLowerCase()} now.${kept}${lost}. Undo puts the old one back.${result.warning ? ` (Preview: ${result.warning})` : ''}`);
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

  const browser = createPartBrowser(browserHost, { view: browserView, onCategory: chooseCategory, onPiece: choosePiece, onPreset: usePreset, onType: chooseType, onFaceStyle: restyleFace, onStyle: useStyle, onToken: retint, onFacePreset: useFacePreset, onPresetReset: resetFacePreset, onPresetSave: saveFacePreset, onPresetForget: forgetFacePreset, onSearch: search, onShowAll: setShowAll, onFavourite: favourite, onRoute: route, onAdvanced: advanced, onHandStyle: useHandStyle, onStyleForget: forgetPart });
  /**
   * Browse another kind of face. Nothing on the mascot moves: what changes is
   * what Design offers, which is the whole point of the row (MASC-05).
   */
  function chooseType(id) {
    const type = availableMorphologies({ library: facePartCommands?.library }).find((item) => item.id === id);
    // A kind nobody has drawn for is refused here rather than only disabled in
    // the markup: a `<select>` can be set past a disabled option by script, and
    // the model is where that has to stop. `part-browser.js` puts the control
    // back from what this leaves true.
    if (!type?.available) return;
    morphology = id;
    render();
    onStatus(`Design is offering ${type.label.toLowerCase()} parts and presets now. Nothing on the mascot changed.`);
  }

  /**
   * Redraw the face in a style: one undo step, and a sentence about both halves.
   *
   * The parts nobody has drawn in this style stay exactly as they are, and the
   * notice says how many — an author told only what moved would read what
   * stayed as something lost (MASC-06).
   */
  function restyleFace(id) {
    if (!facePartCommands) return;
    const result = facePartCommands.applyStyle(id);
    if (!result.ok && !result.restyled) {
      styleNotice = '';
      onStatus(result.refused?.reason || `Nothing could be redrawn in ${id}.`, 'warn');
      render();
      return;
    }
    const label = faceStyle(id)?.label || id;
    styleNotice = `${label}: ${describeRestylePlan({ replace: Array.from({ length: result.restyled }), already: Array.from({ length: result.already }), kept: Array.from({ length: result.kept }) })}`;
    render();
    onStatus(`${styleNotice} Undo puts the face back as it was.`, result.ok ? 'info' : 'warn');
  }

  const inspector = createPartInspector(inspectorHost, { view: inspectorView, onAction: runPieceAction, onTransform: moveBy, onScale: resize, onSpacing: setSpacing, onLinked: setLinked, onPiece: choosePiece, onColour: recolour, onToken: retint, onEditShape: editShape, onRoute: route, onHandDepth: setHandDepth, onHandMirror: mirrorHandPlacement, onHandDrawingEdit: editHandDrawing, onHandDrawingRestore: restoreHandDrawing, onSaveDraft: saveDraft, onSavePart: savePart, onReset: resetPart });

  function render() {
    const drewBrowser = browser.render();
    const drewInspector = inspector.render();
    return drewBrowser || drewInspector;
  }

  return {
    render,
    favourite,
    resolvePiece,
    containsPiece,
    pieceTrail,
    commitTransform,
    openCategory: chooseCategory,
    openReplace,
    selectPiece: choosePiece,
    editShape,
    setHandDepth,
    mirrorHandPlacement,
    editHandDrawing,
    restoreHandDrawing,
    useHandStyle,
    savePart,
    forgetPart,
    resetPart,
    useStyle,
    setLinked,
    retint,
    /** What the piece in hand is, and Delete as the simple surface means it (ui/piece-actions.js). */
    describePiece,
    removePiece,
    useFacePreset,
    resetFacePreset,
    saveFacePreset,
    /** The builder as plain data, for the browser-test seam. */
    snapshot() {
      const { state, parts, active } = current();
      const palette = facePartCommands?.palette?.();
      return { ...characterSnapshot(parts, { active, selectedId: state.selectedId }), piece: inspectorView().piece?.id || null, palette: palette ? Object.fromEntries(palette.tokens.map((entry) => [entry.token, entry.colour])) : null, preset: facePartCommands?.presetOf?.()?.id || null, morphology: activeMorphology(), scope: canvas.getEditScope?.() ?? null, hands: describeHands(doc(), { pictures: false }).filter((hand) => hand.element).map((hand) => ({ side: hand.side, element: hand.element, resting: hand.resting, drawn: hand.styles.filter((style) => style.drawn).map((style) => style.id) })) };
    },
    counters: () => ({ browser: browser.counters(), inspector: inspector.counters() }),
    destroy() { browser.destroy(); inspector.destroy(); partsOf.clear(); for (const [type, handler] of dropListeners) dropHost.removeEventListener?.(type, handler); }
  };
}
