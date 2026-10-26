import { expression, signature, isWinner } from './engine.js';
export const COMPUTER_NAME = 'Krypto King';
export function recordSolution(state, result, name, computer = false) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 32) throw new Error('Enter or choose your name first.');
  if (!computer && name.toLowerCase() === COMPUTER_NAME.toLowerCase()) throw new Error('Krypto King plays through the Krypto King button. Choose your own name.');
  if (computer) {
    name = COMPUTER_NAME;
    if (state.answers.some(a => a.computer || a.name.toLowerCase() === COMPUTER_NAME.toLowerCase())) throw new Error('Krypto King can score only once per round. Time to redeal!');
  }
  if (!isWinner(result, state.target, state.hand.map((_, i) => `c${i}`))) throw new Error('Use every dealt card once to reach the target.');
  const key = signature(result.tree);
  if (state.answers.some(a => a.signature === key)) throw new Error('That solution already scored this round. Try a different calculation! Reordering or regrouping + or × counts as the same answer.');
  let player = state.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!player) { player = { name, score: 0 }; state.players.push(player); }
  player.score++;
  state.answers.push({ name: player.name, expression: expression(result.tree), signature: key, computer });
  return player;
}
