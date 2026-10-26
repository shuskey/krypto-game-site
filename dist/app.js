import { dealHand, card, evaluate, format, expression, signature, isWinner } from './engine.js';
const $ = id => document.getElementById(id);
const KEY = 'krypto-table-v1';
const fresh = () => ({ players: [], deckType: 'standard', hand: null, target: null, round: 0, answers: [], whole: true, nextWhole: true, sound: true });
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    const validCard = n => Number.isInteger(n) && n >= 1 && n <= 25;
    if (!s || !Array.isArray(s.players) || !s.players.every(p => typeof p.name === 'string' && p.name.length <= 32 && Number.isSafeInteger(p.score) && p.score >= 0) || !(s.hand === null || (Array.isArray(s.hand) && s.hand.length === 5 && s.hand.every(validCard))) || (s.hand !== null && !validCard(s.target)) || !Number.isSafeInteger(s.round) || s.round < 0 || !Array.isArray(s.answers) || !s.answers.every(a => ['name','expression','signature'].every(k => typeof a[k] === 'string')) || ['whole','nextWhole','sound'].some(k => typeof s[k] !== 'boolean') || (s.deckType !== undefined && !['standard', 'primary'].includes(s.deckType))) return fresh();
    const { shoe, ...saved } = s;
    return { ...saved, deckType: s.deckType ?? 'standard' };
  } catch { return fresh(); }
}
let state = restore(), pool = [], tokens = [], steps = [], editing = false, awarded = false;
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { $('storage-status').textContent = 'Storage unavailable · Session only'; } }
function el(tag, className, value) { const e = document.createElement(tag); if (className) e.className = className; if (value !== undefined) e.textContent = value; return e; }
function feedback(message, type = '') { $('feedback').textContent = message; $('feedback').className = `feedback ${type}`; }
function render() {
  $('round-label').textContent = state.hand ? `ROUND ${String(state.round).padStart(2, '0')} · FIND YOUR WAY` : 'READY WHEN YOU ARE';
  $('deck-select').value = state.deckType;
  document.body.classList.toggle('primary-deck', state.deckType === 'primary');
  document.querySelector('meta[name="theme-color"]').content = state.deckType === 'primary' ? '#214b68' : '#173d32';
  $('table-caption').textContent = state.hand ? `${state.whole ? 'Whole numbers' : 'Fractions & negatives welcome'} · Every card, exactly once.` : 'Deal a hand. Find a way to make the target.';
  $('deal').replaceChildren();
  for (let i = 0; i < 7; i++) {
    if (i === 5) { $('deal').append(el('div', 'equals', '=')); continue; }
    const n = state.hand ? (i === 6 ? state.target : state.hand[i]) : '?';
    const c = el('div', `card${i === 6 ? ' target' : ''}${state.hand ? '' : ' card-back'}`);
    c.dataset.value = n; c.setAttribute('aria-label', `${i === 6 ? 'Target' : 'Card ' + (i + 1)}: ${n}`);
    c.style.setProperty('--tilt', `${[-3, 1, -1, 2, -2, 0, 3][i]}deg`);
    c.append(el('span', '', state.hand ? n : '✳')); $('deal').append(c);
  }
  $('krypto').disabled = !state.hand; $('redeal').disabled = false;
  $('redeal').replaceChildren(document.createTextNode(state.hand ? '↻ ' : '↗ '), el('span', '', state.hand ? 'Redeal' : 'Deal first hand'));
  $('whole').checked = state.nextWhole;
  $('sound').textContent = state.sound ? '♪ Sound on' : '♪ Sound off'; $('sound').setAttribute('aria-pressed', state.sound);
  $('scores').replaceChildren(); $('players').replaceChildren();
  if (!state.players.length) { const empty = el('div', 'empty-scores'); empty.append(el('span', 'empty-icon', '♧'), el('p', '', 'No names on the board. Yet.'), el('p', '', 'The first “Krypto!” is yours.')); $('scores').append(empty); }
  [...state.players].sort((a, b) => b.score - a.score).forEach(p => {
    const row = el('div', 'score-row'); row.title = `${p.name}: ${p.score} points`;
    row.setAttribute('aria-label', `${p.name}: ${p.score} points`);
    const initials = p.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const avatar = el('span', 'avatar', initials);
    // Registration order keeps colors stable when the score order changes.
    const hues = [145, 28, 215, 330, 265, 65, 185, 0];
    const index = state.players.indexOf(p);
    const hue = index < hues.length ? hues[index] : (index * 137.508) % 360;
    avatar.style.background = `hsl(${hue} 65% 77%)`; avatar.style.color = `hsl(${hue} 55% 23%)`;
    row.append(avatar, el('span', 'score-name', p.name), el('strong', 'score-points', p.score)); $('scores').append(row);
    const option = el('option'); option.value = p.name; $('players').append(option);
  });
  $('answers-section').classList.toggle('hidden', !state.answers.length); $('answers').replaceChildren();
  state.answers.forEach(a => { const row = el('div', 'answer'), body = el('div'); body.append(el('p', '', `${a.expression} = ${state.target}`), el('small', '', a.name)); row.append(el('span', 'avatar', '✓'), body, el('span', 'point', '+1 point')); $('answers').append(row); });
}
function resetBuilder() { pool = state.hand.map((n, i) => card(n, `c${i}`)); tokens = []; steps = []; awarded = false; renderBuilder(); }
function tokenNode(t, clickable = false) {
  if (typeof t === 'string') return el('span', 'op-token', t === '-' ? '−' : t);
  const e = el(clickable ? 'button' : 'span', `mini-card${t.id.startsWith('r') ? ' result' : ''}`);
  e.append(document.createTextNode(format(t.value)));
  if (t.id.startsWith('r')) e.append(el('small', '', `STEP ${t.step}`));
  if (clickable) { e.setAttribute('aria-label', `Use ${format(t.value)}${t.step ? ' from step ' + t.step : ''}`); e.onclick = () => selectCard(t.id); }
  return e;
}
function renderBuilder() {
  $('workspace').classList.toggle('hidden', !editing);
  $('table-view').classList.toggle('hidden', editing);
  $('game-layout').classList.toggle('building', editing);
  $('game-layout').classList.toggle('winning', editing && awarded);
  $('builder-title').textContent = awarded ? 'Krypto! You got it.' : 'Build your solution.';
  $('player').disabled = awarded;
  $('buzzer-hint').textContent = editing ? 'ANOTHER IDEA?' : 'GOT IT? PRESS IT.';
  if (!editing) return;
  $('builder-target').textContent = state.target; $('available').replaceChildren(); $('expression').replaceChildren(); $('steps').replaceChildren();
  pool.filter(c => !tokens.includes(c)).forEach(c => { const b = tokenNode(c, true); b.disabled = tokens.length % 2 === 1 || awarded; $('available').append(b); });
  if (!tokens.length) $('expression').append(el('span', 'placeholder', awarded ? 'Another idea? Press Krypto! again.' : 'Your calculation goes here…'));
  else tokens.forEach(t => $('expression').append(tokenNode(t)));
  steps.forEach((s, i) => { const row = el('div', 'step'); row.append(el('span', 'step-label', `STEP ${i + 1}`), el('span', '', s.tokens.map(t => typeof t === 'string' ? t : format(t.value)).join(' ')), el('span', '', '='), el('strong', '', format(s.result.value))); $('steps').append(row); });
  document.querySelectorAll('[data-op]').forEach(b => b.disabled = !tokens.length || tokens.length % 2 === 0 || awarded);
  $('calculate').disabled = tokens.length < 3 || tokens.length % 2 === 0 || awarded;
  $('undo').disabled = awarded || (!tokens.length && !steps.length); $('reset').disabled = awarded;
}
function selectCard(id) { if (awarded || tokens.length % 2) return; tokens.push(pool.find(c => c.id === id)); feedback('Keep going, or press = to save this step.'); renderBuilder(); checkSolution(); }
function deal(clear = false) {
  if (clear) { const { sound, nextWhole, deckType } = state; state = { ...fresh(), sound, nextWhole, deckType }; }
  const next = dealHand(state.deckType);
  state.hand = next.hand; state.target = next.target; state.round++; state.answers = []; state.whole = state.nextWhole;
  editing = false; save(); render(); renderBuilder();
}
$('new-game').onclick = () => state.hand || state.players.length ? $('confirm-dialog').showModal() : deal(true);
$('keep-game').onclick = () => $('confirm-dialog').close();
$('confirm-new').onclick = () => { $('confirm-dialog').close(); $('player').value = ''; deal(true); };
$('redeal').onclick = () => deal();
$('krypto').onclick = () => { editing = true; $('player').value = ''; resetBuilder(); feedback('Enter your name, then show us your idea.'); tone([523, 659], .09); $('player').focus({ preventScroll: true }); };
$('player').addEventListener('change', () => {
  const name = $('player').value.trim().replace(/\s+/g, ' '); if (!name) return;
  if (!state.players.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) state.players.push({ name, score: 0 });
  save(); render(); checkSolution();
});
$('player').addEventListener('keydown', event => { if (event.key === 'Enter') { $('player').blur(); checkSolution(); } });
$('cancel').onclick = () => { editing = false; renderBuilder(); };
document.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { if (tokens.length % 2 && !awarded) { tokens.push(b.dataset.op); renderBuilder(); } });
$('undo').onclick = () => {
  if (tokens.length) tokens.pop();
  else if (steps.length) { const step = steps.pop(); pool = pool.filter(c => c.id !== step.result.id); pool.push(...step.tokens.filter(t => typeof t !== 'string')); tokens = [...step.tokens]; }
  feedback('Take it one step at a time.'); renderBuilder();
};
$('reset').onclick = () => { resetBuilder(); feedback('Fresh thinking. Same five cards.'); };
$('calculate').onclick = () => {
  try { const result = evaluate(tokens, state.whole); result.id = `r${steps.length}`; result.step = steps.length + 1; const previous = [...tokens]; pool = pool.filter(c => !tokens.includes(c)); pool.push(result); steps.push({ tokens: previous, result }); tokens = []; feedback(`Step ${steps.length} makes ${format(result.value)}. Use your result card next.`); renderBuilder(); checkSolution(); }
  catch (error) { feedback(error.message, 'error'); }
};
function checkSolution() {
  if (!editing || awarded || (tokens.length && tokens.length % 2 === 0)) return;
  try {
    const used = tokens.length ? tokens.filter(t => typeof t !== 'string').flatMap(t => t.sources) : pool.length === 1 ? pool[0].sources : [];
    if (used.length !== 5) return;
    const result = tokens.length ? evaluate(tokens, state.whole) : pool.length === 1 ? pool[0] : null;
    if (!result) return;
    if (!isWinner(result, state.target, state.hand.map((_, i) => `c${i}`))) { feedback(`That makes ${format(result.value)}. The target is ${state.target}. Undo or clear to try another way.`); return; }
    const key = signature(result.tree);
    if (state.answers.some(a => a.signature === key)) throw new Error('That solution already scored this round. Try a different calculation! Reordering or regrouping + or × counts as the same answer.');
    const name = $('player').value.trim().replace(/\s+/g, ' ');
    if (!name) { feedback('You found it! Enter or choose your name, then leave the field or press Enter to claim your point.'); $('player').focus({ preventScroll: true }); return; }
    let player = state.players.find(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!player) { player = { name, score: 0 }; state.players.push(player); }
    player.score++; state.answers.push({ name: player.name, expression: expression(result.tree), signature: key }); awarded = true; save(); render(); renderBuilder();
    feedback(`Krypto! ${player.name} gets a point! Press Krypto! for another solution, or redeal for the next round.`, 'success'); celebrate(); tone([523, 659, 784, 1047], .16);
  } catch (error) { feedback(error.message, 'error'); }
}
$('deck-select').onchange = () => { state.deckType = $('deck-select').value; deal(); };
$('whole').onchange = () => { state.nextWhole = $('whole').checked; save(); };
$('rules').onclick = () => $('rules-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
$('sound').onclick = () => { state.sound = !state.sound; save(); render(); };
$('toggle-scores').onclick = () => {
  const open = $('game-layout').classList.toggle('scores-open');
  $('toggle-scores').setAttribute('aria-expanded', open);
  $('toggle-scores').setAttribute('aria-label', open ? 'Collapse scores' : 'Expand scores');
  $('score-chevron').textContent = open ? '›' : '‹';
};
$('toggle-scores').setAttribute('aria-label', 'Expand scores');
let audio;
function tone(notes, duration) {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
    notes.forEach((frequency, i) => { const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + i * duration; oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.12, start + .01); gain.gain.exponentialRampToValueAtTime(.001, start + duration * 2); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration * 2); });
  } catch { /* Sound is optional when browser audio is unavailable. */ }
}
let animation;
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cancelAnimationFrame(animation);
  const canvas = $('confetti'), context = canvas.getContext('2d'); if (!context) return;
  canvas.width = innerWidth; canvas.height = innerHeight;
  const pieces = Array.from({ length: 130 }, () => ({ x: Math.random() * canvas.width, y: -Math.random() * canvas.height, vx: Math.random() * 3 - 1.5, vy: Math.random() * 3 + 2, r: Math.random() * 6, c: ['#c7da80', '#e89857', '#2f754b', '#e3c65b'][Math.floor(Math.random() * 4)] }));
  const start = performance.now();
  function frame(time) { context.clearRect(0, 0, canvas.width, canvas.height); for (const p of pieces) { p.x += p.vx; p.y += p.vy; p.r += .04; context.save(); context.translate(p.x, p.y); context.rotate(p.r); context.fillStyle = p.c; context.fillRect(-3, -5, 6, 10); context.restore(); } if (time - start < 4500) animation = requestAnimationFrame(frame); else context.clearRect(0, 0, canvas.width, canvas.height); }
  animation = requestAnimationFrame(frame);
}
render();
