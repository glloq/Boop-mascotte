export function evalExpr(expr, scope) {
  try {
    const keys = Object.keys(scope);
    const fn = new Function(...keys, `return (${expr});`);
    return Number(fn(...keys.map((k) => scope[k]))) || 0;
  } catch { return 0; }
}
