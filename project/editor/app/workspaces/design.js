/**
 * DESIGN — what does the mascot look like? (UIR-16, docs/UIR_REFACTOR_BASELINE.md)
 *
 * Two screens: the states each hand can show, and the artwork underneath --
 * the pieces a mascot is made of, which is where an author lands (V5-07). The
 * tools themselves are not here: the canvas is central to every screen (§5,
 * Règle A), so it stays in the editor and this workspace asks it for what it
 * needs.
 *
 * There were three. The Character Builder dressed a face out of the library,
 * and it went with the library's turn as the way to make a mascot.
 */
import { createFacePartCommands } from '../../core/face-library/face-part-commands.js';
import { createFaceLibraryPanel } from '../../rig-editor/semantic-parts/face-library-panel.js';
import { selectionSubject } from '../../core/selectors/selection-subject.js';
import { FACE_PART_LIBRARY } from '../../core/face-library/face-part-registry.js';
import { createHandStatesPanel } from '../../ui/hands/hand-states.js';
import { HAND_LOOKS, handElementId } from '../../core/hands/hand-style-art.js';
import { HAND_REVEAL_SECONDS, handShowParameterName } from '../../../runtime/hands.js';

/** How long a hand takes to come out from behind the head, in milliseconds. */
const HAND_REVEAL_MS = Math.round(HAND_REVEAL_SECONDS * 1000);
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { createHandStateCommands } from '../../core/hands/hand-state-commands.js';
import { handStateElementId } from '../../core/hands/hand-state-model.js';
import { addHandGesture, gestureFromFile, gestureIdFromName, handSetFromFile, handSetPack, installHandSet, loadCustomGestures, removeHandGesture } from '../../core/hands/hand-set-install.js';

/**
 * @param {object} deps
 * @param {() => void} deps.applyPreview     the runtime redraws once the artwork has moved
 * @param {(name: string, value: number|null) => void} deps.setLiveParam  session pose, never the document
 * @param {(side: string, style: string) => boolean} deps.drawHandStyle  app/hand-artwork.js
 * @param {(name: string, text: string) => void} deps.download
 * @param {(action: string, id: string) => void} deps.runPieceAction  app/editor-app.js
 */
const HAND_LOOK_LIST = Object.freeze(Object.values(HAND_LOOKS).map((look) => Object.freeze({ id: look.id, name: look.name })));

export function createDesignWorkspace({
  store, history, shell, canvas, editorContext, navigate, setStatus,
  revealInspector, setDesignTool, openColour, loadTemplate, applyPreview, setLiveParam = () => {}, drawHandStyle, download,
  // The pair, drawn where the hands are designed (audit §16, op. 11).
  drawHandPair,
  runPieceAction
}) {
  const facePartCommands = createFacePartCommands(store, history, canvas, { presetStorage: (() => { try { return globalThis.localStorage || null; } catch { return null; } })(), onInstalled: () => applyPreview() });
  /* ── Design ▸ Hands (UIR-05, docs/HAND_STYLES.md) ────────────────────────
   *
   * The states each hand can show, one library per hand, and the six things an
   * author does to one. The set they are drawn from is under Advanced on the
   * same screen: the drawings an author adds are kept in this browser under
   * `boop.handSets`, beside the face parts, and are read back at startup -- so
   * a drawing of their own survives a reload without a code change anywhere.
   */
  const handStorage = (() => { try { return globalThis.localStorage || null; } catch { return null; } })();
  loadCustomGestures(handStorage);
  const handStateCommands = createHandStateCommands(store, history, { measure: (id) => canvas.getElementBounds?.(id) });
  /** One of the six verbs, then redraw everything that shows a hand. */
  const afterHandState = (ok, message, tone) => {
    if (ok) applyPreview();
    handStates.say(ok ? 'ok' : 'error', message);
    return ok;
  };
  const handStates = createHandStatesPanel(shell.handStatesEl, {
    document: () => store.getDocument(),
    // Picking a state of the other hand turns the canvas to that hand.
    onSelect: (state) => { if (state && handsFramed) frameHand(); },
    // Drawing a pair used to be three actions: a route to Rig ▸ Controls and a
    // second button there. What a hand looks like is Design's question; where it
    // sits is Rig's, and that route stays below (audit §16, op. 11).
    onDrawPair: drawHandPair ? (look) => afterHandState(drawHandPair(look),
      'Two hands drawn and rigged, with a state for every drawing in the set. Pick one, or set where they sit in Rig › Controls.') : null,
    looks: () => HAND_LOOK_LIST,
    // Where a hand is *drawn from* is here; where it *is* is Rig ▸ Controls (§16).
    onRoute: () => navigate({ mode: 'rig.controls', focus: 'hand-setup' }),
    onUse: (side, id) => afterHandState(createHandCommands(store, history).setStyles(side, { showing: id }),
      `The ${side} hand rests on ${id} now.`),
    onEdit: (side, id) => {
      const element = handStateElementId(side, id);
      if (!store.getDocument().elements?.[element]) return afterHandState(false, 'That drawing is not on the hand, so there is nothing to open.');
      navigate({ mode: 'design.artwork', target: { kind: 'artwork-element', id: element } });
      canvas.setEditScope?.(element);
      setDesignTool('node');
      setStatus(`Editing one drawing of the ${side} hand: its palm, its fingers and its thumb are layers you can drag the points of. Hands brings you back.`);
      return true;
    },
    onDuplicate: (side, id) => afterHandState(handStateCommands.duplicate(side, id),
      `A copy of ${id} is on the ${side} hand, its own drawing from now on.`),
    onMirror: (side, id) => afterHandState(handStateCommands.mirror(side, id),
      `The other hand has a mirrored copy of ${id}. Nothing links the two: reshaping one leaves the other alone.`),
    onRename: (side, id, name) => afterHandState(handStateCommands.rename(side, id, name),
      `Renamed on the ${side} hand. The set still calls its own drawing what it called it.`),
    onDelete: (side, id) => afterHandState(handStateCommands.remove(side, id),
      `${id} is off the ${side} hand, drawing and all. Undo puts it back.`),
    onAdd: (side, id) => afterHandState(drawHandStyle(side, id), `The ${side} hand has a ${id} now.`),
    onAddGestures: async (files) => {
      const added = [], refused = [];
      for (const file of files) {
        let text = '';
        try { text = await file.text(); } catch { refused.push(`${file.name}: it could not be read.`); continue; }
        const gesture = gestureFromFile(text, { id: gestureIdFromName(file.name) });
        if (!gesture) { refused.push(`${file.name}: it draws no gesture — a gesture is one <g> of named layers.`); continue; }
        const result = addHandGesture(gesture, { storage: handStorage });
        if (result.ok) added.push(result.gesture.label); else refused.push(`${file.name}: ${result.reason}`);
      }
      handStates.say(refused.length && !added.length ? 'error' : refused.length ? 'warn' : 'ok',
        [added.length ? `${added.join(', ')} ${added.length === 1 ? 'is' : 'are'} in the set now, kept in this browser. Put ${added.length === 1 ? 'it' : 'one'} on a hand from the row above.` : '',
          ...refused].filter(Boolean).join(' '));
    },
    onImportSet: async (file) => {
      let text = '';
      try { text = await file.text(); } catch { handStates.say('error', `${file.name} could not be read.`); return; }
      const set = handSetFromFile(text);
      if (!set) { handStates.say('error', `Not a hand set: ${file.name} is not JSON.`); return; }
      const result = installHandSet(set, { storage: handStorage });
      if (!result.ok) { handStates.say('error', `Hand set refused: ${result.reason}`); return; }
      handStates.say('ok', `"${result.set.name}" is the set now: ${result.set.gestures.length} gesture${result.set.gestures.length === 1 ? '' : 's'}. Hands already wearing drawings keep them; the next one you draw comes from here.`);
    },
    onForget: (id) => {
      const result = removeHandGesture(id, { storage: handStorage });
      handStates.say(result.ok ? 'ok' : 'error', result.ok
        ? `${result.gesture.label} is forgotten. A hand wearing it keeps its drawing.`
        : result.reason);
    },
    onExportSet: () => {
      const pack = handSetPack();
      download(`${pack.set || 'hands'}.handset.json`, JSON.stringify(pack, null, 2));
      handStates.say('ok', `${pack.gestures.length} gesture${pack.gestures.length === 1 ? '' : 's'} saved out as ${pack.set}.handset.json. Import it anywhere to draw hands from it.`);
    }
  });

  /**
   * The face parts library (docs/FACE_PART_LIBRARY.md).
   *
   * In Artwork, beside *Add a part*, because choosing a different pair of eyes
   * is making artwork. The commands were already here and had no caller: a
   * hundred and fifty drawings ship with the editor and nothing could put one
   * on a face (`core/face-library/face-library-model.js`).
   */
  const faceLibrary = createFaceLibraryPanel(shell.faceLibraryEl, store, {
    commands: facePartCommands,
    onStatus: setStatus,
    // Selected, because the piece that just arrived is the one the Inspector's
    // two questions are about.
    onSelect: (id) => { if (id) editorContext.update({ selectedId: id }); },
    // Pointing at a card frames where that drawing lands on *this* head, which
    // is the one thing the picture on the card cannot say (docs/FACE_GUIDES.md).
    // The asset rather than its id: the canvas wants a reference box and a
    // mount point, and the library is where those are looked up.
    onPreview: (id) => canvas.previewFacePart?.(id ? FACE_PART_LIBRARY.get(id) : null),
    // Which part of the face the author has in hand, so the cards are that
    // part's (UX-50 PR 7). The one derivation every contextual panel reads:
    // the library does not get its own idea of what is selected.
    subject: () => selectionSubject(store.getDocument(), store.getSession())?.category || null
  });

  /**
   * The canvas on Design ▸ Hands shows the hand being designed (UIR-15).
   *
   * It used to show the face, at 58% of the window, with the hands **behind
   * its head** — where they rest until something asks for them
   * (docs/HAND_RIGGING.md). So the screen for designing a hand spent most of
   * the window on a drawing of the thing it is not about, and on none of the
   * thing it is.
   *
   * Two session-only acts, both of them things an author can already do by
   * hand: bring the hands out, and frame one. Nothing is authored — the show
   * parameters are a live pose, like a puppet handle or the head-pose pad
   * (docs/STILL_WHILE_DESIGNING.md, *What does not stop*), and the view is not
   * part of a project at all.
   */
  let handsFramed = false, settling = null;
  function frameHand() {
    const state = store.getDocument();
    if (!state?.svgMarkup || !state.hands) return false;
    // Out from behind the head, both of them: the pair is drawn as a pair and
    // an author comparing the two wants to see the two.
    for (const side of ['left', 'right']) setLiveParam(handShowParameterName(side), 1);
    applyPreview();
    // The one in hand, or the left, which is the one the panel opens on. A
    // single hand rather than the pair, because the gap between two hands is
    // the width of a body, and framing that is where this screen started.
    const id = handElementId(handStates.selected()?.side || 'left');
    handsFramed = Boolean(canvas.frameElements?.([id], 0.22));
    /**
     * And again once it has arrived.
     *
     * A hand does not appear at its rest place, it travels there over
     * `HAND_REVEAL_SECONDS` so that it reads as coming out from behind the
     * head (docs/HAND_RIGGING.md). Framing the first frame of that framed a
     * hand still behind the head and left the view pointing under the chin —
     * the hand then walked out of shot. So the view is taken again when the
     * travel is over, and once more a beat later in case the loop was slow.
     *
     * Both stand down if the view is no longer the one they set. An author who
     * arrives and immediately presses *Fit*, *Selection* or the wheel has said
     * where they want to look, and a re-frame arriving half a second later to
     * undo that is worse than never framing at all.
     */
    clearTimeout(settling);
    const again = (delay) => setTimeout(() => {
      // The canvas says whether the view is still the framing it was given.
      // A *Fit*, a wheel or a zoom-to-selection in the meantime drops it, and
      // this stands down rather than pulling the author back.
      if (handsFramed && canvas.isFraming?.([id])) canvas.frameElements?.([id], 0.22);
    }, delay);
    settling = again(HAND_REVEAL_MS + 60);
    again(HAND_REVEAL_MS + 260);
    return handsFramed;
  }
  /** Leaving puts the hands back where the project says they rest. */
  function unframeHand() {
    clearTimeout(settling);
    if (!handsFramed) return;
    handsFramed = false;
    for (const side of ['left', 'right']) setLiveParam(handShowParameterName(side), null);
    applyPreview();
    canvas.fitToCanvas?.();
  }

  return {
    id: 'design',
    surfaces: ['hands', 'create'],
    panels: { handStates, faceLibrary, facePartCommands },
    targets: { handStates: () => handStates.render(), faceLibrary: () => faceLibrary.render() },
    enter(surface) { if (surface === 'hands') frameHand(); else unframeHand(); },
    leave() { unframeHand(); },
    render() { handStates.render(); faceLibrary.render(); },
    /** Re-frame after a press that changed which hand is in hand. */
    frameHand,
    destroy() { handStates.destroy?.(); }
  };
}
