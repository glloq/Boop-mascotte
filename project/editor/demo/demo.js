/**
 * The runtime demo, written the way a web page integrates a mascot.
 *
 * `runtime.js`, `mascot.svg` and `rig.json` are fetched from this folder — they
 * are the files Export writes for the untouched face template, produced at
 * build time (`scripts/demo-assets.mjs`) — and everything below goes through
 * the public API in `docs/RUNTIME_API.md`. Each call is echoed in the status
 * line so an integrator can read what the page just did.
 */
const here = new URL('.', document.baseURI);
const status = document.querySelector('#status');
const say = (text) => { status.textContent = text; };
const button = (label, onClick, attrs = {}) => {
  const node = document.createElement('button');
  node.type = 'button'; node.textContent = label; Object.assign(node.dataset, attrs);
  node.addEventListener('click', onClick);
  return node;
};
const format = (value) => (Math.round(value * 100) / 100).toString();

async function main() {
  // The runtime is one file next to the page; a bundler is not required.
  const { load } = await import(/* @vite-ignore */ new URL('runtime.js', here).href);
  const rig = await (await fetch(new URL('rig.json', here))).json();
  const mascot = await load({ mount: '#mascot', svg: new URL('mascot.svg', here).href, rig });
  // A handle for the console — try `boopMascot.playMotion('shake')`.
  window.boopMascot = mascot;

  /* ── States: guarded transitions, so only the reachable ones are offered ── */
  let currentState = rig.activeState;
  const states = document.querySelector('[data-states]');
  for (const name of Object.keys(rig.states)) {
    states.append(button(name, () => {
      if (!mascot.setState(name)) return say(`setState('${name}') → refused: no transition from '${currentState}'`);
      currentState = name; refreshStates(); say(`setState('${name}')`);
    }, { state: name }));
  }
  const refreshStates = () => {
    for (const node of states.querySelectorAll('button')) {
      const name = node.dataset.state, reachable = name === currentState || (rig.transitions[currentState] || []).includes(name);
      node.setAttribute('aria-pressed', String(name === currentState));
      node.disabled = !reachable;
      node.title = reachable ? '' : `No transition from '${currentState}' to '${name}'`;
    }
  };
  refreshStates();

  /* ── Motions: the clips authored in the editor ─────────────────────────── */
  const motions = document.querySelector('[data-motions]');
  for (const { id, name } of mascot.getMotions()) motions.append(button(name, () => { mascot.playMotion(id); say(`playMotion('${id}')`); }, { motion: id }));
  motions.append(button('Stop', () => { mascot.stopMotion(); say('stopMotion()'); }, { stopMotions: '' }));

  /* ── Controls: one slider per parameter, released with clearParameter ─── */
  // The per-side offsets (`lookXLeft`, `smileRight`, …) rest at 0 and only
  // matter when the two sides should disagree; they sit under a disclosure.
  const controls = document.querySelector('[data-controls]'), sides = document.querySelector('[data-side-controls]');
  const isSideOffset = (name) => /(Left|Right)$/.test(name) && name.replace(/(Left|Right)$/, '') in rig.params;
  const sliders = new Map();
  for (const [name, param] of Object.entries(rig.params)) {
    const row = document.createElement('div'); row.className = 'control';
    const label = document.createElement('label'); label.textContent = name; label.htmlFor = `param-${name}`;
    const output = document.createElement('output'); output.textContent = format(param.default);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', id: `param-${name}`, min: param.min, max: param.max, step: 0.01, value: param.default });
    input.addEventListener('input', () => {
      const value = Number(input.value);
      mascot.setParameter(name, value); output.textContent = format(value); say(`setParameter('${name}', ${format(value)})`);
    });
    row.append(label, output, input); (isSideOffset(name) ? sides : controls).append(row); sliders.set(name, { input, output, param });
  }
  const release = () => {
    for (const [name, { input, output, param }] of sliders) { mascot.clearParameter(name); input.value = param.default; output.textContent = format(param.default); }
  };
  document.querySelector('[data-release]').addEventListener('click', () => { release(); say('clearParameter(…) for every control'); });

  /* ── Face states: one set of artwork, eight eyes and nine visemes ──────── */
  /**
   * Everything here goes through the public API and nothing else:
   * `setParameter` for the eye states, `setViseme` and `blendVisemes` for the
   * speech. There is no second drawing anywhere — the mouth in `mascot.svg` is
   * one closed path and the eyes are one pair of lids
   * (docs/FACE_SVG_STATES.md, docs/VISEME_SYSTEM.md).
   *
   * The eight eye states are values for `eyeOpen`, `eyeSquint` and `eyeCurve`.
   * The side buttons write the *offsets* instead, which is what a wink is. And
   * not one of them names a gaze parameter, so looking somewhere first and then
   * striking a state keeps the look — which is the property worth checking by
   * hand, because it is the one a pose-per-state rig cannot have.
   */
  const EYE_STATES = {
    neutral: { eyeOpen: 1, eyeSquint: 0, eyeCurve: 0, pupilScale: 1 },
    wide: { eyeOpen: 1, eyeSquint: 0, eyeCurve: 0, pupilScale: 1.4 },
    'half open': { eyeOpen: .5, eyeSquint: 0, eyeCurve: 0 },
    closed: { eyeOpen: 0, eyeSquint: 0, eyeCurve: 0 },
    squint: { eyeOpen: .45, eyeSquint: .85, eyeCurve: 0 },
    'happy closed': { eyeOpen: 0, eyeSquint: 0, eyeCurve: 1 },
    tired: { eyeOpen: .38, eyeSquint: .3, eyeCurve: -.65 },
    suspicious: { eyeOpen: .5, eyeSquint: .7, eyeCurve: -.25 }
  };
  /** Write several movements, keeping the sliders above in step with them. */
  const setMany = (values) => {
    for (const [name, value] of Object.entries(values)) {
      if (!(name in rig.params)) continue;
      mascot.setParameter(name, value);
      const slider = sliders.get(name);
      if (slider) { slider.input.value = value; slider.output.textContent = format(value); }
    }
  };
  /** One eye's own offsets, from the pair's values. */
  const sideOffsets = (values, side) => Object.fromEntries(Object.entries(values)
    .map(([name, value]) => [`${name}${side}`, value - (rig.params[name]?.default ?? 0)])
    .filter(([name]) => name in rig.params));
  const SIDE_OFFSETS_AT_REST = { eyeOpenLeft: 0, eyeOpenRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, eyeCurveLeft: 0, eyeCurveRight: 0 };

  const eyeStateRow = document.querySelector('[data-eye-states]');
  for (const [name, values] of Object.entries(EYE_STATES)) {
    eyeStateRow.append(button(name, () => {
      setMany(values);
      say(`${name}: setParameter(${Object.keys(values).filter((key) => key in rig.params).join(', ')}) — the gaze is untouched`);
    }, { eyeState: name }));
  }
  const eyeSideRow = document.querySelector('[data-eye-side]');
  for (const [label, side] of [['Wink left', 'Left'], ['Wink right', 'Right'], ['Both together', '']]) {
    eyeSideRow.append(button(label, () => {
      if (!side) { setMany(SIDE_OFFSETS_AT_REST); say('every offset back at 0: one control for the pair'); return; }
      setMany({ eyeOpen: 1, ...SIDE_OFFSETS_AT_REST, ...sideOffsets(EYE_STATES.closed, side) });
      say(`wink: setParameter('eyeOpen${side}', -1) — the other eye does not move`);
    }, { eyeSide: side || 'both' }));
  }

  /**
   * The speech shapes. `setViseme` is `setExpression` with the naming rule
   * applied, so the mouth keeps whatever face is set rather than replacing it —
   * which is the whole of why *happy + AE* is a thing this mascot can be.
   */
  const visemes = mascot.getVisemes();
  const visemeRow = document.querySelector('[data-visemes]');
  const faceSelect = document.querySelector('[data-speech-face]');
  const visemeSelect = document.querySelector('[data-speech-viseme]');
  const blend = document.querySelector('[data-speech-blend]');
  const blendOut = document.querySelector('[data-speech-readout]');
  let spoken = { face: '', from: null, to: null };
  const showBlend = (value) => { blendOut.textContent = `${Math.round(Number(value) * 100)}%`; };
  const speak = () => {
    mascot.clearExpressions({ duration: 0 });
    if (spoken.face) mascot.setExpression(spoken.face, 1, { duration: 0 });
    const weight = Number(blend.value);
    showBlend(weight);
    if (spoken.from || spoken.to) mascot.blendVisemes(spoken.from, spoken.to, weight, { duration: 0 });
    say(`${spoken.face || 'no face'}${spoken.to ? ` + ${spoken.to}` : ''} — blendVisemes(${JSON.stringify(spoken.from)}, ${JSON.stringify(spoken.to)}, ${format(weight)})`);
  };
  for (const { key } of visemes) {
    visemeRow.append(button(key, () => {
      // The one pressed becomes the destination and the last one the origin, so
      // pressing two in a row is a transition an author can then scrub.
      spoken = { ...spoken, from: spoken.to, to: key };
      visemeSelect.value = key;
      blend.value = '1';
      speak();
    }, { viseme: key }));
  }
  faceSelect.append(new Option('none', ''));
  for (const item of rig.expressions.filter((expression) => !expression.viseme)) faceSelect.append(new Option(item.name, item.id));
  faceSelect.addEventListener('change', () => { spoken = { ...spoken, face: faceSelect.value }; speak(); });
  visemeSelect.append(new Option('none', ''));
  for (const { key } of visemes) visemeSelect.append(new Option(key, key));
  visemeSelect.addEventListener('change', () => { spoken = { ...spoken, from: spoken.to, to: visemeSelect.value || null }; speak(); });
  blend.addEventListener('input', speak);

  /** A sweep, so the AE → OO transition can be watched rather than reasoned about. */
  const sweep = (from, to, ms = 900) => {
    spoken = { ...spoken, from, to };
    visemeSelect.value = to;
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / ms);
      blend.value = String(t);
      showBlend(t);
      mascot.blendVisemes(from, to, t, { duration: 0 });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    say(`sweeping ${from} → ${to} over ${ms} ms: both weights live at once, never through rest`);
  };
  document.querySelector('[data-speech-sweep]').addEventListener('click', () => sweep('AE', 'OO'));

  /**
   * "Hello", as a lipsync would drive it: a list of visemes with a length each,
   * blended pairwise. This is not an audio engine and does not want to be — it
   * is the shape of the call a lipsync makes.
   */
  const SPOKEN_TRACK = [['MBP', 120], ['EE', 150], ['L', 130], ['OH', 190], ['OO', 170], ['REST', 200]];
  document.querySelector('[data-speech-say]').addEventListener('click', () => {
    const started = performance.now();
    const step = (now) => {
      let time = now - started, cursor = 0;
      while (cursor < SPOKEN_TRACK.length && time > SPOKEN_TRACK[cursor][1]) { time -= SPOKEN_TRACK[cursor][1]; cursor += 1; }
      if (cursor >= SPOKEN_TRACK.length) { spoken = { ...spoken, from: 'OO', to: 'REST' }; blend.value = '1'; showBlend(1); mascot.blendVisemes('OO', 'REST', 1, { duration: 0 }); return; }
      const from = cursor === 0 ? 'REST' : SPOKEN_TRACK[cursor - 1][0];
      const t = time / SPOKEN_TRACK[cursor][1];
      spoken = { ...spoken, from, to: SPOKEN_TRACK[cursor][0] };
      blend.value = String(t);
      showBlend(t);
      mascot.blendVisemes(from, SPOKEN_TRACK[cursor][0], t, { duration: 0 });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    say(`blendVisemes over a phoneme track — ${SPOKEN_TRACK.map(([key]) => key).join(' · ')}`);
  });

  document.querySelector('[data-face-reset]').addEventListener('click', () => {
    mascot.clearExpressions({ duration: 0 });
    spoken = { face: '', from: null, to: null };
    faceSelect.value = ''; visemeSelect.value = ''; blend.value = '1'; showBlend(1);
    setMany({ ...EYE_STATES.neutral, ...SIDE_OFFSETS_AT_REST, mouthOpen: 0, smile: 0, mouthWidth: 0, mouthRound: 0, teeth: 0, tongue: 0 });
    say('clearExpressions() and every movement back to rest');
  });

  /* ── Follow the pointer: the classic web-page integration ──────────────── */
  const mount = document.querySelector('#mascot');
  const follow = document.querySelector('[data-follow-pointer]');
  const onPointerMove = ({ clientX, clientY }) => {
    if (!follow.checked) return;
    const box = mount.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((clientX - box.left) / box.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((clientY - box.top) / box.height) * 2 - 1));
    for (const [name, value] of [['lookX', x], ['lookY', y], ['headX', x * .6], ['headY', y * .6]]) {
      mascot.setParameter(name, value);
      const slider = sliders.get(name); if (slider) { slider.input.value = value; slider.output.textContent = format(value); }
    }
  };
  window.addEventListener('pointermove', onPointerMove);
  follow.addEventListener('change', () => { if (!follow.checked) release(); say(follow.checked ? 'following the pointer with setParameter(lookX, lookY, headX, headY)' : 'clearParameter(…): the automatic gaze is back'); });

  /* ── Automatic: the idle life, switched per behaviour ──────────────────── */
  const behaviors = document.querySelector('[data-behaviors]');
  for (const { id, name, enabled } of rig.behaviors) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    Object.assign(input, { type: 'checkbox', checked: enabled }); input.dataset.behavior = id;
    input.addEventListener('change', () => { mascot.setBehaviorEnabled(id, input.checked); say(`setBehaviorEnabled('${id}', ${input.checked})`); });
    label.append(input, document.createTextNode(name)); behaviors.append(label);
  }

  /* ── The mascot itself: click to nod ───────────────────────────────────── */
  mount.addEventListener('click', () => { mascot.playMotion('nod'); say("playMotion('nod') — from a click on the mascot"); });

  window.addEventListener('pagehide', () => mascot.stop(), { once: true });
  say(`load({ mount, svg, rig }) — ${Object.keys(rig.params).length} parameters, ${Object.keys(rig.states).length} states, ${mascot.getMotions().length} motions`);
}

main().catch((error) => { say(`The demo could not start: ${error.message}`); throw error; });
