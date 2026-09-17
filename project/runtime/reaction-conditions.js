/**
 * The **IF** in `WHEN → IF → DO`.
 *
 * A reaction has always had a when (its trigger) and a do (its clip): the
 * missing third is "and only if". A click that plays a wave whatever the
 * mascot is doing is a mascot with one answer; a click that waves only when it
 * is idle, and shrugs when it is already busy, is a mascot with two
 * (docs/V4_ROADMAP.md, Phase 9).
 *
 * **Adding one is not safely additive, and that is the whole design.** A
 * runtime that does not know about conditions does not skip the reaction -- it
 * fires it unconditionally, which is the reaction behaving as something else.
 * That is exactly what VNX-39 wrote down about triggers, so a rig using
 * conditions asks for `reaction:condition` in its `requires`, and a build
 * without it declines the rig by name instead of running the mascot wrong.
 *
 * Deliberately small. A condition compares one parameter against one number,
 * or names the state the mascot is in. Anything more is an expression
 * language, and an expression language in a panel is a programming language
 * with no error messages.
 */

import { finite } from './numeric.js';

export const CONDITION_OPERATORS = Object.freeze(['>=', '<=', '>', '<', '==', '!=']);
export const CONDITION_KINDS = Object.freeze(['parameter', 'state']);

/** The marker a rig asks for when any of its reactions carries a condition. */
export const CONDITION_REQUIREMENT = 'reaction:condition';

/**
 * One condition, or null.
 *
 * Null rather than a repaired one, for the reason every other normalizer in
 * this codebase returns null: a condition nobody can read is a condition that
 * would be evaluated as *something*, and the something would be a guess about
 * when an author wanted their mascot to act.
 */
export function normalizeCondition(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const kind = CONDITION_KINDS.includes(candidate.kind) ? candidate.kind : null;
  if (!kind) return null;
  if (kind === 'state') {
    const state = typeof candidate.state === 'string' ? candidate.state.trim() : '';
    const operator = candidate.operator === '!=' ? '!=' : '==';
    return state ? Object.freeze({ kind, state, operator }) : null;
  }
  const parameter = typeof candidate.parameter === 'string' ? candidate.parameter.trim() : '';
  if (!parameter) return null;
  const operator = CONDITION_OPERATORS.includes(candidate.operator) ? candidate.operator : '>=';
  return Object.freeze({ kind, parameter, operator, value: finite(candidate.value, 0) });
}

/** The conditions on a reaction, every one of them readable. */
export function normalizeConditions(candidate) {
  const list = Array.isArray(candidate) ? candidate : [];
  return Object.freeze(list.map(normalizeCondition).filter(Boolean));
}

const compare = (left, operator, right) => {
  if (operator === '>=') return left >= right;
  if (operator === '<=') return left <= right;
  if (operator === '>') return left > right;
  if (operator === '<') return left < right;
  if (operator === '!=') return left !== right;
  return left === right;
};

/**
 * Whether every condition holds.
 *
 * Every, not any: an author listing two things is describing one situation,
 * and "or" is two reactions. No conditions at all is true, which is what keeps
 * every reaction written before this one behaving exactly as it did.
 */
export function conditionsHold(conditions, { params = {}, state = null } = {}) {
  for (const condition of conditions || []) {
    if (condition.kind === 'state') {
      const same = String(state ?? '') === condition.state;
      if (condition.operator === '!=' ? same : !same) return false;
      continue;
    }
    if (!compare(finite(params?.[condition.parameter], 0), condition.operator, condition.value)) return false;
  }
  return true;
}

/** Said the way an author wrote it, for a panel and for a problem report. */
export function describeCondition(condition) {
  if (!condition) return '';
  if (condition.kind === 'state') return `the mascot is ${condition.operator === '!=' ? 'not ' : ''}in ${condition.state}`;
  const words = { '>=': 'is at least', '<=': 'is at most', '>': 'is more than', '<': 'is less than', '==': 'is exactly', '!=': 'is not' };
  return `${condition.parameter} ${words[condition.operator]} ${condition.value}`;
}
