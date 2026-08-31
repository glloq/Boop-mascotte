import { evaluateExpression } from '../../../runtime/runtime.js';

export function evaluateBinding(expression, scope) {
  return evaluateExpression(expression, scope);
}
