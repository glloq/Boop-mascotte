/**
 * The lifecycle every panel gets (VNX-03).
 *
 * A panel is currently whatever its factory chose to return: most expose
 * `render()`, two studios also expose `enter()` / `leave()`, and none can be
 * taken down. Two costs follow, and both are paid on every keystroke:
 *
 * 1. **Every panel renders on every notification.** One subscription in
 *    `main.js` calls `render()` on all of them, so editing a hand rebuilds the
 *    reactions list, the expression list and the timeline as well — including
 *    the four workspaces nobody is looking at.
 * 2. **A panel's listeners live as long as the page.** Nothing removes them,
 *    so nothing can close a workspace; the editor can only hide it.
 *
 * This is the contract that replaces the ad-hoc objects:
 *
 * - `mount(model)`  attach: register listeners, render once
 * - `update(model)` render again, but only if the model actually changed
 * - `hide()`        stop rendering; models keep arriving, DOM work does not
 * - `show()`        render the model that arrived while hidden, if any
 * - `destroy()`     remove every listener, disconnect every observer, empty the host
 *
 * `hide()` is the cheap half and the reason the contract exists: an update
 * while hidden is remembered and rendered once on the next `show()`, instead of
 * being paid on every store notification. `destroy()` is the strong half, for
 * the heavy workspaces (VNX-56): afterwards the component holds nothing at all,
 * and mounting it again throws rather than half-working.
 *
 * The component owns *work*, not layout. The only DOM it touches is
 * `host.hidden`, so a hidden panel cannot leave a stale render on screen, and
 * `host.innerHTML` on destroy. Anything else is the caller's `render`.
 *
 * Nothing here knows about the store, the document or a workspace: a component
 * is given a model and hands it to `render`. Where the model comes from is
 * VNX-04's problem, and when it is recomputed is VNX-05's.
 */
// The default comparison, and deliberately the selector layer's own rather
// than a second copy: a ViewModel is a flat bag of already-derived values, so
// deep equality would cost more than the render it saves, and identity alone
// would never skip anything, since a selector rebuilds its object when it runs.
// Re-exported so a panel need not know where the comparison lives.
import { shallowEqual } from '../core/selectors/create-selector.js';
export { shallowEqual };

/**
 * @param {object} options
 * @param {object} options.host        the element the component renders into
 * @param {(model, context) => void} [options.render]
 * @param {(context) => void} [options.onMount]    once, before the first render
 * @param {(context) => void} [options.onShow]     each time it becomes visible again
 * @param {(context) => void} [options.onHide]     each time it stops rendering
 * @param {(context) => void} [options.onDestroy]  before the listeners go
 * @param {(a, b) => boolean} [options.equal]      when a model counts as unchanged
 * @returns {{mount, update, show, hide, destroy, listen, observe, isMounted, isVisible, counters}}
 */
export function createComponent({ host, render = () => {}, onMount, onShow, onHide, onDestroy, equal = shallowEqual } = {}) {
  if (!host) throw new Error('createComponent needs a host element.');

  const stops = [];               // one undo per listener and per observer, in registration order
  let phase = 'idle';             // idle → mounted → destroyed, never backwards
  let visible = true;             // hide() before mount() mounts a component that renders nothing
  let pending = false;            // a model arrived while hidden and still owes a render
  let model;
  let renders = 0, skipped = 0;

  const destroyed = () => phase === 'destroyed';
  const call = (hook) => { if (typeof hook === 'function') hook(context); };
  const syncHidden = () => { host.hidden = !visible; };

  function draw() {
    pending = false;
    renders += 1;
    render(model, context);
  }

  /**
   * Register a listener the component will remove for you.
   *
   * After `destroy()` it attaches nothing and returns a no-op: a late callback
   * — a resolved promise, a queued frame — must not put listeners back on a
   * component that is gone.
   *
   * @returns {() => void} remove this one listener early
   */
  function listen(target, type, handler, options) {
    if (destroyed() || typeof target?.addEventListener !== 'function') return () => {};
    target.addEventListener(type, handler, options);
    const stop = () => target.removeEventListener?.(type, handler, options);
    stops.push(stop);
    return () => {
      const at = stops.indexOf(stop);
      if (at === -1) return;      // already removed, by destroy() or by an earlier call
      stops.splice(at, 1);
      stop();
    };
  }

  /**
   * The escape hatch for anything with `disconnect()`: MutationObserver,
   * ResizeObserver, IntersectionObserver, or your own object that looks like
   * one. It is returned as it came in, so it can be built and connected in one
   * expression, and it is disconnected on `destroy()`.
   */
  function observe(observer) {
    if (typeof observer?.disconnect !== 'function') return observer;
    if (destroyed()) { observer.disconnect(); return observer; }
    stops.push(() => observer.disconnect());
    return observer;
  }

  const context = { host, listen, observe };

  /** Idempotent: one `onMount`, one set of listeners, whatever the caller does. */
  function mount(initial) {
    if (destroyed()) throw new Error('This component was destroyed: create a new one instead of mounting it again.');
    if (phase === 'mounted') return false;
    phase = 'mounted';
    model = initial;
    syncHidden();
    call(onMount);
    if (visible) draw(); else pending = true;
    return true;
  }

  /**
   * Hand over the next model. Renders only if it differs from the last one, and
   * only if anyone can see it.
   *
   * `force` is for the render that does not come from the model — a live
   * preview value, a measurement — and still defers while hidden.
   */
  function update(next, { force = false } = {}) {
    if (phase !== 'mounted') { skipped += 1; return false; }
    if (!force && equal(model, next)) { skipped += 1; return false; }
    model = next;
    if (!visible) { pending = true; skipped += 1; return false; }
    draw();
    return true;
  }

  function show() {
    if (destroyed() || visible) return false;
    visible = true;
    syncHidden();
    if (phase === 'mounted') {
      call(onShow);
      if (pending) draw();       // the one render the hidden panel owed
    }
    return true;
  }

  function hide() {
    if (destroyed() || !visible) return false;
    visible = false;
    syncHidden();
    if (phase === 'mounted') call(onHide);
    return true;
  }

  /**
   * Idempotent. `onDestroy` runs first, while the DOM and the listeners are
   * still there, and only if the component was ever mounted — it is the pair of
   * `onMount`, not a general cleanup hook. The cleanup itself happens either
   * way.
   */
  function destroy() {
    if (destroyed()) return false;
    if (phase === 'mounted') call(onDestroy);
    phase = 'destroyed';
    for (const stop of stops.splice(0)) stop();
    pending = false;
    model = undefined;
    host.innerHTML = '';
    return true;
  }

  return {
    mount, update, show, hide, destroy, listen, observe,
    isMounted: () => phase === 'mounted',
    isVisible: () => visible && !destroyed(),
    /** Plain numbers, always on: a test proves a hidden panel skipped the work. */
    counters: () => ({ renders, skipped })
  };
}
