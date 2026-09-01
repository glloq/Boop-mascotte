# v1 release checklist

- [ ] `npm ci`, unit tests, verification and production build pass.
- [ ] Critical Chromium user journeys and Firefox/WebKit smoke tests pass.
- [ ] Extended Chromium scenarios have been reviewed in the scheduled/manual workflow; they do not block routine pushes.
- [ ] GitHub Pages environment uses the Actions deployment source.
- [ ] Sample, SVG import, preview and browser console are clean.
- [ ] Project save/open and autosave recovery work.
- [ ] SVG, rig and runtime exports download and validate.
- [ ] The standalone runtime demo responds to parameters and states.
- [ ] Desktop, tablet and mobile layouts keep critical actions reachable.
- [ ] Malicious SVG fixture is sanitized; runtime contains no dynamic evaluation.
- [ ] README, user guide, format documentation and limitations are current.

Do not tag `v1.0.0` until every required item is checked on the deployed artifact.

## Current public-UX checks

- [ ] Exercise only visible Create/Rig/Animate/Preview controls (hidden file inputs are allowed behind visible picker labels).
- [ ] Download `mascot.svg`, `rig.json`, and `runtime.js` through their three explicit artifact buttons in every browser.
- [ ] Confirm project replacement clears selection, semantic/control focus, timeline focus, preview overrides, and playback.
- [ ] Confirm `/Boop-mascotte/` and `/Boop-mascotte/demo/` on the deployed Pages URL.
