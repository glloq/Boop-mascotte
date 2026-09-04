// Controls in the canvas keep their own click: a Preview click means "the user
// touched the mascot", and a toolbar button is not the mascot.
const CANVAS_CONTROLS = 'button,input,select,label,.canvas-toolbar,.design-toolbar';

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

  // A reset leaves the controller asleep, so a live preview has to be started
  // again and an idle one must stay idle. `announce` is false for the command
  // palette, which has never reported the reset because it navigates to Preview
  // instead; the difference stays deliberate rather than accidental.
  const reset = ({ announce = true } = {}) => {
    preview.reset();
    if (live) preview.start();
    renderPanel();
    if (announce) setStatus('Mascot reset. Live controls and preview-only changes were cleared.');
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

  return { isLive: () => live, setLive, reset, stop, activateState, bindCanvas, triggerClick, triggerHover };
}
