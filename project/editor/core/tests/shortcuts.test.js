import test from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUTS, SHORTCUT_SCOPES, isTextTarget, matchShortcut, shortcutHelpMarkup } from '../../ui/shortcuts.js';

const event = (overrides = {}) => ({ key: '', code: '', ctrlKey: false, metaKey: false, shiftKey: false, target: null, ...overrides });

test('the shortcut registry matches global keys, stays quiet while typing and documents every scope', () => {
  assert.equal(matchShortcut(event({ key: 'k', ctrlKey: true })), 'palette');
  assert.equal(matchShortcut(event({ key: 'K', metaKey: true })), 'palette');
  assert.equal(matchShortcut(event({ key: '?' })), 'help');
  assert.equal(matchShortcut(event({ key: 'z', ctrlKey: true })), 'undo');
  assert.equal(matchShortcut(event({ key: 'Z', ctrlKey: true, shiftKey: true })), 'redo');
  assert.equal(matchShortcut(event({ key: 'y', metaKey: true })), 'redo');
  assert.equal(matchShortcut(event({ key: 'Escape' })), 'escape');
  assert.equal(matchShortcut(event({ code: 'Space', key: ' ' })), 'play');
  assert.equal(matchShortcut(event({ key: 'k' })), null, 'plain letters are not shortcuts');
  assert.equal(matchShortcut(event({ key: 'z', ctrlKey: true }), { typing: true }), null, 'undo inside a text field belongs to the field');
  assert.equal(matchShortcut(event({ key: 'Escape' }), { typing: true }), 'escape', 'Escape always works');
  const input = { matches: (selector) => selector.includes('input'), isContentEditable: false };
  assert.equal(isTextTarget(input), true);
  assert.equal(isTextTarget({ matches: () => false, isContentEditable: true }), true);
  assert.equal(isTextTarget(null), false);
  for (const shortcut of SHORTCUTS) assert.ok(SHORTCUT_SCOPES.includes(shortcut.scope), `${shortcut.id} has a known scope`);
  const markup = shortcutHelpMarkup();
  for (const shortcut of SHORTCUTS) assert.match(markup, new RegExp(`data-shortcut="${shortcut.id}"`));
  assert.ok(markup.indexOf('Global') < markup.indexOf('Timeline'), 'scopes render in a stable order');
});
