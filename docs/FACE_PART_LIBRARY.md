# Face part library

> The Character Builder's parts come from a library, and the library is a
> registry of *assets*: a description of a piece of artwork and of the
> semantic part it becomes. Roadmap phase 2, delivered as **PR 2 — Face Part
> Registry**.

This page is the data model and the registry. Installing an asset onto a
mascot (PR 3), fitting it to the face (PR 4), showing it as a thumbnail and
replacing it from the builder are the PRs that follow; each of them reads what
is described here and adds nothing to it.

## Why a registry

The editor could already add whole parts: `FACE_FEATURES` (`core/sample/face-features.js`)
holds the eyebrows and the eyelids as artwork plus roles plus controls plus a
reference box, and one command installs one of them. That is the shape of an
asset, and it was written twice by hand. The library generalises it: any
number of assets, in any category, validated the same way, registered by the
editor or by a pack, and read by one installer.

The rule that makes this safe (roadmap phase 4): **the runtime never sees an
asset.** It sees the semantic part the asset becomes — `mouth`, with the
control `smile` — so `smile = 0.8` means the same thing on `mouth.simple`,
`mouth.wide` and every mouth anyone draws later.

## An asset

```js
{
  id: 'mouth.wide',                  // category.name: lower case, digits, dashes
  category: 'mouth',                 // one of FACE_PART_CATEGORIES
  name: 'Wide',
  description: 'A wide grin with a row of teeth.',
  artwork: '<g id="mouth-wide">…</g>',   // one SVG fragment, one root element
  roles: { mouth: 'mouth', teeth: 'teeth' },   // role → id inside the artwork
  capabilities: ['mouthOpen', 'smile', 'mouthWidth', 'teeth'],
  referenceBox: { x: 80, y: 168, width: 80, height: 22 },   // what it was drawn against
  mountPoint: 'mouth.center',        // where it mounts; the category's default when omitted
  palette: ['mouth', 'teeth'],       // the colour tokens it uses
  origin: 'builtin'                  // or 'custom'
}
```

| Field | Meaning |
| --- | --- |
| **id** | `category.name`. The category first, so a listing sorts by it and a mismatch is visible. |
| **category** | What a person calls the part. Decides the semantic part, the roles it may name and the movements it may claim. |
| **artwork** | An SVG fragment drawn in the template face's frame (240 × 240). One root element, usually a `<g>`; ids unique within it. |
| **roles** | Which shape plays which role of the semantic part. Every required role of the part must be named; one shape plays one role. |
| **capabilities** | The movements this drawing carries. A subset of the part's controls; what is left out is *Limited animation* (roadmap phase 26), reported as a warning and shown on the badge. |
| **referenceBox** | The box the artwork was drawn against. Auto-fit (PR 4) maps it onto the measured box of the face it joins, the way `fitFeatureArtwork` already does for the eyebrows. |
| **mountPoint** | One of `FACE_MOUNT_POINTS` (roadmap phase 5): `head.top`, `head.center`, `head.bottom`, `eyes`, `eye.left`, `eye.right`, `brows`, `brow.left`, `brow.right`, `nose.center`, `mouth.center`, `ears`, `ear.left`, `ear.right`, `hair.top`. Names only for now; the layout context resolves them. |
| **palette** | The colour tokens the artwork uses, from `PALETTE_TOKENS` (roadmap phase 9): `skin`, `skinShadow`, `outline`, `hair`, `hairShadow`, `eyeWhite`, `pupil`, `mouth`, `tongue`, `teeth`, `accessoryPrimary`, `accessorySecondary`. Declared now, wired to the swatches in PR 8. |

`normalizeFacePart` fills the defaults and freezes the result; it never
refuses anything. `validateFacePart` does the refusing.

## Categories

The categories read the semantic part registry (`rig-editor/semantic-parts/part-registry.js`)
rather than repeating it: the roles a category's assets may name, the ones
they must name and the movements they may claim are the part's own, so a
control added to the rig is a control an asset may claim with nothing to
update in the library. The Character Builder lists the same categories, in the
same order, from the same table.

| Category | Semantic part | Required roles | Default mount |
| --- | --- | --- | --- |
| head | `head` | head | head.center |
| eyes | `eyes` | leftEye, rightEye | eyes |
| pupils | `gaze` | leftPupil, rightPupil | eyes |
| eyelids | `eyelids` | all four lids | eyes |
| eyebrows | `eyebrows` | leftBrow, rightBrow | brows |
| nose | `nose` | nose | nose.center |
| mouth | `mouth` | mouth (cavity, teeth, tongue optional) | mouth.center |
| ears | `ears` | leftEar, rightEar | ears |
| hair | `hair` | hair (hairTop, hairBack optional) | head.top |
| facialHair | — (roadmap phase 11) | — | mouth.center |
| accessory | `accessory` | element | head.center |

Facial hair has no semantic part yet. An asset can be described under it and
is listed, with the warning `not-installable`; the part, or the extension of
the accessory part, arrives with PR 9.

## Validation

`validateFacePart(asset, { taken })` returns `{ ok, asset, issues, errors, warnings }`.
Every issue carries a `code`, a `message` a person can act on, and the `field`
it is about. Errors keep an asset out of a registry; warnings let it in.

| Code | Severity | Means |
| --- | --- | --- |
| `id-missing`, `id-format`, `id-category`, `id-taken` | error | the id is absent, malformed, names the wrong category, or is already registered |
| `category-unknown` | error | not one of the eleven |
| `not-installable` | warning | the category has no semantic part yet |
| `name-missing` | error | nothing for a person to read |
| `artwork-missing`, `artwork-malformed` | error | no fragment; not well formed; more or less than one root; a whole `<svg>` document |
| `artwork-unsafe` | error | a script, a `foreignObject`, an event handler, an external reference, external CSS or a `javascript:` URL — one issue each |
| `artwork-duplicate-id` | error | an id drawn twice inside the fragment |
| `role-unknown`, `role-artwork-missing`, `role-required-missing`, `role-shared` | error | a role the part has not got; a role naming no shape; a required role left out; one shape playing two roles |
| `capability-unsupported` | error | a movement the part has not got |
| `capabilities-incomplete` | warning | *Limited animation*: movements the part has that this drawing does not claim |
| `mount-point-unknown`, `reference-box-invalid`, `palette-token-unknown` | error | outside the known vocabularies, or a box with no area |

### One sanitizer

The executable-content check is the sanitizer's own rules, not a second list
(roadmap phase 31). `findUnsafeSvg(markup)` in `core/security/sanitize-svg.js`
*names* every removal `sanitizeSvgMarkup` would make, sharing its two
predicates, and cleans nothing. Validation reports what it names; installing
the artwork still runs it through `sanitizeSvgMarkup`, as every fragment the
canvas appends already is.

## The registry

```js
import { FACE_PART_LIBRARY, registerFacePart, registerAccessory, createFacePartRegistry } from 'core/face-library/face-part-registry.js';

FACE_PART_LIBRARY.list('mouth');          // the assets of one category, in registration order
FACE_PART_LIBRARY.categories();           // every category with its count
registerFacePart(asset);                  // from a pack or a plugin (roadmap phase 44); throws FacePartError with .issues
registerAccessory({ id: 'accessory.round-glasses', … });
createFacePartRegistry();                 // a registry of one's own, for a test or a pack
```

A registry validates on the way in and stores the normalised, frozen asset.
`registerMany` is all or nothing: a pack with one bad asset registers none of
them, and says which. Nothing in the registry touches a document; installing
is a command over the document, and that command is PR 3.

## The built-in assets

Three, on purpose — enough to prove the registry on a category with optional
roles and on a single-shape category, and no more until they can be
installed:

| Asset | Roles | Carries | Says it lacks |
| --- | --- | --- | --- |
| `mouth.simple` | mouth | mouthOpen, smile, mouthWidth | teeth, tongue |
| `mouth.wide` | mouth, teeth | mouthOpen, smile, mouthWidth, teeth | tongue |
| `nose.dot` | nose | noseScrunch | — |

They live in `core/face-library/builtin/`, one file per asset, drawn in the
template face's frame so the same reference boxes fit them onto any face.
The V1 library of the roadmap (phase 45) grows this folder.

## Files

```text
project/editor/core/face-library/
  face-part-model.js        categories, mount points, palette tokens, normalize, the artwork scanner, capabilities
  face-part-validation.js   validateFacePart and its codes
  face-part-registry.js     createFacePartRegistry, FACE_PART_LIBRARY, registerFacePart, registerAccessory
  builtin/                  mouth-simple.js, mouth-wide.js, nose-dot.js, index.js
project/editor/core/security/sanitize-svg.js   findUnsafeSvg
project/editor/core/tests/face-part-model.test.js
project/editor/core/tests/face-part-validation.test.js
project/editor/core/tests/face-part-registry.test.js
```

## What is deliberately not here yet

- **Installing** (PR 3, `replaceFacePart`): id remapping on collision, role
  assignment, control enabling, one undo step.
- **The layout context and auto-fit** (PR 4): mount points as coordinates.
- **Thumbnails** (roadmap phase 23): generated from the artwork and the
  reference box, never kept as a second file.
- **Instances and overrides** (phase 15), **presets** (phase 13), **palette
  roles** (phase 9), **custom parts from a selection** (phase 27).
