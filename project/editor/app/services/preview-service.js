// Controls in the canvas keep their own click: a Preview click means "the user
// touched the mascot", and a toolbar button is not the mascot.
const CANVAS_CONTROLS = 'button,input,select,label,.canvas-toolbar,.design-toolbar';

/**
 * Where the mascot is *designed* rather than watched, and therefore holds still
 * (docs/STILL_WHILE_DESIGNING.md).
 *
 * The Character Builder places the parts of the face and Artwork draws them,
 * and both are done by clicking the mascot itself: a face that blinks, glances
 * away and drifts its head under the pointer is a moving target, and nobody can
 * judge where an eye sits while the eye is moving. Every other task either
 * watches the mascot (Preview) or edits what it does (Face Setup, Expressions,
 * Motions, Reactions), where the movement is the work rather than in the way.
 *
 * These are workspace names because a workspace is what the shell dispatches;
 * the task router maps the `artwork` task onto the legacy `create` workspace
 * (docs/UX02_TASK_ROUTER_SELECTION_INSPECTOR.md) and `character` onto its own.
 */
const STILL_WORKSPACES = new Set(['character', 'create']);

// The DOM half of `bindCanvas`, shaped like the component contract's `listen`
// (VNX-03) so the gestures can move into a workspace lifecycle unchanged.
const addListener = (target, type, handler) => {
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
};

/**
 * Owns *preview mode in the editor*: whether it is on, what turning it on and
 * off does to the shell, and the two canvas gestures that only mean something
 * while it is on.
 *
 * The runtime itself stays in `core/preview-runtime/preview-controller.js`.
 * This service never computes a frame; it decides when that controller runs,
 * which of `setState` / `previewState` an author's state switch reaches, and
 * who is told afterwards.
 *
 * Every collaborator is injected — the controller, the store, the workspace
 * reader and the three shell callbacks — so preview mode runs in Node. The
 * only DOM left is the `preview-mode` class and the listener registration, and
 * both are defaults the caller can replace.
 */
export function createPreviewService({
  preview, store,
  getWorkspace = () => null,
  revealInspector = () => {}, renderPanel = () => {}, setStatus = () => {},
  // Read through `globalThis` rather than the bare global: outside a browser
  // the default is then inert instead of a ReferenceError.
  setPreviewClass = (on) => globalThis.document?.getElementById('app')?.classList.toggle('preview-mode', on)
} = {}) {
  // Preview mode cannot be derived from `preview.isRunning()`: the controller
  // also runs while authoring — a motion playing in Animate, a transition
  // settling — so the editor's own flag is the only answer to "is the mascot
  // live?".
  let live = false;

  // The controller returns the reaction it started, or nothing when no reaction
  // listened for the event or another one still holds the mascot. Only a real
  // firing is worth a redraw.
  const fire = (event) => {
    const fired = Boolean(preview.triggerReaction(event));
    if (fired) renderPanel();
    return fired;
  };

  // Order is preserved from the shell binding: the inspector is revealed before
  // the class flips, so the panel being revealed is the one preview renders
  // into. Turning preview off says nothing — the control that did it is the
  // message — which is why only the live branch reports.
  const setLive = (enabled) => {
    if (enabled) revealInspector();
    live = Boolean(enabled);
    setPreviewClass(live);
    live ? preview.start() : preview.stop();
    if (live) { renderPanel(); setStatus('Preview is live. Changes here are non-destructive.'); }
    return live;
  };

  /**
   * The mascot holds still, or moves again, according to where the author now
   * is. Session-only at both ends: this reads a workspace and sets a flag on
   * the preview controller, and neither is part of the project.
   *
   * Idempotent, so the shell may call it on every workspace change and on
   * start-up, where no change event is dispatched at all.
   *
   * @param {string} [workspace] the workspace just opened; the current one by default.
   * @returns {boolean} whether the mascot is now held still.
   */
  const holdStill = (workspace = getWorkspace()) => {
    const held = STILL_WORKSPACES.has(workspace);
    preview.setHeldStill(held);
    return held;
  };

  // A reset leaves the controller asleep, so a live preview has to be started
  // again and an idle one must stay idle. `announce` is false for the command
  // palette, which reports through the palette itself; the difference stays
  // deliberate rather than accidental.
  //
  // What it resets is the whole of the session layer over the document -- the
  // live pose, the preview-only behaviour switches, the previewed state and
  // expressions, every transport, the reactions in flight -- and nothing else.
  // It writes no command, opens no history transaction and moves no revision,
  // which is why a control in the project bar can do it without asking: there
  // is no authored work for it to throw away. Holding still survives it, since
  // that says where the author is and not what the mascot is doing.
  const reset = ({ announce = true } = {}) => {
    preview.reset();
    if (live) preview.start();
    renderPanel();
    if (announce) setStatus('Mascot reset: the live pose, the playback and every preview-only change. Nothing in your project changed.');
  };

  // The teardown half of a project replacement: preview mode cannot outlive the
  // document it was previewing. Silent, renders nothing, and is not undone by a
  // rollback — whichever document ends up loaded, preview mode starts off.
  const stop = () => { preview.stop(); preview.reset(); live = false; setPreviewClass(false); };

  // Live preview obeys the state machine — `setState` refuses a transition the
  // project does not allow — while authoring only shows the state.
  const activateState = (name) => (live ? preview.setState(name) : preview.previewState(name));

  // Both gestures are guarded on the *workspace*, not on the flag: the canvas
  // stops being an editing surface as soon as Preview is open, whether or not
  // the runtime was started.
  const triggerClick = (event) => {
    if (getWorkspace() !== 'preview' || event?.target?.closest?.(CANVAS_CONTROLS)) return false;
    return fire({ type: 'click' });
  };

  // A pointer entering the canvas is not an intent the way a click is, so it is
  // only forwarded when an enabled reaction actually listens for hover.
  const triggerHover = () => {
    if (getWorkspace() !== 'preview') return false;
    const state = store.getDocument();
    if (!(state.reactions || []).some(item => item.enabled !== false && item.trigger?.type === 'hover')) return false;
    return fire({ type: 'hover' });
  };

  /**
   * Registers both gestures on the canvas and returns one unbinder for the
   * pair, so this can eventually be a workspace's `mount` / `destroy`
   * (docs/VNEXT_COMPONENTS.md) instead of two listeners that live as long as
   * the page.
   */
  const bindCanvas = (element, { listen = addListener } = {}) => {
    const stops = [listen(element, 'click', triggerClick), listen(element, 'pointerenter', triggerHover)];
    return () => { for (const stop of stops) stop?.(); };
  };

  return { isLive: () => live, setLive, holdStill, reset, stop, activateState, bindCanvas, triggerClick, triggerHover };
}
