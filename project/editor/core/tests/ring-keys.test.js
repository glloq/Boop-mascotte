import test from 'node:test';
import assert from 'node:assert/strict';
import { ringOf, ringTarget, walkRing } from '../../ui/character-builder/ring-keys.js';

/**
 * The arrow keys in the Character Builder (docs/CHARACTER_BUILDER.md,
 * "Keyboard and small screens"; roadmap phase 50): a row of buttons is a
 * ring the arrows walk, wrapping, Home and End at the ends; Tab is untouched.
 */
test('ringTarget: next, previous, wrapping, the ends, and nothing for any other key or a button outside the ring', () => {
  assert.equal(ringTarget(3, 0, 'ArrowRight'), 1);
  assert.equal(ringTarget(3, 0, 'ArrowDown'), 1);
  assert.equal(ringTarget(3, 2, 'ArrowRight'), 0, 'wraps');
  assert.equal(ringTarget(3, 0, 'ArrowLeft'), 2, 'wraps back');
  assert.equal(ringTarget(3, 1, 'ArrowUp'), 0);
  assert.equal(ringTarget(3, 1, 'Home'), 0);
  assert.equal(ringTarget(3, 1, 'End'), 2);
  assert.equal(ringTarget(1, 0, 'ArrowRight'), 0, 'a ring of one stays');
  for (const [count, index, key] of [[3, 0, 'Tab'], [3, 0, 'Enter'], [3, 0, ' '], [3, 3, 'ArrowRight'], [3, -1, 'ArrowRight'], [0, 0, 'ArrowRight'], [3, 0.5, 'ArrowRight']]) assert.equal(ringTarget(count, index, key), null, `${count} ${index} ${key}`);
});

/** A group or list with buttons in it, as the panels draw them, without a DOM. */
function fakeRing({ role = 'group', className = '', count = 3, categories = 0 } = {}) {
  const ring = { role, classList: { contains: (name) => className.split(' ').includes(name) }, querySelectorAll: (selector) => (selector.startsWith('.part-category-button') ? items.filter((item) => item.category && !item.disabled) : items.filter((item) => !item.disabled)) };
  const items = Array.from({ length: count }, (_, index) => ({
    id: `b${index}`, category: index < categories, disabled: false, focused: 0,
    focus() { this.focused += 1; },
    closest(selector) { return selector === 'button' ? this : selector.includes('[role=') ? ring : null; }
  }));
  return { ring, items };
}
const press = (target, key, extra = {}) => { const event = { key, target, prevented: 0, preventDefault() { this.prevented += 1; }, ...extra }; return { moved: walkRing(event), event }; };

test('walkRing moves the focus along a group of cards or chips and says so; a disabled card is skipped over', () => {
  const { items } = fakeRing({ count: 4 });
  items[2].disabled = true;
  assert.deepEqual(ringOf(items[0]), { buttons: [items[0], items[1], items[3]], index: 0 });
  let { moved, event } = press(items[0], 'ArrowRight');
  assert.equal(moved, true);
  assert.equal(event.prevented, 1, 'the page does not scroll');
  assert.deepEqual(items.map((item) => item.focused), [0, 1, 0, 0]);
  ({ moved } = press(items[1], 'ArrowRight'));
  assert.deepEqual(items.map((item) => item.focused), [0, 1, 0, 1], 'the disabled card is not a stop');
  press(items[3], 'End');
  assert.equal(items[3].focused, 2);
  press(items[3], 'ArrowDown');
  assert.equal(items[0].focused, 1, 'wraps');
  assert.equal(ringOf(items[2]), null, 'a disabled card is in no ring');
  assert.equal(press(items[2], 'ArrowRight').moved, false);
});

test('walkRing leaves alone a modifier, another key, a field, and a button in no group', () => {
  const { items } = fakeRing({ count: 2 });
  for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }]) assert.equal(press(items[0], 'ArrowRight', extra).moved, false, JSON.stringify(extra));
  assert.equal(press(items[0], 'Tab').moved, false);
  assert.equal(press(items[0], 'Enter').event.prevented, 0);
  const field = { closest: () => null };
  assert.equal(press(field, 'ArrowRight').moved, false);
  const loner = { closest: (selector) => (selector === 'button' ? loner : null) };
  assert.equal(press(loner, 'ArrowRight').moved, false);
  assert.equal(walkRing(null), false);
  assert.deepEqual(items.map((item) => item.focused), [0, 0]);
});

test('in the parts list, the ring is the category rows only: a button of the open body is not a stop, and does not walk', () => {
  const { items } = fakeRing({ role: 'list', className: 'part-browser', count: 5, categories: 3 });
  assert.deepEqual(ringOf(items[0]).buttons, [items[0], items[1], items[2]]);
  press(items[2], 'ArrowDown');
  assert.equal(items[0].focused, 1, 'from the last row to the first');
  assert.equal(ringOf(items[4]), null, 'a route button inside a body belongs to no ring here');
  assert.equal(press(items[4], 'ArrowDown').moved, false);
});
