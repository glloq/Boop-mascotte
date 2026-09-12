import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INSPECTOR_ADAPTERS, INSPECTOR_HIDDEN_SUBJECTS, INSPECTOR_IDS, resolveInspectorAdapters
} from '../../ui/inspector-registry.js';
import { resolveInspectorPresentation } from '../../ui/context-inspector.js';
import { DOCKS } from '../../shell/bottom-dock.js';
import { FOCUSABLE_PANELS, MODES } from '../../ui/task-router.js';
import { inspectorHostMarkup } from '../../shell/inspector-host.js';

/**
 * The two registries of UIR-03 (§5 Règle B, docs/UIR_REFACTOR_BASELINE.md).
 *
 * Both replace a chain of conditions with a table, and both are only worth
 * having if the table is complete: an adapter with no host in the markup is an
 * inspector that silently never shows, and a dock a screen asks for by a name
 * nothing registers is a screen that arrives on an empty footer.
 */

test('every inspector adapter has a host in the shell, and every host has an adapter', () => {
  const markup = inspectorHostMarkup();
  const hosts = [...markup.matchAll(/data-inspector-adapter="([\w-]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...INSPECTOR_IDS].sort(), [...hosts].sort(),
    'an adapter with no host never shows, and a host no adapter names never hides');
});

test('the registry answers exactly as the six conditions it replaces did', () => {
  // The old chain, written out. If the table and this disagree, the table is
  // wrong: this is what the editor did before UIR-03 turned it into data.
  const before = (subject, kind) => ({
    character: subject === 'character',
    artwork: kind === 'artwork' && subject !== 'character',
    semantic: subject === 'face-setup' && (kind === 'none' || kind.startsWith('semantic-')),
    expression: subject === 'expressions' && (kind === 'none' || kind === 'expression'),
    motion: subject === 'animate' && ['clip', 'timeline-track', 'timeline-key'].includes(kind),
    reaction: subject === 'reactions' && (kind === 'none' || kind === 'reaction')
  });
  const subjects = ['artwork', 'character', 'hands', 'face-setup', 'expressions', 'animate', 'reactions', 'preview'];
  const kinds = ['none', 'artwork', 'semantic-part', 'semantic-control', 'expression', 'reaction', 'clip', 'timeline-track', 'timeline-key', 'state', 'diagnostic'];
  for (const subject of subjects) {
    for (const kind of kinds) {
      const { on } = resolveInspectorAdapters(subject, kind);
      const expected = before(subject, kind);
      for (const id of INSPECTOR_IDS) {
        assert.equal(on.has(id), expected[id], `${subject} + ${kind}: ${id}`);
      }
    }
  }
});

test('Preview has no inspector, and says so rather than showing an empty one', () => {
  assert.deepEqual([...INSPECTOR_HIDDEN_SUBJECTS], ['preview']);
  assert.equal(resolveInspectorAdapters('preview', 'none').hidden, true);
  assert.equal(resolveInspectorPresentation('preview', { kind: 'none' }).hidden, true);
  assert.equal(resolveInspectorPresentation('artwork', { kind: 'none' }).hidden, false);
});

test('an adapter declares where it answers and what it adapts, and nothing else', () => {
  for (const adapter of INSPECTOR_ADAPTERS) {
    assert.deepEqual(Object.keys(adapter).sort(), ['except', 'id', 'kinds', 'subjects'],
      `${adapter.id} grew a field the resolver does not read`);
    assert.ok(adapter.subjects === null || adapter.subjects.length, `${adapter.id} answers nowhere`);
    assert.ok(adapter.kinds === null || adapter.kinds.length, `${adapter.id} adapts nothing`);
  }
});

test('every dock a screen asks for is registered, and every panel it reveals is focusable', () => {
  for (const mode of Object.values(MODES)) {
    if (mode.dock) assert.ok(DOCKS[mode.dock], `${mode.id} opens a dock nothing registers: ${mode.dock}`);
    // A panel a screen reveals goes through the same list a deep link does, so
    // an id that is not focusable is an id nothing can open.
    if (mode.panel) assert.ok(FOCUSABLE_PANELS.includes(mode.panel), `${mode.id} reveals an unknown panel: ${mode.panel}`);
  }
  // One dock at a time is the rule, so the shell holds one id rather than a set.
  const shell = readFileSync(new URL('../../shell/bottom-dock.js', import.meta.url), 'utf8');
  assert.match(shell, /root\.dataset\.dock = /, 'the open dock is on the root, where the stylesheet can read it');
  assert.deepEqual(Object.keys(DOCKS), ['timeline'], 'the Timeline is the only dock so far; the event log and diagnostics join it here');
});
