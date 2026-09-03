/**
 * Head Pose panel (docs/HEAD_POSE_2_5D.md).
 *
 * A 3×3 grid of cells and a live XY pad. The author poses the mascot on the
 * canvas at a cell and presses Capture; the grid interpolates the rest.
 *
 * The panel owns no pose data: it reads the keyform list and writes through
 * atomic commands, so undo, redo and cancel all work without it participating.
 */
import { createHeadPoseCommands } from '../../core/head-pose/head-pose-commands.js';
import {
  createHeadPoseAxes, headPoseSummary, headPoseElements, headPoseCellSamples,
  copyHeadPoseCell, HEAD_POSE_CHANNELS
} from '../../core/head-pose/head-pose-model.js';
import { padValueFromPoint, padPointFromValue, padKeyboardValue, padCenter } from '../../core/head-pose/head-xy-pad.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** The arrow that describes a cell, so the grid reads as directions. */
export function cellArrow(x, y) {
  if (x === 0 && y === 0) return '●';
  const row = y > 0 ? 0 : y < 0 ? 2 : 1;
  const column = x < 0 ? 0 : x > 0 ? 2 : 1;
  return [['↖', '↑', '↗'], ['←', '●', '→'], ['↙', '↓', '↘']][row][column];
}

const STATE_LABEL = { empty: 'not captured', neutral: 'neutral', captured: 'captured' };

/**
 * @param {Element} host
 * @param {object} options
 * @param {(ids: string[], handlers: {capture: Function, cancel: Function}) => boolean} options.beginPose
 *        Starts a transient pose session on the canvas. Capture reads what the
 *        author moved; nothing is authored until they press Capture, and
 *        cancelling restores the artwork exactly.
 * @param {() => void} options.cancelPose
 * @param {(values: Record<string, number>) => void} options.onPreview
 */
export function createHeadPosePanel(host, store, history, { beginPose = () => false, cancelPose = () => {}, onPreview = () => {}, pairs = () => ({}) } = {}) {
  if (!host) throw new Error('Missing required UI element: #head-pose');
  const commands = createHeadPoseCommands(store, history);
  const axes = createHeadPoseAxes();
  let cell = { i: 1, j: 1 };
  let clipboard = null;
  let notice = null;
  let live = padCenter(axes);
  let dragging = false;
  let posing = false;

  const doc = () => store.getDocument();
  const keyforms = () => doc().keyforms || [];
  const say = (tone, text) => { notice = { tone, text }; };

  function preview(values) {
    live = { ...values };
    onPreview({ ...live });
  }

  function padRect() {
    const pad = host.querySelector('[data-head-pad]');
    return pad ? pad.getBoundingClientRect() : null;
  }

  function pointerValue(event) {
    const rect = padRect();
    if (!rect) return live;
    return padValueFromPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height }, axes);
  }

  host.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-head-pad]') && event.button === 0) {
      dragging = true;
      event.target.setPointerCapture?.(event.pointerId);
      preview(pointerValue(event));
      render();
      event.preventDefault();
    }
  });
  host.addEventListener('pointermove', (event) => { if (dragging) { preview(pointerValue(event)); render(); } });
  host.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    event.target.releasePointerCapture?.(event.pointerId);
  });

  host.addEventListener('keydown', (event) => {
    if (!event.target.closest('[data-head-pad]')) return;
    const next = padKeyboardValue(live, event.key, { axes, coarse: event.shiftKey });
    if (!next) return;
    event.preventDefault();
    preview(next);
    render();
  });

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const target = button.dataset;
    if (target.headCell !== undefined) {
      const [i, j] = target.headCell.split(',').map(Number);
      cell = { i, j };
      preview({ [axes.x.parameter]: axes.x.values[i], [axes.y.parameter]: axes.y.values[j] });
      notice = null;
      render();
      return;
    }
    if (target.headAction === 'capture') startCapture();
    if (target.headAction === 'cancel-capture') { posing = false; cancelPose(); say('ok', 'Pose cancelled. Nothing changed.'); }
    if (target.headAction === 'reset-cell') { commands.resetCell(cell, { axes }); say('ok', 'This pose is cleared.'); }
    if (target.headAction === 'reset-all') { commands.reset({ axes }); say('ok', 'Every pose is cleared.'); }
    if (target.headAction === 'copy') {
      clipboard = copyHeadPoseCell(keyforms(), axes, cell);
      say(clipboard ? 'ok' : 'warn', clipboard ? 'Pose copied.' : 'There is nothing captured here to copy.');
    }
    if (target.headAction === 'paste') {
      if (!clipboard) say('warn', 'Copy a pose first.');
      else { commands.paste(cell, clipboard, { axes }); say('ok', 'Pose pasted.'); }
    }
    if (target.headAction === 'mirror') {
      if (commands.mirror({ axes, pairs: pairs() })) say('ok', 'Mirrored to the other side.');
      else say('warn', 'Capture at least one pose before mirroring.');
    }
    render();
  });

  /** Elements the author may pose: the ones already in the grid, else all of them. */
  function poseCandidates() {
    const inGrid = headPoseElements(keyforms(), axes);
    return inGrid.length ? inGrid : Object.keys(doc().elements || {});
  }

  function startCapture() {
    const ids = poseCandidates();
    if (!ids.length) { say('warn', 'Import or draw some artwork first.'); return; }
    const started = beginPose(ids, {
      capture: (posed) => {
        posing = false;
        const count = Object.keys(posed || {}).length;
        if (count && commands.capture(cell, posed, { axes })) say('ok', `Captured ${count} part${count === 1 ? '' : 's'} here.`);
        else say('warn', 'Nothing could be captured here.');
        render();
      },
      cancel: () => { posing = false; say('ok', 'Pose cancelled. Nothing changed.'); render(); }
    });
    if (!started) { say('warn', 'The canvas is busy with another tool. Finish it first.'); return; }
    posing = true;
    say('ok', 'Move the artwork into position on the canvas, then press Capture.');
  }

  function render() {
    const summary = headPoseSummary(keyforms(), axes);
    const parts = headPoseElements(keyforms(), axes);
    const active = summary.find((item) => item.i === cell.i && item.j === cell.j) || summary[0];
    const samples = headPoseCellSamples(keyforms(), axes, cell);
    const point = padPointFromValue(live, { width: 100, height: 100 }, axes);
    // Rows are drawn top-down, so the highest Y comes first.
    const rows = [...new Set(summary.map((item) => item.j))].sort((a, b) => b - a);

    host.dataset.headPoseReady = 'true';
    host.dataset.headPosePosing = String(posing);
    host.dataset.headPoseCaptured = String(summary.filter((item) => item.state !== 'empty').length);
    host.innerHTML = `
      <h3>Head pose</h3>
      <p class="small">Turn the head by posing it at each position. Between positions Boop blends what you captured.</p>
      <div class="head-pose-grid" role="grid" aria-label="Head pose positions">
        ${rows.map((j) => `<div role="row">${summary.filter((item) => item.j === j).map((item) => `
          <button type="button" role="gridcell" data-head-cell="${item.i},${item.j}" data-head-state="${item.state}"
            aria-pressed="${item.i === cell.i && item.j === cell.j}"
            aria-label="Head ${item.x} across, ${item.y} up. ${STATE_LABEL[item.state]}${item.elements ? `, ${item.elements} part${item.elements === 1 ? '' : 's'}` : ''}"
            title="${esc(STATE_LABEL[item.state])}">${cellArrow(item.x, item.y)}</button>`).join('')}</div>`).join('')}
      </div>
      <div class="head-pose-actions">
        <button type="button" data-head-action="capture"${posing ? ' disabled' : ''}>Capture</button>
        ${posing ? '<button type="button" class="secondary" data-head-action="cancel-capture">Cancel</button>' : ''}
        <button type="button" class="secondary" data-head-action="reset-cell">Reset</button>
        <button type="button" class="secondary" data-head-action="copy">Copy</button>
        <button type="button" class="secondary" data-head-action="paste"${clipboard ? '' : ' disabled'}>Paste</button>
        <button type="button" class="secondary" data-head-action="mirror">Mirror</button>
        <button type="button" class="secondary" data-head-action="reset-all">Reset all</button>
      </div>
      <p class="small" data-head-cell-summary>${active ? `${esc(STATE_LABEL[active.state])}${active.elements ? ` · ${active.elements} part${active.elements === 1 ? '' : 's'}` : ''}` : ''}</p>
      ${notice ? `<p class="workspace-hint" data-tone="${notice.tone}" role="status">${esc(notice.text)}</p>` : ''}
      <div class="head-pose-pad">
        <div class="head-pad" data-head-pad tabindex="0" role="application"
          aria-label="Head direction pad. Arrow keys move, Home recentres."
          aria-valuetext="${axes.x.parameter} ${round(live[axes.x.parameter])}, ${axes.y.parameter} ${round(live[axes.y.parameter])}">
          <span class="head-pad-handle" style="left:${point.x}%;top:${point.y}%"></span>
        </div>
        <p class="small" data-head-live>${esc(axes.x.parameter)} ${round(live[axes.x.parameter])} · ${esc(axes.y.parameter)} ${round(live[axes.y.parameter])}</p>
      </div>
      <details class="head-pose-parts"${parts.length ? '' : ' hidden'}>
        <summary>${parts.length} part${parts.length === 1 ? '' : 's'} in this pose</summary>
        <ul class="small">${parts.map((id) => `<li data-head-part="${esc(id)}">${esc(id)}${samples[id] ? ` · ${Object.keys(samples[id]).filter((key) => HEAD_POSE_CHANNELS.includes(key) || key.startsWith('shape:')).length} channel${Object.keys(samples[id]).length === 1 ? '' : 's'} here` : ''}</li>`).join('')}</ul>
      </details>`;
  }

  return {
    render,
    getCell: () => ({ ...cell }),
    getLiveParams: () => ({ ...live }),
    /** Exposed for the preview panel and for tests. */
    setCell(next) { cell = { ...next }; render(); },
    axes
  };
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
