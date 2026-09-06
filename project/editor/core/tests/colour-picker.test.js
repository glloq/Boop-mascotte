import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SWATCHES, normalizeColour, paletteFromSvg } from '../../ui/colour-picker.js';

/**
 * The colours a mascot is painted with (docs/VECTOR_EDITING.md).
 *
 * The dialog leads with them, so what counts as one is worth pinning: the same
 * colour written two ways is one swatch, and anything the picker cannot show
 * is not a swatch at all.
 */
test('the palette is the artwork\'s own colours, once each, in the order it uses them', () => {
  const svg = `<svg><defs><linearGradient><stop stop-color="#FF0000"/></linearGradient></defs>
    <path fill="#123456" stroke="none"/><circle fill="#abc" stroke="#123456"/>
    <rect style="fill:#0f0;stroke:#654321"/><text fill="currentColor"/><g fill="url(#g)"/></svg>`;
  assert.deepEqual(paletteFromSvg(svg), ['#ff0000', '#123456', '#aabbcc', '#00ff00', '#654321']);
  // `none`, a gradient reference and a colour keyword are not swatches: the
  // dialog would have nothing to paint them with.
  assert.equal(paletteFromSvg('<svg><path fill="none" stroke="currentColor"/></svg>').length, 0);
  assert.deepEqual(paletteFromSvg(''), []);
  assert.deepEqual(paletteFromSvg(null), []);
  // A drawing with hundreds of colours would push everything else off screen.
  const many = Array.from({ length: 40 }, (_, index) => `<path fill="#${String(index).padStart(2, '0')}0000"/>`).join('');
  assert.equal(paletteFromSvg(`<svg>${many}</svg>`, 6).length, 6);
});

test('a colour has one spelling, so the same one is never two swatches', () => {
  assert.equal(normalizeColour('#ABC'), '#aabbcc');
  assert.equal(normalizeColour('  #A1B2C3  '), '#a1b2c3');
  assert.equal(normalizeColour('none'), null);
  assert.equal(normalizeColour('rgb(1,2,3)'), null);
  assert.equal(normalizeColour(undefined), null);
  assert.equal(BASE_SWATCHES.every((colour) => normalizeColour(colour) === colour), true, 'the standard set is already normal');
  assert.equal(new Set(BASE_SWATCHES).size, BASE_SWATCHES.length, 'and has no duplicates');
});
