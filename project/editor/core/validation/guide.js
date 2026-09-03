/**
 * The guided journey (docs/GUIDED_JOURNEY.md).
 *
 * The editor already knew what was wrong (`validateProject`) and how ready each
 * task was (`deriveTaskReadiness`). What it never said is **what to do next**.
 * This is that one canonical answer: the ordered steps of building a mascot,
 * which of them are done, and the single next action with the route to reach it.
 *
 * Pure: it reads the document and a readiness model, and reports.
 */
import { deriveTaskReadiness } from './task-readiness.js';

/**
 * The journey, in the order the roadmap describes it. `required: false` steps
 * count towards progress but never block the guide from reporting "ready".
 */
export const GUIDE_STEPS = Object.freeze([
  Object.freeze({
    id: 'artwork', label: 'Add artwork', required: true,
    hint: 'Start from a template or import an SVG.',
    route: { task: 'artwork' },
    done: (document) => Boolean(String(document?.svgMarkup || '').trim())
  }),
  Object.freeze({
    id: 'face-parts', label: 'Assign the face parts', required: true,
    hint: 'Click each part of the face on the canvas.',
    route: { task: 'face-setup', focus: 'face-setup-checklist' },
    done: (document, readiness) => readiness.faceSetup.status === 'ready'
  }),
  Object.freeze({
    id: 'movements', label: 'Turn on the movements', required: true,
    hint: 'Choose what the face can do, then calibrate it by posing the artwork.',
    route: { task: 'face-setup', focus: 'face-movements' },
    done: (document, readiness) => readiness.movements.status === 'ready' || readiness.movements.status === 'warning'
  }),
  Object.freeze({
    id: 'head-pose', label: 'Turn the head', required: false,
    hint: 'Capture the face at a few head positions; Boop blends between them.',
    route: { task: 'face-setup', focus: 'head-pose' },
    done: (document) => (document?.keyforms || []).some((item) => String(item.id).startsWith('headPose:'))
  }),
  Object.freeze({
    id: 'hands', label: 'Add floating hands', required: false,
    hint: 'Two hands that hang off the body, with poses like Wave.',
    route: { task: 'face-setup', focus: 'hand-setup' },
    done: (document) => Boolean(document?.hands?.left?.element || document?.hands?.right?.element)
  }),
  Object.freeze({
    id: 'expressions', label: 'Create an expression', required: false,
    hint: 'Name a face — Happy, Sad, Surprised — and shape it.',
    route: { task: 'expressions' },
    done: (document) => (document?.expressions || []).length > 0
  }),
  Object.freeze({
    id: 'motions', label: 'Add a motion', required: false,
    hint: 'A nod, a bounce, a look around.',
    route: { task: 'animate' },
    done: (document) => (document?.animationClips || []).length > 0
  }),
  Object.freeze({
    id: 'automatic', label: 'Bring it to life', required: false,
    hint: 'Blink, eye wander and idle movement run on their own.',
    route: { task: 'animate', focus: 'automatic-panel' },
    done: (document) => (document?.behaviors || []).length > 0
  }),
  Object.freeze({
    id: 'reactions', label: 'React to a click', required: false,
    hint: 'When clicked → an expression, a motion and a hand gesture.',
    route: { task: 'reactions' },
    done: (document) => (document?.reactions || []).length > 0
  }),
  Object.freeze({
    id: 'preview', label: 'Try it out', required: false,
    hint: 'Test everything together. Nothing here changes the project.',
    route: { task: 'preview' },
    // Reached rather than completed: it is done once there is something to try.
    done: (document, readiness) => readiness.export.status !== 'error' && (document?.expressions || []).length > 0
  })
]);

/**
 * @param {object} document
 * @param {object} [readiness] the memoized `deriveTaskReadiness` model
 * @returns {{ steps: object[], next: object|null, blocker: object|null,
 *            done: number, total: number, required: number, complete: boolean }}
 */
export function deriveGuide(document = {}, readiness = deriveTaskReadiness(document)) {
  const steps = GUIDE_STEPS.map((step) => ({
    id: step.id, label: step.label, hint: step.hint, required: step.required,
    route: step.route, done: Boolean(step.done(document, readiness))
  }));
  const firstPending = steps.find((step) => !step.done) || null;
  for (const step of steps) step.current = step === firstPending;

  // A blocking problem outranks the next step: there is no point suggesting an
  // expression while the project cannot be exported at all.
  const blocker = readiness.export.status === 'error'
    ? { id: 'blocker', label: readiness.export.action || 'Fix the blocking problem', hint: readiness.export.summary, route: readiness.export.route, issueId: readiness.export.issueId }
    : null;

  return {
    steps,
    next: blocker || firstPending,
    blocker,
    done: steps.filter((step) => step.done).length,
    total: steps.length,
    required: steps.filter((step) => step.required).length,
    complete: steps.every((step) => step.done)
  };
}

/** One short line for the guide bar: what to do, and how far along it is. */
export function guideSummary(guide) {
  if (!guide.next) return `All ${guide.total} steps done — export when you are ready.`;
  return `Step ${Math.min(guide.done + 1, guide.total)} of ${guide.total} · ${guide.next.label}`;
}
