# Runtime API

The exported runtime is **one standalone file**. Drop it next to a page with
the mascot's SVG and its `rig.json`, and that is the whole integration.

```js
import * as BoopMascot from './runtime.js';

const mascot = await BoopMascot.load({ mount: '#mascot', svg: 'mascot.svg', rig: 'rig.json' });

mascot.setExpression('happy');
mascot.playMotion('wave');
mascot.triggerReaction('hello');
mascot.setParameter('headX', 0.5);
mascot.setParameter('handRX', 0.7);
```

## `load(options)`

| Option | Meaning |
| --- | --- |
| `mount` | element or selector to put the mascot in |
| `svg` | a URL, or the markup itself |
| `rig` | a URL, or the rig object itself |
| `autoStart` | start the loop (default `true`) |
| `bindEvents` | listen for click and hover (default `true`) |
| … | anything `createMascotEngine` takes: `fps`, `random`, `requestFrame`, … |

`svg` and `rig` each accept a URL *or* the value, so a page with the markup
already inline fetches nothing. A `mount` that matches nothing throws a message
naming the selector rather than something cryptic. `bindEvents: true` returns
the unbinder as `mascot.unbindEvents`.

## Methods

| Method | Does |
| --- | --- |
| `setParameter(name, value)` / `clearParameter(name)` | live control; an unknown name is refused, not invented |
| `setExpression(id, weight, { duration })` | set an expression's target weight |
| `transitionToExpression(id, { duration })` | cross-fade to one expression from whatever is showing |
| `clearExpression(id)` / `clearExpressions()` | let expressions go |
| `getExpressions()` / `getExpressionWeights()` | targets asked for / weights showing |
| `playMotion(id, { layer, fade, easing })` | cross-fade to a motion from whatever is playing; `layer: true` runs it alongside |
| `stopMotion(id?, { fade, easing })` | fade one motion out, or every motion |
| `getMotions()` / `getMotionWeights()` | the catalogue / the weights showing right now |
| `triggerReaction(idOrEvent, detail)` | fire a reaction by id, or by the event that triggers it |
| `setHandPose(side, poseId, weight)` / `getHandPoses(side)` | raise a hand pose directly |
| `setHandInertiaEnabled(side, enabled)` | switch cartoon lag off or on |
| `setState(name)` | move to another state, continuously from the current pose |
| `setBehaviorEnabled(id, enabled)` | switch an idle behaviour |
| `start()` / `stop()` | the render loop |
| `isSettled()` | whether anything is still moving |

`setParam` / `playAnimation` / `trigger` / `fire` remain as they were: the
friendly names are aliases, and nothing that worked before V2 has changed.

## Cross-fades

Two spans live on the rig, and both default to 0, which is the pre-V2 instant
switch — a rig that declares neither behaves exactly as it always did.

| Field | Governs |
| --- | --- |
| `expressionBlend: { duration, easing }` | how long one expression takes to become another (`docs/CONTINUOUS_TRANSITIONS.md`) |
| `motionBlend: { duration, easing }` | how long one motion takes to become another, and how a motion fades out at its end (`docs/ADR_MOTION_LAYERING.md`) |

`playMotion` and `stopMotion` take `fade` and `easing` to override
`motionBlend` for one call. Both are authored in the editor — under the
expression list and under the motion list respectively.

## What the runtime does not contain

No editor UI, no undo, no inspectors, no gizmos, no authoring commands, no
Playwright. A test loads the exported bundle standalone from a `data:` URL and
asserts that no runtime module imports editor code — the authoring/runtime line
is enforced, not just intended.

## Size

| Artifact | Raw | Gzip |
| --- | --- | --- |
| `runtime.js` | 46.7 kB | 16.2 kB |

See `docs/RUNTIME_PERFORMANCE.md` for what a frame costs.
