/**
 * The two columns, at the width the author wants them
 * (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §10.1).
 *
 * `300px` of tools and `310px` of inspector, both fixed: at 1280 px that is
 * 610 px of furniture and **670 px of canvas — 52 % of the screen for the
 * mascot**. The only control was collapsing a column whole, to 42 px, so the
 * choice was "300 or nothing" on either side.
 *
 * Two separators, the Timeline's own component turned on its side: the same
 * pointer drag, the same double-click back to the default, the same keyboard
 * steps, the same `role="separator"` (`shell/bottom-dock.js`). The width is a
 * custom property the grid reads, so nothing in the layout learns a second way
 * to be sized:
 *
 * ```text
 * .workspace  grid-template-columns: var(--left-width) 1fr var(--right-width)
 *             #left-resize  left:  calc(var(--left-width)  - 4px)
 *             #right-resize right: calc(var(--right-width) - 4px)
 * ```
 *
 * Desktop only. On tablet the left column is a drawer and the right one a
 * sheet, both of them overlays with no boundary to drag.
 */

/** What the stylesheet's own fallback says, so a reset and the CSS cannot disagree. */
export const COLUMN_DEFAULTS = Object.freeze({ left: 300, right: 310 });

/**
 * How narrow each column may get.
 *
 * Measured rather than picked: at 220 px the library's grid still fits three
 * 78 px cards with their gaps, and below 250 px the inspector's two-column
 * field rows start wrapping their labels onto their own lines.
 */
export const COLUMN_MIN = Object.freeze({ left: 220, right: 250 });

/** And what the canvas keeps whatever the columns ask for (§5, Règle A). */
export const CANVAS_MIN = 360;

/**
 * A width the layout can honour.
 *
 * The ceiling is the room actually left over — the viewport less the other
 * column and the canvas's own minimum — rather than a percentage, because a
 * percentage cannot know that the other column was dragged wide first. Where
 * there is no room at all the minimum wins: a column narrower than its own
 * contents is not a smaller column, it is a broken one.
 */
export function clampColumnWidth(side, value, { viewport = 1280, other = 0 } = {}) {
  const min = COLUMN_MIN[side] ?? 220;
  const room = Math.max(min, viewport - other - CANVAS_MIN);
  return Math.round(Math.max(min, Math.min(room, pixels(value) ?? min)));
}

/**
 * A number of pixels, or null.
 *
 * `Number.isFinite(Number(value))` is the obvious spelling and it is wrong:
 * `Number(null)` is `0`, so "nothing saved" read as "nought pixels wide" and
 * every column came up at its minimum. The clamp hid it — 0 clamps up to 220 —
 * and the startup branch did not.
 */
export function pixels(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

/** Both separators, as children of the grid rather than items in it. */
export const columnResizeMarkup = () =>
  `<div id="left-resize" class="panel-resize" role="separator" aria-orientation="vertical" aria-label="Resize the tools column" tabindex="0"></div><div id="right-resize" class="panel-resize" role="separator" aria-orientation="vertical" aria-label="Resize the inspector column" tabindex="0"></div>`;

const OTHER = Object.freeze({ left: 'right', right: 'left' });

export function wireColumnResize({ root, q, preferences, savePreferences = () => {} }) {
  const read = (side) => parseFloat(getComputedStyle(root).getPropertyValue(`--${side}-width`)) || COLUMN_DEFAULTS[side];

  // Written out rather than built from `side`: `core/tests/home-entry.test.js`
  // reads every `q('…')` in the shell and checks the element is in the markup
  // the shell renders, and a selector it cannot see is a selector nothing
  // guards. `mustQuery` throws, so a missing one is an editor that never boots.
  const handles = { left: q('#left-resize'), right: q('#right-resize') };

  /** What the separator says it is, for a screen reader and for a hover. */
  const describe = (side, width) => {
    const handle = handles[side];
    handle.setAttribute('aria-valuenow', String(Math.round(width)));
    handle.setAttribute('aria-valuemin', String(COLUMN_MIN[side]));
    handle.title = `${Math.round(width)} px — drag, or use the arrow keys. Double-click for ${COLUMN_DEFAULTS[side]} px.`;
  };

  /** @returns {number} the width it settled on, which is not always the one asked for. */
  const setWidth = (side, value, { save = true } = {}) => {
    const width = clampColumnWidth(side, value, { viewport: root.getBoundingClientRect().width || innerWidth, other: read(OTHER[side]) });
    root.style.setProperty(`--${side}-width`, `${width}px`);
    describe(side, width);
    preferences[`${side}Width`] = width;
    if (save) savePreferences();
    return width;
  };

  for (const side of ['left', 'right']) {
    const handle = handles[side];
    // A drag away from the canvas widens the column: the left separator grows
    // its column to the right, the right one to the left.
    const towards = side === 'left' ? 1 : -1;
    let dragging = null;

    handle.addEventListener('pointerdown', (event) => {
      dragging = { x: event.clientX, width: read(side) };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (dragging) setWidth(side, dragging.width + (event.clientX - dragging.x) * towards, { save: false });
    });
    handle.addEventListener('pointerup', () => { if (dragging) { dragging = null; savePreferences(); } });
    handle.addEventListener('dblclick', () => setWidth(side, COLUMN_DEFAULTS[side]));
    // A focus stop has to do something from the keyboard, and a separator's
    // something is the arrows that point along the axis it moves on.
    handle.addEventListener('keydown', (event) => {
      const step = (event.shiftKey ? 60 : 20) * towards;
      if (event.key === 'ArrowRight') { event.preventDefault(); setWidth(side, read(side) + step); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); setWidth(side, read(side) - step); }
      else if (event.key === 'Home') { event.preventDefault(); setWidth(side, COLUMN_DEFAULTS[side]); }
    });
    // A width saved on a wider screen is re-clamped against this one, so a
    // column cannot come back from storage wider than the window. Nothing saved
    // means nothing set: the default stays the stylesheet's, in one place, and
    // this only says out loud what the column already measures.
    const saved = pixels(preferences[`${side}Width`]);
    if (saved === null) describe(side, read(side));
    else setWidth(side, saved, { save: false });
  }

  return { setWidth, width: read };
}
