import { dealHand, card, apply, evaluate, format, signature, isWinner } from './engine.js';
import { COMPUTER_NAME, recordSolution } from './scoring.js';
import { createAnalytics, humanPlayerCount } from './analytics.js';
const $ = id => document.getElementById(id);
const KEY = 'krypto-table-v1';
const fresh = () => ({ players: [], deckType: 'standard', hand: null, target: null, round: 0, answers: [], whole: true, nextWhole: true, sound: true, computerDone: false, computerOutcome: 'idle' });
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    const validCard = n => Number.isInteger(n) && n >= 1 && n <= 25;
    if (!s || !Array.isArray(s.players) || !s.players.every(p => typeof p.name === 'string' && p.name.length <= 32 && Number.isSafeInteger(p.score) && p.score >= 0) || !(s.hand === null || (Array.isArray(s.hand) && s.hand.length === 5 && s.hand.every(validCard))) || (s.hand !== null && !validCard(s.target)) || !Number.isSafeInteger(s.round) || s.round < 0 || !Array.isArray(s.answers) || !s.answers.every(a => ['name','expression','signature'].every(k => typeof a[k] === 'string')) || ['whole','nextWhole','sound'].some(k => typeof s[k] !== 'boolean') || (s.deckType !== undefined && !['standard', 'primary'].includes(s.deckType))) return fresh();
    const { shoe, ...saved } = s;
    const computerDone = s.answers.some(a => a.computer || a.name.toLowerCase() === COMPUTER_NAME.toLowerCase());
    return { ...saved, deckType: s.deckType ?? 'standard', computerDone, computerOutcome: computerDone ? 'found' : 'idle' };
  } catch { return fresh(); }
}
let state = restore(), pool = [], tokens = [], steps = [], editing = false, awarded = false;
let solverWorker = null, cachedSolution = null, computerMode = false, thinking = false, searchGeneration = 0;
const analytics = createAnalytics();
const humanPlayers = () => humanPlayerCount(state.players);
const hasPlayerName = () => $('player').value.trim().length > 0;
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
  $('computer').disabled = !state.hand || state.computerDone || !['ready', 'error'].includes(state.computerOutcome);
  $('computer').classList.toggle('thinking', thinking);
  $('computer-label').textContent = 'Krypto King';
  $('computer-icon').textContent = thinking ? '⚙' : state.computerOutcome === 'ready' ? '💡' : ['none', 'used'].includes(state.computerOutcome) ? '×' : state.computerDone ? '✓' : '↻';
  $('computer-summary').textContent = thinking ? 'Thinking…' : state.computerDone ? 'Point awarded' : state.computerOutcome === 'ready' ? 'Give it the round' : state.computerOutcome === 'none' ? 'No solution found' : state.computerOutcome === 'used' ? 'All solutions claimed' : 'Retry search';
  $('computer').classList.toggle('solution-ready', state.computerOutcome === 'ready');
  $('computer').setAttribute('aria-label', `Krypto King: ${$('computer-summary').textContent}`);
  $('computer').title = state.computerDone ? 'Krypto King has scored this round. Redeal for another turn.' : state.computerOutcome === 'ready' ? 'A solution is ready. Give Krypto King one point and reveal it.' : state.computerOutcome === 'none' ? 'No solution found under this round’s rules. Redeal to try a new hand.' : state.computerOutcome === 'used' ? 'All solutions have already scored. Redeal for a new hand.' : 'Scott’s KryptoSolver is searching in the background.';
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
  $('builder-title').textContent = computerMode ? thinking ? 'Krypto King is thinking…' : awarded ? 'Solution found!' : state.computerOutcome === 'none' ? 'No solution found.' : 'Krypto King’s turn.' : awarded ? 'Krypto! You got it.' : 'Build your solution.';
  $('player').disabled = awarded || computerMode;
  $('buzzer-hint').textContent = editing ? 'ANOTHER IDEA?' : 'GOT IT? PRESS IT.';
  if (!editing) return;
  const locked = !hasPlayerName() || awarded || computerMode;
  $('computer-status').classList.toggle('hidden', !computerMode);
  $('computer-status').classList.toggle('thinking', thinking);
  $('computer-message').textContent = thinking ? 'Trying the cards, operations, and ways to group them…' : state.computerOutcome === 'found' ? 'One solution. One point for Krypto King. Ready to redeal?' : state.computerOutcome === 'none' ? 'No solution found with this round’s rules. Try a redeal!' : state.computerOutcome === 'used' ? 'Every solution has already scored. Time for a redeal!' : 'The computer couldn’t finish. You can try again or redeal.';
  $('workspace').classList.toggle('needs-name', !hasPlayerName());
  $('builder-target').textContent = state.target; $('available').replaceChildren(); $('expression').replaceChildren(); $('steps').replaceChildren();
  pool.filter(c => !tokens.includes(c)).forEach(c => { const b = tokenNode(c, true); b.disabled = tokens.length % 2 === 1 || locked; $('available').append(b); });
  if (!tokens.length) $('expression').append(el('span', 'placeholder', awarded ? 'Another idea? Press Krypto! again.' : 'Your calculation goes here…'));
  else tokens.forEach(t => $('expression').append(tokenNode(t)));
  steps.forEach((s, i) => { const row = el('div', 'step'); row.append(el('span', 'step-label', `STEP ${i + 1}`), el('span', '', s.tokens.map(t => typeof t === 'string' ? t : format(t.value)).join(' ')), el('span', '', '='), el('strong', '', format(s.result.value))); $('steps').append(row); });
  document.querySelectorAll('[data-op]').forEach(b => b.disabled = !tokens.length || tokens.length % 2 === 0 || locked);
  $('calculate').disabled = tokens.length < 3 || tokens.length % 2 === 0 || locked;
  $('undo').disabled = locked || (!tokens.length && !steps.length); $('reset').disabled = locked;
}
function selectCard(id) { if (computerMode || !hasPlayerName() || awarded || tokens.length % 2) return; tokens.push(pool.find(c => c.id === id)); feedback('Keep going, or press = to save this step.'); renderBuilder(); checkSolution(); }
function deal(clear = false, reason = clear ? 'new-game' : 'redeal') {
  stopComputer(); computerMode = false;
  if (clear) { const { sound, nextWhole, deckType } = state; state = { ...fresh(), sound, nextWhole, deckType }; }
  const next = dealHand(state.deckType);
  state.hand = next.hand; state.target = next.target; state.round++; state.answers = []; state.whole = state.nextWhole; state.computerDone = false; state.computerOutcome = 'idle';
  editing = false; save(); render(); renderBuilder(); startComputerSearch();
  analytics.handShown(state.deckType, reason, humanPlayers());
}
$('new-game').onclick = () => state.hand || state.players.length ? $('confirm-dialog').showModal() : deal(true);
$('keep-game').onclick = () => $('confirm-dialog').close();
$('confirm-new').onclick = () => { $('confirm-dialog').close(); $('player').value = ''; deal(true); };
$('redeal').onclick = () => deal();
$('krypto').onclick = () => { computerMode = false; editing = true; $('player').value = ''; resetBuilder(); feedback('Enter or choose your name to unlock the cards.'); tone([523, 659], .09); $('player').focus({ preventScroll: true }); };
$('player').addEventListener('input', () => {
  renderBuilder();
  feedback(hasPlayerName() ? 'You’re ready! Choose a card to start your solution.' : 'Enter or choose your name to unlock the cards.');
});
$('player').addEventListener('change', () => {
  if (computerMode) return;
  const name = $('player').value.trim().replace(/\s+/g, ' '); if (!name) return;
  if (name.toLowerCase() === COMPUTER_NAME.toLowerCase()) { feedback('Krypto King plays through the Krypto King button. Choose your own name.', 'error'); return; }
  if (!state.players.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    state.players.push({ name, score: 0 }); analytics.playerAdded(humanPlayers());
  }
  save(); render(); checkSolution();
});
$('player').addEventListener('keydown', event => { if (event.key === 'Enter') { $('player').blur(); checkSolution(); } });
$('cancel').onclick = () => { computerMode = false; editing = false; render(); renderBuilder(); };
document.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { if (!computerMode && hasPlayerName() && tokens.length % 2 && !awarded) { tokens.push(b.dataset.op); renderBuilder(); } });
$('undo').onclick = () => {
  if (computerMode || !hasPlayerName() || awarded) return;
  if (tokens.length) tokens.pop();
  else if (steps.length) { const step = steps.pop(); pool = pool.filter(c => c.id !== step.result.id); pool.push(...step.tokens.filter(t => typeof t !== 'string')); tokens = [...step.tokens]; }
  feedback('Take it one step at a time.'); renderBuilder();
};
$('reset').onclick = () => { if (computerMode || !hasPlayerName() || awarded) return; resetBuilder(); feedback('Fresh thinking. Same five cards.'); };
$('calculate').onclick = () => {
  if (computerMode || !hasPlayerName() || awarded) return;
  try { const result = evaluate(tokens, state.whole); result.id = `r${steps.length}`; result.step = steps.length + 1; const previous = [...tokens]; pool = pool.filter(c => !tokens.includes(c)); pool.push(result); steps.push({ tokens: previous, result }); tokens = []; feedback(`Step ${steps.length} makes ${format(result.value)}. Use your result card next.`); renderBuilder(); checkSolution(); }
  catch (error) { feedback(error.message, 'error'); }
};
function checkSolution() {
  if (computerMode || !editing || !hasPlayerName() || awarded || (tokens.length && tokens.length % 2 === 0)) return;
  try {
    const used = tokens.length ? tokens.filter(t => typeof t !== 'string').flatMap(t => t.sources) : pool.length === 1 ? pool[0].sources : [];
    if (used.length !== 5) return;
    const result = tokens.length ? evaluate(tokens, state.whole) : pool.length === 1 ? pool[0] : null;
    if (!result) return;
    if (!isWinner(result, state.target, state.hand.map((_, i) => `c${i}`))) { feedback(`That makes ${format(result.value)}. The target is ${state.target}. Undo or clear to try another way.`); return; }
    const name = $('player').value.trim().replace(/\s+/g, ' ');
    const previousCount = humanPlayers();
    const player = recordSolution(state, result, name);
    if (humanPlayers() > previousCount) analytics.playerAdded(humanPlayers());
    analytics.solutionFound(false, humanPlayers());
    awarded = true; save(); render(); renderBuilder();
    if (cachedSolution && state.answers.some(a => a.signature === signature(cachedSolution.tree))) startComputerSearch();
    feedback(`Krypto! ${player.name} gets a point! Press Krypto! for another solution, or redeal for the next round.`, 'success'); celebrate(); tone([523, 659, 784, 1047], .16);
  } catch (error) { feedback(error.message, 'error'); }
}
function stopComputer() {
  searchGeneration++;
  solverWorker?.terminate(); solverWorker = null;
  cachedSolution = null; thinking = false;
}
function showComputerTree(tree) {
  pool = state.hand.map((n, i) => card(n, `c${i}`)); tokens = []; steps = [];
  const unused = [...pool];
  function visit(node) {
    if (node.op === 'number') {
      const index = unused.findIndex(c => c.tree.value === node.value);
      if (index < 0) throw new Error('The solver returned an invalid card.');
      return unused.splice(index, 1)[0];
    }
    const left = visit(node.left), right = visit(node.right), result = apply(left, node.op, right, state.whole);
    result.id = `r${steps.length}`; result.step = steps.length + 1;
    steps.push({ tokens: [left, node.op, right], result });
    pool = pool.filter(c => c !== left && c !== right); pool.push(result);
    return result;
  }
  const result = visit(tree);
  tokens = [result];
  return result;
}
function computerError() {
  stopComputer(); state.computerOutcome = 'error';
  save(); render();
}
function startComputerSearch() {
  if (state.computerDone || !state.hand) return;
  stopComputer(); thinking = true; state.computerOutcome = 'thinking'; render();
  const generation = searchGeneration;
  try {
    solverWorker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });
    solverWorker.onerror = () => { if (generation === searchGeneration) computerError(); };
    solverWorker.onmessage = ({ data }) => {
      if (generation !== searchGeneration || data.round !== state.round) return;
      solverWorker?.terminate(); solverWorker = null; thinking = false;
      if (data.error) { computerError(); return; }
      if (data.result && state.answers.some(a => a.signature === signature(data.result.tree))) {
        // A person scored this answer while the worker was searching. Find a new one.
        startComputerSearch(); return;
      }
      cachedSolution = data.result;
      state.computerOutcome = data.result ? 'ready' : data.hasAny ? 'used' : 'none';
      save(); render();
    };
    solverWorker.postMessage({ hand: state.hand, target: state.target, whole: state.whole, excluded: state.answers.map(a => a.signature), round: state.round });
  } catch { computerError(); }
}
$('computer').onclick = () => {
  if (state.computerOutcome === 'error') { analytics.kingPressed('retry'); startComputerSearch(); return; }
  if (thinking || state.computerDone || !cachedSolution || state.computerOutcome !== 'ready') return;
  analytics.kingPressed('claim');
  try {
    computerMode = true; editing = true; $('player').value = COMPUTER_NAME;
    const result = showComputerTree(cachedSolution.tree);
    recordSolution(state, result, COMPUTER_NAME, true);
    analytics.solutionFound(true, humanPlayers());
    state.computerDone = true; state.computerOutcome = 'found'; awarded = true;
    save(); render(); renderBuilder();
    feedback('Krypto! Krypto King gets one point. Redeal for a new hand.', 'success');
    celebrate(); tone([523, 659, 784, 1047], .16);
  } catch (error) {
    computerMode = false; editing = false; awarded = false;
    feedback(error.message, 'error'); startComputerSearch(); renderBuilder();
  }
};
$('deck-select').onchange = () => { state.deckType = $('deck-select').value; deal(false, 'deck-change'); };
$('whole').onchange = () => { state.nextWhole = $('whole').checked; save(); };
$('rules').onclick = () => $('rules-dialog').showModal();
$('share').onclick = () => { $('share-feedback').textContent = ''; $('share-dialog').showModal(); };
$('copy-intro').onclick = async () => {
  try {
    await navigator.clipboard.writeText(`${$('share-copy').textContent}\n\nhttps://krypto-game.chummy-bard-6128.chatgpt.site/`);
    $('share-feedback').textContent = 'Intro and link copied! Add the downloaded image to your post.';
  } catch { $('share-feedback').textContent = 'Copy the intro text and link above, and download the image for your post.'; }
};
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
if (!state.hand) deal(false, 'initial'); else { render(); startComputerSearch(); analytics.handShown(state.deckType, 'resume', humanPlayers()); }
