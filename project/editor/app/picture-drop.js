/**
 * Dropping a picture onto the mascot.
 *
 * The first thing anyone tries with a file, and the thing the plan asked for
 * beside the button ("Drop / Browse"). A button alone works and still reads as
 * a missing feature, because the gesture people reach for first does nothing.
 *
 * Deliberately narrow about what it claims. The canvas already accepts a drag
 * from the part library (`ui/character-builder/part-drag.js`), which carries
 * its own data type; a file drag carries `Files`, so the two never contend and
 * neither has to know about the other. And a drag carrying something else --
 * text, a link, a spreadsheet -- is left alone entirely rather than
 * intercepted and then refused, so the browser's own behaviour still happens.
 */

const IMAGE_TYPES = new Set(['image/png', 'image/webp', 'image/svg+xml']);
const IMAGE_EXTENSIONS = /\.(png|webp|svg)$/i;

/** Whether a drag is carrying files at all. Types is all a `dragover` may look at. */
export const carriesFiles = (dataTransfer) => Array.from(dataTransfer?.types || []).includes('Files');

/**
 * The pictures in a drop, in the order they were dropped.
 *
 * By type where the browser gave one and by extension where it did not --
 * some platforms hand over an empty type for an SVG. Anything else is left
 * out and counted, so a folder of holiday photos dropped by accident is one
 * clear sentence rather than twelve refusals.
 */
export function picturesIn(dataTransfer) {
  const files = Array.from(dataTransfer?.files || []);
  const pictures = files.filter((file) => IMAGE_TYPES.has(file.type) || (!file.type && IMAGE_EXTENSIONS.test(file.name || '')));
  return { pictures, rejected: files.length - pictures.length };
}

/**
 * @param {Element} host the canvas, or whatever the mascot is drawn in
 * @param {object} options
 * @param {() => boolean} options.isReady whether there is a project to drop onto
 * @param {(file: File) => Promise<unknown>} options.onPicture
 * @param {(message: string, tone?: string) => void} [options.setStatus]
 * @param {string} [options.activeClass] a class while a picture is over the canvas
 * @returns {() => void} stop listening
 */
export function createPictureDrop(host, { isReady = () => true, onPicture, setStatus = () => {}, activeClass = 'picture-drop-over' } = {}) {
  if (!host || typeof onPicture !== 'function') return () => {};
  let depth = 0;
  const leave = () => { depth = 0; host.classList?.remove(activeClass); };

  const wanted = (event) => carriesFiles(event.dataTransfer) && isReady();
  const over = (event) => {
    if (!wanted(event)) return;
    // Both are required, and for different reasons: without `dragover` the
    // browser refuses the drop, and without `dragenter` the cursor never says
    // the drop is allowed.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const enter = (event) => { if (!wanted(event)) return; event.preventDefault(); depth += 1; host.classList?.add(activeClass); };
  const out = (event) => { if (!wanted(event)) return; depth -= 1; if (depth <= 0) leave(); };

  const drop = async (event) => {
    if (!wanted(event)) return;
    event.preventDefault();
    leave();
    const { pictures, rejected } = picturesIn(event.dataTransfer);
    if (!pictures.length) {
      setStatus(rejected === 1 ? 'That file is not a picture this editor can read — PNG, WebP or SVG.' : `None of those ${rejected} files is a picture this editor can read — PNG, WebP or SVG.`, 'error');
      return;
    }
    // One at a time and in order, so several dropped together land in the
    // order they were dropped and each is its own undo step.
    for (const file of pictures) await onPicture(file);
    if (rejected) setStatus(`${rejected} of those files ${rejected === 1 ? 'was' : 'were'} not a picture, and ${rejected === 1 ? 'it was' : 'they were'} left out.`, 'warn');
  };

  const listeners = [['dragenter', enter], ['dragover', over], ['dragleave', out], ['drop', drop]];
  for (const [type, handler] of listeners) host.addEventListener(type, handler);
  return () => { for (const [type, handler] of listeners) host.removeEventListener(type, handler); leave(); };
}
