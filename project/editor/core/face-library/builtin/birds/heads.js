/**
 * Bird head silhouettes: the bare feathered outline, and nothing on it.
 *
 * "6 formes de base pour têtes d'oiseaux (vue de face)" — the planche's own
 * caption, and the same shape the rest of this library has. Every feature is a
 * separate piece; what belongs to the *head* is only what belongs to the
 * silhouette, which is why the owl's tufts and the parrot's side feathers are
 * here and the crests are not.
 *
 * Drawn where the human skulls are drawn — the face's middle at 120, 116 — so a
 * bird head and a person's head fit the same face at the same size.
 *
 * **A bird head ships a jaw, and it is the skull.** Unlike a robot shell, a
 * feathered head is soft: the same outline drawn twice, at rest and with its
 * lower half stretched down by `JAW_DROP`, exactly as the human and animal
 * heads do it. What a bird does *not* have is a separate mouth — the beak is
 * the mouth — so `jawOpen` drops the face and `mouthOpen` opens the beak, and
 * the two read together as one bird opening up.
 */
import { JAW_DROP } from '../heads.js';
import { birdBox, birdRing, closedCurve, featherPath, round, unionBox } from './shapes.js';

const FEATHER = '#f0e2cd', LINE = '#8a6f4e';

/** The silhouette, with its lower half stretched down by `drop`. */
function silhouette(cx, cy, rx, ry, shape, drop = 0) {
  const stretch = ([x, y]) => [x, y > cy ? cy + (y - cy) * (1 + drop / ry) : y];
  return closedCurve(birdRing(cx, cy, rx, ry, shape).map(stretch));
}

const head = (slug, name, description, geometry, { tags, extra = () => '', extraRoles = {}, box = null }) => {
  const { cx, cy, rx, ry } = geometry;
  const draw = (drop) => silhouette(cx, cy, rx, ry, geometry, drop);
  const painted = { skull: Object.freeze({ fill: 'skin', stroke: 'outline' }), ...extraRoles };
  return Object.freeze({
    id: `head.${slug}`, category: 'head', name, description, origin: 'builtin',
    artwork: `<g id="head-${slug}" data-name="Head">${extra(-1, 'Left')}${extra(1, 'Right')}`
      + `<path id="skull" data-name="Skull" d="${draw(0)}" fill="${FEATHER}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" /></g>`,
    roles: Object.freeze({ head: 'skull' }),
    capabilities: Object.freeze(['headX', 'headY', 'headTilt']),
    // The jaw takes the skull, as it does on a person: a feathered head is soft,
    // and the pose is the same outline with its lower half dropped.
    parts: Object.freeze({ jaw: Object.freeze({ roles: Object.freeze({}), capabilities: Object.freeze(['jawOpen']), drivers: Object.freeze({ jawOpen: Object.freeze({ property: 'shapeKey', posePath: draw(JAW_DROP) }) }) }) }),
    paletteRoles: Object.freeze(Object.fromEntries(Object.entries(painted).map(([id, paint]) => [id, Object.freeze(paint)]))),
    referenceBox: Object.freeze(box || birdBox(cx, cy, rx, ry, geometry)),
    mountPoint: 'head.center',
    palette: Object.freeze([...new Set(Object.values(painted).flatMap((paint) => Object.values(paint)))]),
    slot: 'head', morphologies: Object.freeze(['beak']), tags: Object.freeze(['bird', ...tags])
  });
};

/**
 * Hibou — broad, with two tufts worked into the outline.
 *
 * The tufts are drawn *behind* the skull and short, so what stands above the
 * crown is a hint rather than a crest. `accessory.crest-owl-tufts` is the tall
 * pair; an owl wearing both reads as one bird, which is the whole reason the
 * two are drawn to different heights (MASC-12A, `owl-tufts-versus-crest`).
 */
const OWL = { cx: 120, cy: 116, rx: 94, ry: 88, crown: 2.4, jaw: 2.1, tags: ['owl', 'broad', 'tufted'] };
export const HEAD_BIRD_OWL = head('bird-owl', 'Owl head', 'A broad soft head with two tufts worked into the outline.',
  OWL, {
    tags: OWL.tags,
    extra: (sign) => `<path id="tuft${sign < 0 ? 'Left' : 'Right'}" data-name="${sign < 0 ? 'Left' : 'Right'} head tuft" d="${featherPath(120 + sign * 64, 76, 58, 24, { lean: sign * 10, sharp: 0.44 })}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`,
    extraRoles: { tuftLeft: { fill: 'skin', stroke: 'outline' }, tuftRight: { fill: 'skin', stroke: 'outline' } },
    box: unionBox(birdBox(120, 116, 94, 88, OWL), { x: 32, y: 18, width: 176, height: 58 })
  });

/** Canard — round and wide, with the smoothest edge of the six. */
export const HEAD_BIRD_DUCK = head('bird-duck', 'Duck head', 'Round and wide, with a smooth unbroken edge.',
  { cx: 120, cy: 116, rx: 96, ry: 84, crown: 2, jaw: 2.05, tags: ['duck', 'round', 'wide'] },
  { tags: ['duck', 'round', 'wide'] });

/**
 * Perroquet — upright, with a fan of feathers down each side of the face.
 *
 * The feathers stay inside the head's own reference box: MASC-12A asked whether
 * they would push it wide enough to shrink the face on a fit, and they do not —
 * three short feathers tucked against the cheek, not a second silhouette.
 */
const PARROT = { cx: 120, cy: 116, rx: 82, ry: 92, crown: 2.2, jaw: 2.3, tags: ['parrot', 'feathered', 'upright'] };
export const HEAD_BIRD_PARROT = head('bird-parrot', 'Parrot head', 'Upright, with a fan of feathers down each side of the face.',
  PARROT, {
    tags: PARROT.tags,
    extra: (sign, side) => [0, 1, 2].map((step) => `<path id="cheek${side}${step}" data-name="${side} cheek feather ${step + 1}" d="${featherPath(120 + sign * (78 + step * 7), 126 + step * 20, 40, 13, { lean: sign * 12, sharp: 0.55 })}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`).join(''),
    extraRoles: Object.fromEntries(['Left', 'Right'].flatMap((side) => [0, 1, 2].map((step) => [`cheek${side}${step}`, { fill: 'skin', stroke: 'outline' }]))),
    box: unionBox(birdBox(120, 116, 82, 92, PARROT), { x: 14, y: 86, width: 212, height: 80 })
  });

/** Corbeau — angular and flat-browed, the only squared silhouette. */
export const HEAD_BIRD_CROW = head('bird-crow', 'Crow head', 'Angular and flat-browed, narrowing below the eyes.',
  { cx: 120, cy: 116, rx: 86, ry: 90, lean: -0.12, crown: 3.2, jaw: 2.4, tags: ['crow', 'angular', 'sharp'] },
  { tags: ['crow', 'angular', 'sharp'] });

/** Oiseau mignon — the roundest and the plainest. */
export const HEAD_BIRD_CUTE = head('bird-cute', 'Cute bird head', 'A small, perfectly round head with a light edge.',
  { cx: 120, cy: 116, rx: 84, ry: 84, crown: 2, jaw: 2, tags: ['cute', 'round', 'small'] },
  { tags: ['cute', 'round', 'small'] });

/** Oiseau fin — the narrowest, and the only one taller than it is wide. */
export const HEAD_BIRD_SLIM = head('bird-slim', 'Slim bird head', 'Tall and narrow, tapering below the eyes.',
  { cx: 120, cy: 116, rx: 72, ry: 96, lean: -0.14, crown: 2.1, jaw: 2.6, tags: ['slim', 'tall', 'elegant'] },
  { tags: ['slim', 'tall', 'elegant'] });

export const BIRD_HEADS = Object.freeze([
  HEAD_BIRD_OWL, HEAD_BIRD_DUCK, HEAD_BIRD_PARROT, HEAD_BIRD_CROW, HEAD_BIRD_CUTE, HEAD_BIRD_SLIM
]);

export { round };
