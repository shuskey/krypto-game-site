export function createDeck() {
  return Array.from({ length: 25 }, (_, i) => Array(i < 6 ? 3 : i < 10 ? 4 : i < 17 ? 2 : 1).fill(i + 1)).flat();
}
export function shuffle(deck, random = Math.random) {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
export function rational(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (!d) throw new Error('You can’t divide by zero. Try a different operation.');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d); return { n: n / g, d: d / g };
}
export function format(v) { return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`; }
export function card(value, id) { return { id, value: rational(value), tree: { op: 'number', value }, sources: [id] }; }
export function apply(a, op, b, whole = true) {
  if (a.sources.some(id => b.sources.includes(id))) throw new Error('Each dealt card can only be used once.');
  const x = a.value, y = b.value;
  let value;
  if (op === '+') value = rational(x.n * y.d + y.n * x.d, x.d * y.d);
  else if (op === '-') value = rational(x.n * y.d - y.n * x.d, x.d * y.d);
  else if (op === '×') value = rational(x.n * y.n, x.d * y.d);
  else if (op === '÷') value = rational(x.n * y.d, x.d * y.n);
  else throw new Error('Choose an operation.');
  if (whole && (value.n < 0n || value.d !== 1n)) throw new Error('Whole-number mode needs a nonnegative whole number at every step. Change your calculation, or turn this mode off before a new round.');
  return { value, sources: [...a.sources, ...b.sources], tree: { op, left: a.tree, right: b.tree } };
}
// Rows use ordinary arithmetic precedence. Result cards are explicit groups.
export function evaluate(tokens, whole = true) {
  if (!tokens.length || tokens.length % 2 === 0) throw new Error('Choose a card, an operation, and another card.');
  let reduced = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    if (tokens[i] === '×' || tokens[i] === '÷') reduced[reduced.length - 1] = apply(reduced.at(-1), tokens[i], tokens[i + 1], whole);
    else reduced.push(tokens[i], tokens[i + 1]);
  }
  let result = reduced[0];
  for (let i = 1; i < reduced.length; i += 2) result = apply(result, reduced[i], reduced[i + 1], whole);
  return result;
}
export function expression(tree) {
  return tree.op === 'number' ? String(tree.value) : `(${expression(tree.left)} ${tree.op} ${expression(tree.right)})`;
}
// Reordering or regrouping addition/multiplication is the same solution.
export function signature(tree) {
  if (tree.op === 'number') return String(tree.value);
  if (tree.op === '+' || tree.op === '×') {
    const parts = [];
    const visit = node => node.op === tree.op ? (visit(node.left), visit(node.right)) : parts.push(signature(node));
    visit(tree); return `${tree.op}[${parts.sort().join(',')}]`;
  }
  return `${tree.op}[${signature(tree.left)},${signature(tree.right)}]`;
}
export function isWinner(result, target, ids) {
  return result.value.n === BigInt(target) * result.value.d && result.sources.length === ids.length && new Set(result.sources).size === ids.length && ids.every(id => result.sources.includes(id));
}
