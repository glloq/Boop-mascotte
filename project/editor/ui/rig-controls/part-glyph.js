/**
 * The picture on a control (docs/FACE_CONTROL_RIG.md, V3-14).
 *
 * ```text
 *   ◡ mouth    ▭ teeth    ~ tongue    ◉ eye    ● pupil
 *   ▬ brow     ◠ jaw      ▲ nose      ⌇ hair   ⌒ ear    ◯ head
 * ```
 *
 * Every one of them is a handful of curves in a 24-unit box, drawn from the
 * numbers the control is set to right now — so the picture on a control *is*
 * the movement that control makes. Drag the eye's control down and the eye on
 * it shuts; drag the teeth's and the teeth come down on the button.
 *
 * Drawn rather than shipped. An icon file would be one more thing to keep in
 * step with a rig that gains movements, it could not move, and it would say
 * nothing about which way this control goes — the pictures are strokes in
 * `currentColor` so a control keeps its own colour, its own size and its own
 * theme, at 19px on the mascot and at 22px in the board's list.
 *
 * Pure: it takes what `core/puppet/handle-glyph.js` reported and returns
 * markup. It knows nothing about handles, parameters or the document.
 */
import { clamp, esc, number, round } from './control-geometry.js';

/** Everything is drawn in this box, whatever size it ends up on screen. */
const BOX = 24;
const at = (value) => round(clamp(number(value), -BOX, BOX * 2));
const amount = (value, span = 1) => clamp(number(value), -1, 1) * span;
/** Nothing but strokes, so a control's own colour is what the picture is in. */
const line = (d, { width = 2.2, fill = 'none', opacity = 1 } = {}) =>
  `<path d="${d}" fill="${fill}" stroke="${fill === 'none' ? 'currentColor' : 'none'}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${opacity === 1 ? '' : ` opacity="${round(opacity)}"`}/>`;
const dot = (x, y, r, { opacity = 1 } = {}) => `<circle cx="${at(x)}" cy="${at(y)}" r="${round(Math.max(0.4, r))}" fill="currentColor"${opacity === 1 ? '' : ` opacity="${round(opacity)}"`}/>`;

/** The almond an eye, a pupil and a brow are all drawn against. */
const almond = (opacity = 1) => line(`M3 12 Q12 4.5 21 12 Q12 19.5 3 12`, { opacity });
/** The pair of lips a mouth, its teeth and its tongue are all drawn against. */
const lips = (open, smile, opacity = 1) =>
  line(`M4 12 Q12 ${at(12 - amount(smile, 3.5) - amount(open, 2))} 20 12 Q12 ${at(12 + amount(open, 6.5) - amount(smile, 1))} 4 12 Z`, { opacity });

/**
 * One picture, posed.
 *
 * Each kind reads the drag the way its own part moves: down shuts an eye and
 * opens a mouth, sideways tilts a brow and sways hair, and a ring's one axis
 * is a size rather than a direction — which is why the controller is asked for
 * rather than guessed at from the numbers.
 */
const GLYPHS = Object.freeze({
  /** A lid comes down over the eye as the control is dragged down. */
  eye: ({ y }) => {
    const shut = clamp(number(y), 0, 1);
    // The almond fades as the lid comes down over it, so a shut eye reads as
    // the one line an animator draws for one rather than an open eye with a
    // line through it.
    return almond(1 - shut * 0.7) + (shut > 0.75 ? '' : dot(12, 12, 3, { opacity: 1 - shut * 0.9 }))
      + line(`M3 12 Q12 ${at(4.5 + shut * 7.5)} 21 12`, { width: 2.6 });
  },
  /** A target aims the pupil; a ring sizes it. */
  pupil: ({ x, y, controller }) => almond(0.55)
    + (controller === 'radial'
      ? dot(12, 12, 2.2 + clamp(-number(y), -1, 1) * 1.8)
      : dot(12 + amount(x, 4.5), 12 + amount(y, 2.6), 3)),
  /** The bar lifts as the control is dragged up, and turns as it goes sideways. */
  brow: ({ x, y }) => {
    const lift = amount(-y, 3.5), turn = amount(x, 3);
    return almond(0.4) + line(`M4 ${at(9 - lift + turn)} Q12 ${at(6.5 - lift)} 20 ${at(9 - lift - turn)}`, { width: 3 });
  },
  /** Down opens the mouth, sideways bends it from a frown into a smile. */
  mouth: ({ x, y }) => lips(clamp(number(y), 0, 1), x),
  /** The teeth come down off the upper lip, the way a row of them shows. */
  teeth: ({ y }) => {
    const show = clamp(number(y), 0, 1);
    const drop = 2 + show * 4.5;
    return lips(0.55, 0, 0.45)
      + line(`M7 11 H17 V${at(11 + drop)} Q12 ${at(12.5 + drop)} 7 ${at(11 + drop)} Z`, { fill: 'currentColor' })
      + (show > 0.35 ? line(`M12 11 V${at(10 + drop)}`, { width: 1, opacity: 0.45 }) : '');
  },
  /** The tongue comes out of the mouth, and goes where it is aimed. */
  tongue: ({ x, y, orbit }) => {
    const out = clamp(number(y), 0, 1) || clamp(number(orbit), 0, 1);
    const side = amount(x, 3);
    return lips(0.7, 0, 0.45)
      + line(`M${at(9 + side)} 12 Q${at(12 + side)} ${at(11 - amount(orbit, 2))} ${at(15 + side)} 12 Q${at(15 + side)} ${at(16 + out * 5)} ${at(12 + side)} ${at(16.5 + out * 5)} Q${at(9 + side)} ${at(16 + out * 5)} ${at(9 + side)} 12 Z`,
        { fill: 'currentColor' });
  },
  /** The chin drops, hinged where a jaw is hinged. */
  jaw: ({ y }) => {
    const drop = clamp(number(y), 0, 1) * 3.5;
    return line(`M5 6 Q5 9 6 11`, { opacity: 0.45 }) + line(`M19 6 Q19 9 18 11`, { opacity: 0.45 })
      + line(`M6 ${at(11 + drop * 0.2)} Q12 ${at(19 + drop)} 18 ${at(11 + drop * 0.2)}`, { width: 2.8 });
  },
  /** A scrunched nose is a short, wide one. */
  nose: ({ y }) => {
    const up = clamp(-number(y), 0, 1);
    return line(`M12 ${at(6 + up * 3)} Q${at(9 - up * 1.5)} ${at(15 - up * 1.5)} ${at(10.5 - up)} ${at(16 - up * 1.5)} Q12 ${at(17.5 - up)} ${at(13.5 + up)} ${at(16 - up * 1.5)}`, { width: 2.4 });
  },
  /** Three locks, swayed sideways and lifted upwards. */
  hair: ({ x, y }) => {
    const sway = amount(x, 3.5), lift = amount(-y, 2.5);
    return [0, 1, 2].map((index) => {
      const foot = 7 + index * 5;
      return line(`M${at(foot)} ${at(19 - lift)} Q${at(foot + sway * 0.6)} ${at(11 - lift)} ${at(foot + sway)} ${at(5 - lift)}`, { width: 2.4 });
    }).join('');
  },
  /** An ear, wiggling on its own edge. */
  ear: ({ x }) => {
    const wiggle = amount(x, 2.5);
    return line(`M9 18 Q${at(4 + wiggle)} 15 ${at(6 + wiggle)} 9 Q${at(8 + wiggle)} 4 13 5 Q17 6 15 11 Q13.5 14 12 13`, { width: 2.4 });
  },
  /** A head, with its features carried round as it turns. */
  head: ({ x, y, orbit }) => {
    const turn = amount(x, 3), pitch = amount(y, 2.5), tilt = amount(orbit, 12);
    return `<g transform="rotate(${round(tilt)} 12 12)">`
      + line(`M12 3.5 Q19.5 3.5 19.5 12 Q19.5 20.5 12 20.5 Q4.5 20.5 4.5 12 Q4.5 3.5 12 3.5 Z`)
      + dot(9 + turn, 10.5 + pitch, 1.5) + dot(15 + turn, 10.5 + pitch, 1.5)
      + line(`M${at(9.5 + turn)} ${at(15.5 + pitch)} Q${at(12 + turn)} ${at(17.5 + pitch)} ${at(14.5 + turn)} ${at(15.5 + pitch)}`, { width: 1.8 })
      + '</g>';
  }
});

/** Whether there is a picture for this kind at all. */
export const hasPartGlyph = (kind) => Object.hasOwn(GLYPHS, String(kind));

/**
 * One control's picture, as an `<svg>` ready to drop inside the control.
 *
 * `aria-hidden`, always: the control already says what it is and what it is
 * set to in words, and a picture that repeated it would be read out twice.
 *
 * @param {{kind, controller, x, y, orbit}|null} glyph from `handleGlyph`
 * @param {{className?: string}} [options]
 * @returns {string} markup, or `''` when there is no picture for this part
 */
export function renderPartGlyph(glyph, { className = 'part-glyph' } = {}) {
  const draw = GLYPHS[glyph?.kind];
  if (!draw) return '';
  return `<svg class="${esc(className)}" viewBox="0 0 ${BOX} ${BOX}" data-part-glyph="${esc(glyph.kind)}" aria-hidden="true" focusable="false">${draw(glyph)}</svg>`;
}
