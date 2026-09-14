import test from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_MIN, COLUMN_DEFAULTS, COLUMN_MIN, clampColumnWidth, columnResizeMarkup, pixels } from '../../shell/column-resize.js';

test('a column takes the width it is given, between its own minimum and the room left over', () => {
  assert.equal(clampColumnWidth('left', 420, { viewport: 1280, other: 310 }), 420);
  assert.equal(clampColumnWidth('left', 10, { viewport: 1280, other: 310 }), COLUMN_MIN.left);
  // The ceiling is what is actually left: 1280 - 310 of inspector - 360 of canvas.
  assert.equal(clampColumnWidth('left', 5000, { viewport: 1280, other: 310 }), 1280 - 310 - CANVAS_MIN);
  assert.equal(clampColumnWidth('right', 5000, { viewport: 1280, other: 300 }), 1280 - 300 - CANVAS_MIN);
});

test('the canvas keeps its minimum, and where there is no room at all the column keeps its own', () => {
  // Both columns dragged wide: the second one cannot eat the canvas the first
  // one left, because the ceiling is measured against the first's real width.
  const left = clampColumnWidth('left', 600, { viewport: 1280, other: 250 });
  assert.equal(left + 250 + clampColumnWidth('right', 600, { viewport: 1280, other: left }) <= 1280, true, 'the canvas still has 360 px');

  // A window too narrow for the arithmetic: the minimum wins rather than a
  // negative or a column narrower than its own contents.
  assert.equal(clampColumnWidth('left', 300, { viewport: 640, other: 250 }), COLUMN_MIN.left);
  assert.equal(clampColumnWidth('right', 300, { viewport: 480, other: 300 }), COLUMN_MIN.right);
});

test('"nothing saved" is not "nought pixels wide"', () => {
  // `Number(null)` is 0, so the obvious spelling of this check read an unset
  // preference as a column of no width and started every session at the
  // minimum. The clamp hid it (0 clamps up to 220); the startup branch did not.
  assert.equal(pixels(null), null);
  assert.equal(pixels(undefined), null);
  assert.equal(pixels(''), null);
  assert.equal(pixels('  '), null);
  assert.equal(pixels({}), null);
  assert.equal(pixels(NaN), null);
  assert.equal(pixels(0), 0, 'and nought really asked for is still nought');
  assert.equal(pixels(420), 420);
  assert.equal(pixels('420px'), 420, 'because this also reads a computed style');
});

test('nonsense is the minimum, never NaN on the grid', () => {
  for (const value of [undefined, null, '', 'wide', NaN, Infinity, {}]) {
    const width = clampColumnWidth('left', value, { viewport: 1280, other: 310 });
    assert.equal(Number.isFinite(width), true, `${String(value)} gives a number`);
    assert.equal(width, COLUMN_MIN.left);
  }
});

test('both separators are focus stops that say what they resize', () => {
  const markup = columnResizeMarkup();
  for (const side of ['left', 'right']) {
    assert.match(markup, new RegExp(`id="${side}-resize"`));
  }
  assert.equal(markup.match(/role="separator"/g).length, 2);
  assert.equal(markup.match(/aria-orientation="vertical"/g).length, 2);
  assert.equal(markup.match(/tabindex="0"/g).length, 2);
  // Two separators, two different things to resize: "Resize" twice would be
  // two controls a screen reader cannot tell apart.
  assert.match(markup, /aria-label="Resize the tools column"/);
  assert.match(markup, /aria-label="Resize the inspector column"/);
});

test('the defaults are the stylesheet\'s, so a reset and the CSS cannot disagree', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(css, new RegExp(`var\\(--left-width,\\s*${COLUMN_DEFAULTS.left}px\\)`), 'the grid falls back to the same left width');
  assert.match(css, new RegExp(`var\\(--right-width,\\s*${COLUMN_DEFAULTS.right}px\\)`), 'and the same right width');
});
