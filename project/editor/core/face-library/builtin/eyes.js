/**
 * The three pairs of eyes the library offers (docs/EYE_BUILDS.md).
 *
 * ```text
 *   Dot                 Simple                 Iris
 *   ●  ●              ╭───╮ ╭───╮            ╭───╮ ╭───╮
 *                     │⬤ │ │ ⬤│            │◎ │ │ ◎│
 *                     ╰───╯ ╰───╯            ╰───╯ ╰───╯
 *   a pupil,        white · pupil ·       white · iris ·
 *   nothing else    lid · outline         pupil · lid · outline
 * ```
 *
 * There were **twenty-one**, and seventeen of them were one construction at
 * different radii: round large, round small, sleepy, cartoon, minimal, and the
 * same five again for muzzles and for beaks. Choosing between them was choosing
 * a size — which is the scale field — and an expression — which is the
 * controls. `eyes.sleepy` was `rest: 12`, a lid parked lower; that is
 * `eyeOpen 0.6`, and it can be keyed.
 *
 * So the vocabulary is the two questions that actually change the drawing:
 * **is there a white, and is there an iris.** None of the three declares a
 * morphology, so all three suit every head — a muzzle and a beak no longer
 * need eyes of their own, which is five cards and a compatibility warning
 * gone (`compatibility.js`).
 *
 * The robot eyes stay where they are (`builtin/robots/eyes.js`): a lit panel
 * is a different construction, with no white, no pupil and no lid, and folding
 * it into these three would be claiming it is the same drawing.
 *
 * Every piece of geometry, and every expression that drives it, comes from
 * `core/face/eye-build.js` — the same module the template draws with, so an eye
 * from a card and the eye the sample ships are the same eye.
 */
import { EYE_FRAME, eyeDrivers, eyeGeometry, eyeMarkup, round } from '../../face/eye-build.js';

const PALETTE = Object.freeze({
  skin: '#f9d9b0', outline: '#a4674a', eyeWhite: '#ffffff', pupil: '#2f3a43',
  iris: '#5b8dbd', glint: '#ffffff'
});

const SIDES = Object.freeze(['Left', 'Right']);
const centre = (side) => (side === 'Left' ? EYE_FRAME.left : EYE_FRAME.right);

/**
 * One driver, as a generated binding the installer can apply.
 *
 * `roles` carries the per-side expression, because a wink is a side offset
 * inside the binding's own expression and the two sides therefore never share
 * one string (docs/FACE_CONTROL_RIG.md §5).
 */
const driver = (key, geometry, { rolePrefix }) => {
  const spec = eyeDrivers(geometry)[key];
  return Object.freeze({
    ...spec,
    roles: Object.freeze(Object.fromEntries(SIDES.map((side) => [`${side.toLowerCase()}${rolePrefix}`,
      Object.freeze({ amplitude: spec.amplitude, offset: spec.offset, pivot: spec.pivot })])))
  });
};

function eyes(build, name, description, shape) {
  const geometry = eyeGeometry({ ...shape, build });
  const artwork = `<g id="eyes-${build}" data-name="Eyes">${SIDES.map((side) => eyeMarkup(side, centre(side), geometry, PALETTE, { seam: null })).join('')}</g>`;
  const paletteRoles = Object.fromEntries(SIDES.flatMap((side) => [
    ...(geometry.white ? [[`eyeWhite${side}`, Object.freeze({ fill: 'eyeWhite' })]] : []),
    ...(geometry.iris ? [[`iris${side}`, Object.freeze({ fill: 'iris' })]] : []),
    [`pupil${side}`, Object.freeze({ fill: 'pupil' })],
    ...(geometry.rim ? [[`rim${side}`, Object.freeze({ stroke: 'outline' })]] : []),
    ...(geometry.lids ? [[`lidUpper${side}`, Object.freeze({ fill: 'skin' })], [`lidLower${side}`, Object.freeze({ fill: 'skin' })]] : [])
  ]));

  /**
   * The eyelids are a part of the rig, and a dot has none.
   *
   * On a dot the closing is the pupil flattening onto its own seam, so the
   * `eyes` part carries `eyeOpen` itself. With lids it is the lids that carry
   * it, and the eye keeps its own shape — which is what stops a blink from
   * squashing the white.
   */
  const lidPart = !geometry.lids ? Object.freeze({
    /**
     * A dot covers the eyelids and draws none.
     *
     * Declared with no roles on purpose. The planner refuses to replace a part
     * that is *drawn around* other parts unless the new asset covers them
     * (`planFacePartReplacement`), and a face with lids replaced by a pair of
     * dots has to lose them — a dot has no lid, and leaving four lid roles
     * pointing at artwork that has gone is the state that refusal exists to
     * prevent. So the dot says "the eyelids are mine, and there are none".
     */
    eyelids: Object.freeze({ roles: Object.freeze({}), capabilities: Object.freeze([]) })
  }) : Object.freeze({
    eyelids: Object.freeze({
      roles: Object.freeze(Object.fromEntries(SIDES.flatMap((side) => [
        [`${side.toLowerCase()}Upper`, `lidUpper${side}`], [`${side.toLowerCase()}Lower`, `lidLower${side}`]
      ]))),
      capabilities: Object.freeze(['eyeOpen']),
      /**
       * One control, two lids: the upper sweeps down and the lower comes up a
       * third as far, both about the rim they are drawn on. Their own side
       * offsets — which is what a wink is — are added by the rig when an author
       * asks for them, exactly as for any other generated binding
       * (docs/FACE_CONTROL_RIG.md §5).
       */
      drivers: Object.freeze({ eyeOpen: Object.freeze({
        ...eyeDrivers(geometry).lidUpper,
        roles: Object.freeze(Object.fromEntries(SIDES.flatMap((side) => [
          [`${side.toLowerCase()}Upper`, Object.freeze({ ...eyeDrivers(geometry).lidUpper })],
          [`${side.toLowerCase()}Lower`, Object.freeze({ ...eyeDrivers(geometry).lidLower })]
        ])))
      }) })
    })
  });

  return Object.freeze({
    id: `eyes.${build}`, category: 'eyes', name, description, origin: 'builtin',
    artwork,
    roles: Object.freeze({ leftEye: 'eyeLeft', rightEye: 'eyeRight' }),
    capabilities: Object.freeze(['eyeOpen']),
    /**
     * With lids, the eye barely moves when it blinks: the lids cover it and the
     * white keeps its shape, which is the socket's whole job done by a pivot
     * instead of by a hidden mask. *Barely*, not *not at all* — a real eye
     * squashes a little under a closing lid, which is the 0.88 the shipped sets
     * carried and which this keeps.
     *
     * It has to say so out loud. A part that claims `eyeOpen` and leaves the
     * driver out gets the registry's own (`scaleY`, amplitude 1, offset 0),
     * which reads 1 open and **0** shut: the eye group scaled to nothing, and
     * with it the pupil, the iris and both lids inside. Every child's CTM had a
     * vertical scale of zero, so a blink erased the eye instead of closing it.
     */
    drivers: Object.freeze(geometry.lids
      ? { eyeOpen: Object.freeze({ property: 'scaleY', amplitude: 0.12, offset: 0.88 }) }
      : { eyeOpen: driver('dot', geometry, { rolePrefix: 'Eye' }) }),
    parts: Object.freeze({
      gaze: Object.freeze({
        // The iris travels with the pupil that sits in it: a look that moved
        // only the dark centre would slide it out of its own iris, which is
        // why the iris is a role of the gaze rather than decoration.
        roles: Object.freeze({
          leftPupil: 'pupilLeft', rightPupil: 'pupilRight',
          ...(geometry.iris ? { leftIris: 'irisLeft', rightIris: 'irisRight' } : {})
        }),
        capabilities: Object.freeze(['lookX', 'lookY', 'pupilScale']),
        // How far the gaze may carry the pupil before its edge reaches the rim.
        drivers: Object.freeze({
          lookX: Object.freeze({ property: 'translateX', amplitude: geometry.travel, offset: 0 }),
          lookY: Object.freeze({ property: 'translateY', amplitude: round(geometry.travel * 0.7), offset: 0 })
        })
      }),
      ...lidPart
    }),
    paletteRoles: Object.freeze(paletteRoles),
    // The eye, and nothing but the eye. Every previous set reported a box three
    // times this tall, because its lids were parked outside a socket.
    referenceBox: Object.freeze({
      x: EYE_FRAME.left - geometry.rx, y: EYE_FRAME.cy - geometry.ry,
      width: (EYE_FRAME.right - EYE_FRAME.left) + geometry.rx * 2, height: geometry.ry * 2
    }),
    mountPoint: 'eyes',
    // The colours it actually paints, derived: a dot has no white, no lid and
    // no outline, and claiming those would be claiming a colour it never uses.
    palette: Object.freeze([...new Set(Object.values(paletteRoles).flatMap((entry) => Object.values(entry)))])
  });
}

export const EYES_DOT = eyes('dot', 'Dot', 'A pupil and nothing else. It flattens into a line to blink.', { pupil: 9 });
export const EYES_SIMPLE = eyes('simple', 'Simple', 'A white, a pupil and eyelids — the eye most mascots want.', { rx: 24, ry: 22.5, pupil: 10.5 });
export const EYES_IRIS = eyes('iris', 'Iris', 'A coloured iris inside the white, with the pupil in it.', { rx: 24, ry: 22.5, pupil: 7.5 });

export const EYE_SETS = Object.freeze([EYES_DOT, EYES_SIMPLE, EYES_IRIS]);
