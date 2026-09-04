import test from 'node:test';
import assert from 'node:assert/strict';
import { createComponent, shallowEqual } from '../../ui/component.js';

/**
 * The panels run in a browser; the contract does not. A host is an object with
 * `innerHTML`, `hidden` and the two listener methods, which is everything
 * `createComponent` touches — a real DOM here would only make the test slower
 * and the coupling invisible.
 */
function fakeHost() {
  const listeners = new Map();
  return {
    innerHTML: 'left over from the last render',
    hidden: false,
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatch(type, event = {}) { for (const handler of [...(listeners.get(type) || [])]) handler({ type, ...event }); },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0)
  };
}

const fakeObserver = () => ({ connected: true, disconnect() { this.connected = false; } });

test('mount attaches once however many times it is called', () => {
  const host = fakeHost();
  const seen = [];
  const panel = createComponent({
    host,
    render: (model) => seen.push(model),
    onMount: ({ listen }) => { seen.push('mounted'); listen(host, 'click', () => {}); }
  });
  assert.equal(panel.isMounted(), false);
  assert.equal(panel.mount({ id: 'a' }), true);
  assert.equal(panel.mount({ id: 'b' }), false, 'the second mount is refused, not replayed');
  assert.equal(panel.mount(), false);
  assert.deepEqual(seen, ['mounted', { id: 'a' }], 'one onMount, one render, and the first model wins');
  assert.equal(host.listenerCount(), 1, 'listeners were registered once');
  assert.deepEqual(panel.counters(), { renders: 1, skipped: 0 });
  assert.equal(panel.isMounted(), true);
  assert.equal(panel.isVisible(), true);
});

test('mounting a destroyed component throws instead of half-working', () => {
  const panel = createComponent({ host: fakeHost() });
  panel.mount();
  panel.destroy();
  assert.throws(() => panel.mount(), /destroyed: create a new one/);
  assert.equal(panel.isMounted(), false);
  const never = createComponent({ host: fakeHost() });
  never.destroy();
  assert.throws(() => never.mount(), /destroyed: create a new one/, 'even one that was never mounted');
});

test('update renders only when the model changed', () => {
  const host = fakeHost();
  const drawn = [];
  const panel = createComponent({ host, render: (model) => drawn.push(model.name) });
  panel.mount({ name: 'left hand', open: false });
  assert.equal(panel.update({ name: 'left hand', open: false }), false, 'a new object with the same values is the same model');
  assert.equal(panel.update({ name: 'left hand', open: true }), true);
  assert.equal(panel.update({ name: 'right hand', open: true }), true);
  assert.equal(panel.update({ name: 'right hand', open: true }), false);
  assert.deepEqual(drawn, ['left hand', 'left hand', 'right hand']);
  assert.deepEqual(panel.counters(), { renders: 3, skipped: 2 });
  assert.equal(panel.update({ name: 'right hand', open: true }, { force: true }), true, 'force renders an unchanged model');
  assert.equal(panel.counters().renders, 4);
});

test('a component decides for itself what counts as unchanged', () => {
  const drawn = [];
  const panel = createComponent({
    host: fakeHost(),
    equal: (a, b) => a?.id === b?.id,
    render: (model) => drawn.push(model.id)
  });
  panel.mount({ id: 'idle', frame: 0 });
  panel.update({ id: 'idle', frame: 42 });
  panel.update({ id: 'wave', frame: 42 });
  assert.deepEqual(drawn, ['idle', 'wave'], 'the frame is not part of what this panel shows');
  assert.deepEqual(shallowEqual({ id: 'idle', frame: 0 }, { id: 'idle', frame: 42 }), false, 'the default would have rendered');
  assert.equal(shallowEqual([1, 2], [1, 2]), true);
  assert.equal(shallowEqual([1, 2], [1, 2, 3]), false);
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: undefined }), false, 'a key nobody set is still a key');
  assert.equal(shallowEqual({ name: undefined }, { id: undefined }), false, 'two empty values under different names are two models');
  assert.equal(shallowEqual(null, null), true);
  assert.equal(shallowEqual(null, {}), false);
});

test('update does nothing before mount and nothing after destroy', () => {
  const host = fakeHost();
  const drawn = [];
  const panel = createComponent({ host, render: (model) => drawn.push(model) });
  assert.equal(panel.update({ id: 'early' }), false);
  assert.equal(panel.update({ id: 'early too' }), false);
  assert.deepEqual(drawn, [], 'nothing renders into a host the component has not mounted');
  panel.mount({ id: 'first' });
  panel.destroy();
  assert.equal(panel.update({ id: 'late' }), false);
  assert.deepEqual(drawn, [{ id: 'first' }]);
  assert.deepEqual(panel.counters(), { renders: 1, skipped: 3 });
});

test('a hidden panel stores the model and renders it once, when it is shown again', () => {
  const host = fakeHost();
  const drawn = [];
  const shown = [];
  const panel = createComponent({
    host,
    render: (model) => drawn.push(model.frame),
    onShow: () => shown.push('show'),
    onHide: () => shown.push('hide')
  });
  panel.mount({ frame: 0 });
  assert.equal(panel.hide(), true);
  assert.equal(host.hidden, true, 'a hidden panel does not leave its last render on screen');
  assert.equal(panel.isVisible(), false);
  for (let frame = 1; frame <= 20; frame += 1) panel.update({ frame });
  assert.deepEqual(panel.counters(), { renders: 1, skipped: 20 }, 'twenty notifications cost twenty comparisons and no render');
  assert.deepEqual(drawn, [0]);
  assert.equal(panel.show(), true);
  assert.equal(host.hidden, false);
  assert.deepEqual(drawn, [0, 20], 'only the last model reaches the DOM');
  assert.deepEqual(panel.counters(), { renders: 2, skipped: 20 });
  assert.equal(panel.show(), false, 'showing a visible panel changes nothing');
  assert.equal(panel.counters().renders, 2);
  assert.equal(panel.hide(), true);
  assert.equal(panel.hide(), false);
  panel.show();
  assert.equal(panel.counters().renders, 2, 'a panel that owes no render does not render on show');
  assert.deepEqual(shown, ['hide', 'show', 'hide', 'show']);
});

test('a panel mounted hidden renders nothing at all', () => {
  const host = fakeHost();
  let renders = 0;
  const panel = createComponent({ host, render: () => { renders += 1; } });
  panel.hide();
  panel.mount({ id: 'animate' });
  assert.equal(renders, 0, 'a workspace nobody opened never paid for its first render');
  assert.equal(host.hidden, true);
  assert.equal(panel.isMounted(), true);
  panel.show();
  assert.equal(renders, 1);
});

test('destroy removes every listener registered through the component', () => {
  const host = fakeHost();
  const window = fakeHost();
  const clicks = [];
  const panel = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'click', () => clicks.push('host'));
      listen(host, 'change', () => clicks.push('change'));
      listen(window, 'keydown', () => clicks.push('window'));
    }
  });
  panel.mount();
  host.dispatch('click');
  window.dispatch('keydown');
  assert.deepEqual(clicks, ['host', 'window']);
  assert.equal(host.listenerCount(), 2);
  panel.destroy();
  assert.equal(host.listenerCount(), 0);
  assert.equal(window.listenerCount(), 0, 'listeners on shared targets go too, or they outlive the panel');
  host.dispatch('click');
  window.dispatch('keydown');
  assert.deepEqual(clicks, ['host', 'window'], 'nothing else was heard');
});

test('a listener can be removed on its own, and none can be added after destroy', () => {
  const host = fakeHost();
  const heard = [];
  const panel = createComponent({ host });
  panel.mount();
  const stop = panel.listen(host, 'click', () => heard.push('click'));
  panel.listen(host, 'change', () => heard.push('change'));
  host.dispatch('click');
  stop();
  stop();
  host.dispatch('click');
  host.dispatch('change');
  assert.deepEqual(heard, ['click', 'change']);
  assert.equal(host.listenerCount(), 1);
  panel.destroy();
  const late = panel.listen(host, 'click', () => heard.push('too late'));
  host.dispatch('click');
  assert.equal(host.listenerCount(), 0, 'a late callback cannot put a listener back');
  assert.equal(typeof late, 'function');
  assert.doesNotThrow(late);
});

test('destroy disconnects every observer the component was given', () => {
  const host = fakeHost();
  let observer = null;
  const panel = createComponent({ host, onMount: ({ observe }) => { observer = observe(fakeObserver()); } });
  panel.mount();
  assert.equal(observer.connected, true, 'observe hands the observer back, so it can be connected in one line');
  panel.destroy();
  assert.equal(observer.connected, false);
  const late = panel.observe(fakeObserver());
  assert.equal(late.connected, false, 'an observer handed to a destroyed component is disconnected at once');
});

test('destroy empties the host, runs its hook once and is idempotent', () => {
  const host = fakeHost();
  const events = [];
  const panel = createComponent({
    host,
    render: () => { host.innerHTML = '<p>the panel</p>'; },
    onDestroy: () => events.push(host.innerHTML)
  });
  panel.mount({});
  assert.equal(host.innerHTML, '<p>the panel</p>');
  assert.equal(panel.destroy(), true);
  assert.equal(host.innerHTML, '', 'the DOM goes with the listeners');
  assert.deepEqual(events, ['<p>the panel</p>'], 'onDestroy still sees what it built');
  assert.equal(panel.destroy(), false);
  assert.deepEqual(events, ['<p>the panel</p>']);
  assert.equal(panel.isMounted(), false);
  assert.equal(panel.isVisible(), false);
  assert.equal(panel.show(), false, 'nothing wakes a destroyed component');
  assert.equal(panel.hide(), false);
  const unmounted = createComponent({ host: fakeHost(), onDestroy: () => events.push('never mounted') });
  unmounted.destroy();
  assert.deepEqual(events, ['<p>the panel</p>'], 'onDestroy is the pair of onMount, so it never runs alone');
});

test('a component needs a host, and renders nothing when it is given no render', () => {
  assert.throws(() => createComponent({}), /needs a host element/);
  assert.throws(() => createComponent(), /needs a host element/);
  const host = fakeHost();
  const holder = createComponent({ host });
  holder.mount({ id: 'container' });
  holder.update({ id: 'container 2' });
  assert.deepEqual(holder.counters(), { renders: 2, skipped: 0 }, 'a component with no render is still a lifecycle');
  holder.destroy();
});
