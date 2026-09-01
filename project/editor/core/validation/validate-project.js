import { validateRig } from './rig-validator.js';

export const VALIDATION_DOMAINS = Object.freeze(['artwork', 'rig', 'animation', 'states', 'behaviors', 'export']);

const issue = (id, severity, domain, message, target = null, fix = null) =>
  Object.freeze({ id, severity, domain, message, target, fix, blocking: severity === 'error' });

function domainFor(message) {
  if (/^Animation clip/i.test(message)) return 'animation';
  if (/^(State|Transition|Active state)/i.test(message)) return 'states';
  if (/^Behavior/i.test(message)) return 'behaviors';
  return 'rig';
}

function fixFor(domain, message) {
  if (domain === 'animation') return { workspace: 'animate', authorMode: 'animations' };
  if (domain === 'states') return { workspace: 'animate', authorMode: 'states' };
  if (domain === 'behaviors') return { workspace: 'animate', authorMode: 'behaviors' };
  const partId = message.match(/Semantic part "([^"]+)"/)?.[1] || null;
  return { workspace: 'rig', activeSemanticPartId: partId, rigTask: /Morph/i.test(message) ? 'calibrate' : 'setup' };
}

const stableKey = value => encodeURIComponent(String(value).replace(/\s+/g, '-'));

/** Pure, canonical V1 validation. It never normalizes or writes project data. */
export function validateProject(state) {
  const issues = [];
  if (!String(state?.svgMarkup || '').trim()) {
    issues.push(issue('artwork.missing', 'error', 'artwork', 'Add or import SVG artwork before saving or exporting.', null, { workspace: 'create' }));
  }
  validateRig(state || {}).forEach((message) => {
    const domain = domainFor(message);
    const entity=message.match(/^(?:Animation clip|State|Behavior|Element|Transition(?: setting| source| target)?)\s+"?([^":]+)"?/)?.[1]||'project';
    issues.push(issue(`${domain}.${stableKey(entity)}.${stableKey(message)}`, 'error', domain, message, { entity }, fixFor(domain, message)));
  });
  const names=Object.keys(state?.states||{}),configured=Object.keys(state?.transitions||{});
  if(names.length>1&&configured.length){const initial=state.activeState,seen=new Set([initial]),queue=[initial];while(queue.length){for(const target of state.transitions?.[queue.shift()]||[])if(!seen.has(target)){seen.add(target);queue.push(target);}}
    for(const name of names)if(!seen.has(name))issues.push(issue(`state.${stableKey(name)}.unreachable`,'warning','states',`"${name}" cannot be reached from initial State "${initial}".`,{stateId:name},{workspace:'animate',authorMode:'states',activeStateId:name}));
  }
  for(const behavior of state?.behaviors||[])if(behavior.enabled===false)issues.push(issue(`behavior.${stableKey(behavior.id)}.disabled`,'warning','behaviors',`Behavior "${behavior.name}" is configured but disabled.`,{behaviorId:behavior.id},{workspace:'animate',authorMode:'behaviors',activeBehaviorId:behavior.id}));
  if (state?.svgMarkup && !(state.animationClips || []).length)
    issues.push(issue('animation.optional.empty', 'info', 'animation', 'No animations yet. Animations are optional and remain in the editable project in V1.', null, { workspace: 'animate', authorMode: 'animations' }));
  if (state?.svgMarkup && !(state.behaviors || []).length)
    issues.push(issue('behaviors.optional.empty', 'info', 'behaviors', 'No automatic behaviors. Behaviors are optional.', null, { workspace: 'animate', authorMode: 'behaviors' }));
  return issues;
}

export const exportBlockingIssues = (issues) => issues.filter(({ severity }) => severity === 'error');

export function deriveProjectReadiness(state, issues = validateProject(state)) {
  return Object.fromEntries(VALIDATION_DOMAINS.map((domain) => {
    const domainIssues = issues.filter((entry) => entry.domain === domain || (domain === 'export' && entry.severity === 'error'));
    const status = domainIssues.some(({ severity }) => severity === 'error') ? 'error'
      : domainIssues.some(({ severity }) => severity === 'warning') ? 'warning' : 'ready';
    return [domain, Object.freeze({ status, issues: Object.freeze(domainIssues) })];
  }));
}
