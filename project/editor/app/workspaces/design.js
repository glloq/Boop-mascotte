/**
 * DESIGN — what does the mascot look like? (UIR-16, docs/UIR_REFACTOR_BASELINE.md)
 *
 * Three screens: the face an author dresses, the states each hand can show, and
 * the vector tools underneath both. The tools themselves are not here: the
 * canvas is central to every screen (§5, Règle A), so it stays in the editor
 * and this workspace asks it for what it needs.
 */
import { createCharacterBuilder } from '../../ui/character-builder/character-builder.js';
import { createFacePartCommands } from '../../core/face-library/face-part-commands.js';
import { createHandStatesPanel } from '../../ui/hands/hand-states.js';
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { createHandStateCommands } from '../../core/hands/hand-state-commands.js';
import { handStateElementId } from '../../core/hands/hand-state-model.js';
import { addHandGesture, gestureFromFile, gestureIdFromName, handSetFromFile, handSetPack, installHandSet, loadCustomGestures, removeHandGesture } from '../../core/hands/hand-set-install.js';

/**
 * @param {object} deps
 * @param {() => void} deps.applyPreview     the runtime redraws once the artwork has moved
 * @param {(side: string, style: string) => boolean} deps.drawHandStyle  app/hand-artwork.js
 * @param {(name: string, text: string) => void} deps.download
 */
export function createDesignWorkspace({
  store, history, shell, canvas, editorContext, navigate, setStatus,
  revealInspector, setDesignTool, openColour, loadTemplate, applyPreview, drawHandStyle, download
}) {
  const facePartCommands = createFacePartCommands(store, history, canvas, { presetStorage: (() => { try { return globalThis.localStorage || null; } catch { return null; } })(), onInstalled: () => applyPreview() });
  const characterBuilder = createCharacterBuilder({
    browserHost: shell.partBrowserEl, inspectorHost: shell.partInspectorEl, store, history, canvas, dropHost: shell.canvasEl, isActive: () => shell.getWorkspace() === 'character',
    navigate,
    drawHandStyle,
    revealInspector,
    setDesignTool,
    openColour,
    loadTemplate,
    facePartCommands,
    onStatus: setStatus
  });
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
    if (ok) { applyPreview(); characterBuilder.render(); }
    handStates.say(ok ? 'ok' : 'error', message);
    return ok;
  };
  const handStates = createHandStatesPanel(shell.handStatesEl, {
    document: () => store.getDocument(),
    // Where a hand is *drawn from* is here; where it *is* is Rig ▸ Controls (§16).
    onRoute: (name) => navigate(name === 'character' ? { mode: 'design.face' } : { mode: 'rig.controls', focus: 'hand-setup' }),
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
      // Every card everywhere reads the same library, so one render each.
      characterBuilder.render();
      handStates.say(refused.length && !added.length ? 'error' : refused.length ? 'warn' : 'ok',
        [added.length ? `${added.join(', ')} ${added.length === 1 ? 'is' : 'are'} in the set now, kept in this browser. Put ${added.length === 1 ? 'it' : 'one'} on a hand from the Character Builder.` : '',
          ...refused].filter(Boolean).join(' '));
    },
    onImportSet: async (file) => {
      let text = '';
      try { text = await file.text(); } catch { handStates.say('error', `${file.name} could not be read.`); return; }
      const set = handSetFromFile(text);
      if (!set) { handStates.say('error', `Not a hand set: ${file.name} is not JSON.`); return; }
      const result = installHandSet(set, { storage: handStorage });
      if (!result.ok) { handStates.say('error', `Hand set refused: ${result.reason}`); return; }
      characterBuilder.render();
      handStates.say('ok', `"${result.set.name}" is the set now: ${result.set.gestures.length} gesture${result.set.gestures.length === 1 ? '' : 's'}. Hands already wearing drawings keep them; the next one you draw comes from here.`);
    },
    onForget: (id) => {
      const result = removeHandGesture(id, { storage: handStorage });
      characterBuilder.render();
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

  return {
    id: 'design',
    surfaces: ['character', 'hands', 'create'],
    panels: { characterBuilder, handStates, facePartCommands },
    targets: {
      characterBuilder: () => characterBuilder.render(),
      handStates: () => handStates.render()
    },
    enter() {},
    leave() {},
    render() { characterBuilder.render(); handStates.render(); },
    destroy() { characterBuilder.destroy?.(); handStates.destroy?.(); }
  };
}
