/**
 * Muzzles: the snout, as **two pads with the middle left open**.
 *
 * "6 museaux modulaires (sans nez ni bouche)" — the sheet's caption, and the
 * thing that makes the whole slot work. A muzzle is an accessory painted in
 * front of the face, and the nose and the mouth are semantic parts underneath
 * it. A solid snout would hide both. Two pads with a notch at the top for the
 * nose and a seam that stops above the lip line leave the features showing
 * through, so nothing has to be reordered and nothing is drawn twice:
 *
 * ```text
 * the muzzle   an accessory: shape only, no control of its own
 * the nose     a `nose` part, with noseScrunch, in the notch
 * the mouth    a `mouth` part, with mouthOpen / smile / mouthWidth, below the seam
 * ```
 *
 * Anchored at `nose.center` (MASC-09's candidate), and every one of them
 * declares a turn profile: a snout projects further than a moustache, and an
 * accessory that says nothing about the turn does not turn.
 */
import { round } from './shapes.js';

const PAD = '#fdf1e0', LINE = '#a4674a';

/**
 * One pad. The seam is at the face's middle, the notch is how far the inner
 * edge is held back from it at the top — which is the hole the nose sits in.
 */
const padPath = (sign, { w, top, bottom, notch }) => {
  const x = (offset) => round(120 + sign * offset);
  const mid = round((top + bottom) / 2);
  return `M120 ${bottom}`
    + ` C${x(w * 0.42)} ${round(bottom + 3)} ${x(w * 0.78)} ${round(bottom + 2)} ${x(w * 0.94)} ${round(mid + (bottom - mid) * 0.5)}`
    + ` C${x(w)} ${mid} ${x(w * 0.88)} ${round(top + 3)} ${x(w * 0.52)} ${round(top + 1)}`
    + ` C${x(notch + 3)} ${top} ${x(notch)} ${round(top + 7)} ${x(notch * 0.6)} ${round(mid + 1)}`
    + ` C${x(notch * 0.3)} ${round(bottom - 5)} 120 ${round(bottom - 4)} 120 ${bottom} Z`;
};

const muzzle = (slug, name, description, geometry, { tags, species, box }) => Object.freeze({
  id: `accessory.${slug}`, category: 'accessory', name, description, origin: 'builtin',
  artwork: `<g id="${slug}" data-name="${name}">`
    + `<path id="accessory" data-name="${name}" d="${padPath(-1, geometry)} ${padPath(1, geometry)}" fill="${PAD}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
    + '</g>',
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  // A snout stands out from the face: it foreshortens with the turn and
  // narrows with it, which is the moustache's reading only more so.
  turn: Object.freeze({ element: Object.freeze({ depth: 0.9, side: null, narrow: true }) }),
  paletteRoles: Object.freeze({ accessory: Object.freeze({ fill: 'skinShadow', stroke: 'outline' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'nose.center',
  slot: 'muzzle', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags),
  palette: Object.freeze(['skinShadow', 'outline'])
});

export const MUZZLE_FELINE_SHORT = muzzle('muzzle-feline-short', 'Short feline muzzle', 'Two short broad cheek pads, open at the nose.',
  { w: 45, top: 151, bottom: 171, notch: 16 }, { tags: ['cat', 'feline', 'short', 'broad'], box: { x: 74, y: 149, width: 92, height: 26 } });

export const MUZZLE_FELINE_ROUNDED = muzzle('muzzle-feline-rounded', 'Rounded feline muzzle', 'The same pads, rounder and fuller.',
  { w: 41, top: 150, bottom: 171, notch: 15 }, { tags: ['cat', 'feline', 'rounded'], box: { x: 78, y: 148, width: 84, height: 27 } });

export const MUZZLE_CANINE_MEDIUM = muzzle('muzzle-canine-medium', 'Medium canine muzzle', 'A longer snout, rounded at the end.',
  { w: 38, top: 150, bottom: 171, notch: 14 }, { tags: ['dog', 'canine', 'medium', 'rounded'], box: { x: 81, y: 148, width: 78, height: 27 } });

export const MUZZLE_CANINE_NARROW = muzzle('muzzle-canine-narrow', 'Narrow canine muzzle', 'A narrow snout, slightly pointed.',
  { w: 32, top: 151, bottom: 171, notch: 12 }, { tags: ['fox', 'vulpine', 'canine', 'narrow', 'pointed'], box: { x: 87, y: 149, width: 66, height: 26 } });

export const MUZZLE_BEAR_BROAD = muzzle('muzzle-bear-broad', 'Broad bear muzzle', 'A wide round snout with a large nose area.',
  { w: 50, top: 150, bottom: 171, notch: 18 }, { tags: ['bear', 'broad', 'round'], box: { x: 69, y: 148, width: 102, height: 27 } });

export const MUZZLE_RODENT_SMALL = muzzle('muzzle-rodent-small', 'Small rodent muzzle', 'A small soft snout, high on the face.',
  { w: 33, top: 152, bottom: 170, notch: 13 }, { tags: ['rabbit', 'rodent', 'small'], box: { x: 86, y: 150, width: 68, height: 24 } });

export const ANIMAL_MUZZLES = Object.freeze([MUZZLE_FELINE_SHORT, MUZZLE_FELINE_ROUNDED, MUZZLE_CANINE_MEDIUM, MUZZLE_CANINE_NARROW, MUZZLE_BEAR_BROAD, MUZZLE_RODENT_SMALL]);
