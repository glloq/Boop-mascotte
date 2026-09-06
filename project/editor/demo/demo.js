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
  // A handle for the console — try `boopMascot.playMotion('head-turn')`.
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
  mount.addEventListener('click', () => { mascot.playMotion('head-nod'); say("playMotion('head-nod') — from a click on the mascot"); });

  window.addEventListener('pagehide', () => mascot.stop(), { once: true });
  say(`load({ mount, svg, rig }) — ${Object.keys(rig.params).length} parameters, ${Object.keys(rig.states).length} states, ${mascot.getMotions().length} motions`);
}

main().catch((error) => { say(`The demo could not start: ${error.message}`); throw error; });
