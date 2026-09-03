// Expression model (docs/ADR_EXPRESSIONS.md): pure operations over
// ProjectDocument.expressions. Commands wrap them; nothing here touches
// States, transitions or the runtime.

export const slugify = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'expression';

export function uniqueExpressionId(list, base) {
  let id = base, index = 2;
  while (list.some((item) => item.id === id)) id = `${base}-${index++}`;
  return id;
}

export const findExpression = (document, id) => (document?.expressions || []).find((item) => item.id === id) || null;
function requiredExpression(document, id) {
  const expression = findExpression(document, id);
  if (!expression) throw new Error(`Expression "${id}" does not exist.`);
  return expression;
}

/** Keep only known parameters, numeric, clamped to their range. */
export function sanitizeControls(document, controls = {}) {
  const result = {};
  for (const [name, raw] of Object.entries(controls || {})) {
    const param = document?.params?.[name];
    const value = Number(raw);
    if (!param || !Number.isFinite(value)) continue;
    const min = Number.isFinite(Number(param.min)) ? Number(param.min) : -Infinity, max = Number.isFinite(Number(param.max)) ? Number(param.max) : Infinity;
    result[name] = Math.max(min, Math.min(max, value));
  }
  return result;
}

export const neutralValue = (document, name) => { const param = document?.params?.[name]; return Number.isFinite(Number(param?.default)) ? Number(param.default) : 0; };

/** Values that differ from neutral: what a capture should keep. */
export function significantControls(document, values = {}, epsilon = 1e-3) {
  return Object.fromEntries(Object.entries(sanitizeControls(document, values)).filter(([name, value]) => Math.abs(value - neutralValue(document, name)) > epsilon));
}

export function createExpression(document, { name, controls = {}, source = 'manual', id } = {}) {
  document.expressions ||= [];
  const clean = String(name ?? '').trim() || `Expression ${document.expressions.length + 1}`;
  const expression = { id: uniqueExpressionId(document.expressions, slugify(id || clean)), name: clean, controls: sanitizeControls(document, controls), source };
  document.expressions.push(expression);
  return expression;
}

export function renameExpression(document, id, name) {
  const expression = requiredExpression(document, id);
  const clean = String(name ?? '').trim();
  if (!clean) throw new Error('An expression needs a name.');
  expression.name = clean;
  return expression;
}

export function duplicateExpression(document, id) {
  const source = requiredExpression(document, id);
  const copy = { ...structuredClone(source), name: `${source.name} copy` };
  copy.id = uniqueExpressionId(document.expressions, slugify(copy.name));
  document.expressions.splice(document.expressions.indexOf(source) + 1, 0, copy);
  return copy;
}

export function removeExpression(document, id) {
  const expression = requiredExpression(document, id);
  document.expressions = document.expressions.filter((item) => item !== expression);
  return expression;
}

/** `value === null` forgets the control; otherwise it becomes the target at full intensity. */
export function setExpressionControl(document, id, control, value) {
  const expression = requiredExpression(document, id);
  if (!document.params?.[control]) throw new Error(`Control "${control}" is not available in this project.`);
  if (value === null || value === undefined || value === '') { delete expression.controls[control]; return expression; }
  const clean = sanitizeControls(document, { [control]: value });
  if (!(control in clean)) throw new Error('Expression values must be numbers.');
  expression.controls[control] = clean[control];
  return expression;
}

/**
 * Set several controls at once.
 *
 * A puppet drag moves two movements together (look left *and* up), and one
 * gesture has to be one undo step, so the model takes them together rather
 * than the caller running two commands.
 */
export function setExpressionControls(document, id, values = {}) {
  const expression = requiredExpression(document, id);
  for (const [control, value] of Object.entries(values)) setExpressionControl(document, id, control, value);
  return expression;
}

/** Replace the expression with the given face values (only those away from neutral). */
export function captureExpression(document, id, values, { source = 'capture' } = {}) {
  const expression = requiredExpression(document, id);
  expression.controls = significantControls(document, values);
  expression.source = source;
  return expression;
}

export function expressionIssues(document) {
  const issues = [];
  for (const expression of document?.expressions || []) {
    const unknown = Object.keys(expression.controls || {}).filter((name) => !document?.params?.[name]);
    if (unknown.length) issues.push({ id: expression.id, name: expression.name, unknown });
  }
  return issues;
}
