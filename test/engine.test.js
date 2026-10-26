import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, shuffle, card, apply, evaluate, format, signature, isWinner } from '../dist/engine.js';
test('official deck has exactly 56 cards with the specified multiplicities', () => {
  const deck = createDeck(); assert.equal(deck.length, 56);
  for (let n = 1; n <= 25; n++) assert.equal(deck.filter(v => v === n).length, n <= 6 ? 3 : n <= 10 ? 4 : n <= 17 ? 2 : 1);
  const mixed = shuffle(deck); assert.deepEqual([...mixed].sort(), [...deck].sort()); assert.notEqual(mixed, deck);
});
test('Wikipedia multi-step example uses every original card once', () => {
  const cards = [24, 22, 23, 20, 21].map((n, i) => card(n, `c${i}`));
  let result = apply(cards[0], '+', cards[1]);
  result = apply(result, '÷', cards[2]); result = apply(result, '+', cards[3]); result = apply(result, '-', cards[4]);
  assert.equal(format(result.value), '1'); assert.ok(isWinner(result, 1, cards.map(c => c.id)));
  assert.ok(!isWinner(result, 2, cards.map(c => c.id)));
});
test('fractions stay exact and negative values are supported in relaxed mode', () => {
  const third = apply(card(1, 'a'), '÷', card(3, 'b'), false);
  assert.equal(format(third.value), '1/3');
  assert.equal(format(apply(third, '×', card(3, 'c'), false).value), '1');
  assert.equal(format(apply(card(1, 'x'), '-', card(3, 'y'), false).value), '-2');
});
test('whole-number mode rejects fractional and negative intermediate results', () => {
  assert.throws(() => apply(card(1, 'a'), '÷', card(3, 'b')), /Whole-number/);
  assert.throws(() => apply(card(1, 'a'), '-', card(3, 'b')), /Whole-number/);
  assert.equal(format(apply(card(3, 'a'), '-', card(3, 'b')).value), '0');
});
test('division by zero and reusing original cards are rejected', () => {
  const a = card(3, 'a'); const b = card(3, 'b'); const zero = apply(a, '-', b);
  assert.throws(() => apply(card(4, 'c'), '÷', zero), /zero/);
  assert.throws(() => apply(a, '+', a), /once/);
  assert.throws(() => apply(zero, '+', a), /once/);
});
test('equal-valued cards are separate physical cards; partial answers never win', () => {
  const a = card(2, 'a'), b = card(2, 'b');
  const result = apply(a, '+', b); assert.equal(format(result.value), '4');
  assert.ok(!isWinner(result, 4, ['a','b','c','d','e']));
});
test('one-line expressions follow arithmetic precedence and incomplete rows fail', () => {
  const [a, b, c] = [2, 3, 4].map((n, i) => card(n, String(i)));
  assert.equal(format(evaluate([a, '+', b, '×', c]).value), '14');
  assert.equal(format(evaluate([a, '×', b, '+', c]).value), '10');
  assert.throws(() => evaluate([a, '+']), /Choose/);
  assert.throws(() => evaluate([]), /Choose/);
});
test('duplicate fingerprints ignore commutative order and associative grouping', () => {
  const [a,b,c] = [2,3,4].map((n,i) => card(n,String(i)));
  assert.equal(signature(apply(apply(a,'+',b),'+',c).tree), signature(apply(c,'+',apply(b,'+',a)).tree));
  assert.equal(signature(apply(a,'×',b).tree), signature(apply(b,'×',a).tree));
  assert.notEqual(signature(apply(c,'-',a).tree), signature(apply(a,'-',c,false).tree));
});
