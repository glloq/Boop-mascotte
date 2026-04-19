import { evaluate } from 'mathjs';

export function evaluateBinding(expression, scope) {
  try {
    return Number(evaluate(expression, scope)) || 0;
  } catch {
    return 0;
  }
}
