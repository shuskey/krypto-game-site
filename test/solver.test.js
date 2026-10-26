import { test } from 'node:test';
import assert from 'node:assert/strict';
import { card, apply, isWinner, signature } from '../dist/engine.js';
import { findSolution } from '../dist/solver.js';
import { COMPUTER_NAME, recordSolution } from '../dist/scoring.js';

function rebuild(tree, hand, whole = true) {
  const remaining = hand.map((n, i) => card(n, `c${i}`));
  function visit(node) {
    if (node.op === 'number') {
      const index = remaining.findIndex(c => c.tree.value === node.value);
      assert.ok(index >= 0, 'the returned tree cannot invent or reuse a card');
      return remaining.splice(index, 1)[0];
    }
    return apply(visit(node.left), node.op, visit(node.right), whole);
  }
  const result = visit(tree); assert.equal(remaining.length, 0); return result;
}
test('F# forest-search adaptation finds a five-card solution that passes the game checker', () => {
  const hand = [24,22,23,20,21];
  const found = findSolution(hand, 1);
  assert.ok(found.result);
  assert.ok(isWinner(rebuild(found.result.tree, hand), 1, ['c0','c1','c2','c3','c4']));
});
test('no-solution status requires exhausting all legal trees, not a timeout', () => {
  const found = findSolution([1,1,1,1,1], 25);
  assert.equal(found.result, null); assert.equal(found.hasAny, false); assert.ok(found.examined > 0);
});
test('duplicate-value cards still all appear once in a returned solution', () => {
  const hand = [2,1,2,2,3], found = findSolution(hand,24);
  assert.ok(isWinner(rebuild(found.result.tree, hand), 24, ['c0','c1','c2','c3','c4']));
});
test('solver excludes answers already claimed and can find a different answer', () => {
  const first = findSolution([1,2,3,4,5], 15);
  const next = findSolution([1,2,3,4,5], 15, true, [signature(first.result.tree)]);
  assert.ok(next.result); assert.notEqual(signature(first.result.tree), signature(next.result.tree));
});
test('a hand whose solutions have all been claimed reports that solutions exist', () => {
  const excluded = [];
  let next;
  do {
    next = findSolution([1,1,1,1,1], 5, true, excluded);
    if (next.result) excluded.push(signature(next.result.tree));
    assert.ok(excluded.length < 100, 'search must not return an excluded answer');
  } while (next.result);
  assert.ok(excluded.length > 0); assert.equal(next.hasAny, true);
});
test('relaxed-rule solver results survive exact fraction validation', () => {
  const hand = [1,3,4,6,8], found = findSolution(hand, 24, false);
  assert.ok(found.result);
  assert.ok(isWinner(rebuild(found.result.tree, hand, false), 24, ['c0','c1','c2','c3','c4']));
});
test('background searches do not score; explicitly claiming gives Krypto King one point', () => {
  const state = { hand:[1,2,3,4,5], target:15, players:[], answers:[] };
  const found = findSolution(state.hand,state.target);
  assert.equal(state.players.length, 0); assert.equal(state.answers.length, 0);
  const player = recordSolution(state, found.result, COMPUTER_NAME, true);
  assert.equal(player.name, 'Krypto King'); assert.equal(player.score,1);
  const different = findSolution(state.hand,state.target,true,[signature(found.result.tree)]);
  assert.throws(() => recordSolution(state,different.result,COMPUTER_NAME,true), /only once/);
  assert.equal(player.score,1); assert.equal(state.answers.length,1);
  state.answers = [];
  recordSolution(state,found.result,COMPUTER_NAME,true);
  assert.equal(player.score,2, 'a redeal permits one more computer point');
});
test('human names cannot impersonate the computer; duplicate claims do not score', () => {
  const state = { hand:[1,2,3,4,5], target:15, players:[], answers:[] };
  const found = findSolution(state.hand,state.target).result;
  assert.throws(() => recordSolution(state,found,' krypto king '), /Choose your own name/);
  assert.throws(() => recordSolution(state,found,'   '), /name first/);
  recordSolution(state,found,'Ada');
  assert.throws(() => recordSolution(state,found,'Ben'), /already scored/);
  assert.equal(state.players.length,1); assert.equal(state.players[0].score,1);
});
