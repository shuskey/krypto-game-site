// Browser adaptation of Scott Huskey's F# KryptoSolver (2015):
// Krypto.getPermutations + Tree.allTreeLeafList / equation-tree forest search.
// Enumerate card orders, every binary grouping, and +, -, ×, ÷ at each branch.
// Generate lazily so one solution is enough; reuse the game's exact arithmetic
// and current whole-number rules instead of the original floating-point math.
import { card, apply, signature } from './engine.js';

function* permutations(items) {
  if (!items.length) { yield []; return; }
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    // Equal-valued physical cards are interchangeable for searching expressions.
    const value = items[i].tree.value;
    if (seen.has(value)) continue;
    seen.add(value);
    for (const rest of permutations(items.filter((_, j) => i !== j))) yield [items[i], ...rest];
  }
}

function* equationTrees(operands, whole) {
  if (operands.length === 1) { yield operands[0]; return; }
  for (let split = 1; split < operands.length; split++) {
    for (const left of equationTrees(operands.slice(0, split), whole)) {
      for (const right of equationTrees(operands.slice(split), whole)) {
        for (const op of ['+', '-', '×', '÷']) {
          try { yield apply(left, op, right, whole); }
          catch { /* Invalid division or an intermediate forbidden by the rules. */ }
        }
      }
    }
  }
}

export function findSolution(hand, target, whole = true, excluded = []) {
  if (!Array.isArray(hand) || hand.length !== 5 || !hand.every(n => Number.isInteger(n) && n >= 1 && n <= 25) || !Number.isInteger(target) || target < 1 || target > 25) throw new Error('The solver needs five cards and a target from 1–25.');
  const skip = new Set(excluded);
  const cards = hand.map((n, i) => card(n, `c${i}`));
  let examined = 0, hasAny = false;
  for (const order of permutations(cards)) {
    for (const result of equationTrees(order, whole)) {
      examined++;
      if (result.value.n !== BigInt(target) * result.value.d) continue;
      hasAny = true;
      if (!skip.has(signature(result.tree))) return { result, examined, hasAny };
    }
  }
  return { result: null, examined, hasAny };
}
