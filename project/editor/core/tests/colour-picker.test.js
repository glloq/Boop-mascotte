import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SWATCHES, chosenColour, normalizeColour, paletteFromSvg, shownColour } from '../../ui/colour-picker.js';

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

/**
 * The palette holds any colour CSS can spell (`isColour`, docs/FACE_PART_LIBRARY.md):
 * a face painted `oklch(…)` or `rebeccapurple` has a swatch for it. The hex
 * field cannot spell those, and the dialog must not turn "I came to look" into
 * "repaint this piece black" because of that.
 */
test('a colour the hex field cannot spell is still shown, and is still what the button keeps', () => {
  for (const colour of ['oklch(70% 0.1 200)', 'rgb(1, 2, 3)', 'hsl(210 40% 50%)', 'rebeccapurple']) {
    assert.equal(shownColour(colour), colour.toLowerCase(), colour);
    assert.equal(chosenColour({ typed: colour, opened: colour, native: '#000000' }), colour.toLowerCase(), `${colour} survives being left alone`);
  }
  assert.equal(shownColour('#ABC'), '#aabbcc', 'a hex is still normalised to one spelling');
  // Not a colour: the dialog says the piece is not painted, as it did before.
  for (const value of ['none', 'url(#g)', 'currentColor', '', null]) assert.equal(shownColour(value), '', String(value));
});

test('what "Use this colour" applies: what was typed, else what was there, else the system picker', () => {
  assert.equal(chosenColour({ typed: '#ABC', opened: 'oklch(70% 0.1 200)', native: '#112233' }), '#aabbcc', 'a typed hex wins');
  assert.equal(chosenColour({ typed: 'oklch(70% 0.1 200)', opened: 'oklch(70% 0.1 200)', native: '#112233' }), 'oklch(70% 0.1 200)', 'an untouched colour is kept');
  assert.equal(chosenColour({ typed: 'oklch(70% 0.1 200)', opened: '#ff0000', native: '#112233' }), '#112233', 'text that was never this piece\'s colour is not a colour');
  assert.equal(chosenColour({ typed: '', opened: '', native: '#112233' }), '#112233', 'an empty field takes the system picker');
  assert.equal(chosenColour({ typed: 'nonsense', opened: '#ff0000', native: '' }), '#000000');
  assert.equal(chosenColour(), '#000000');
});
