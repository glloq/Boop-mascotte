import { createMascotEngine } from '../../runtime/mascot-engine.js';

const rig = {
  schemaVersion: 3,
  params: { lookX: { min: -1, max: 1, default: 0, value: 0 } },
  states: { idle: { lookX: 0 }, happy: { lookX: 0.5 } }, activeState: 'idle', transitions: {},
  elements: { 'demo-eye': { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 90 }, bindings: { translateX: { expression: 'lookX', amplitude: 15 } } } }
};
const engine = createMascotEngine({ svgRoot: document.querySelector('#mascot svg'), rig });
document.querySelector('[aria-label="lookX"]').addEventListener('input', (event) => engine.setParam('lookX', Number(event.target.value)));
document.querySelectorAll('[data-state]').forEach((button) => button.addEventListener('click', () => engine.setState(button.dataset.state)));
engine.start();
window.addEventListener('pagehide', () => engine.stop(), { once: true });
