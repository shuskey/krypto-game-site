// Only aggregate game context is sent. No names, card values, solutions,
// browser-storage identifiers, or game/session identifiers enter this module.
const HOST = 'krypto-game.chummy-bard-6128.chatgpt.site';
const DECKS = new Set(['standard', 'primary']);
const REASONS = new Set(['initial', 'resume', 'redeal', 'new-game', 'deck-change']);
const count = n => Math.max(0, Math.min(100, Math.trunc(Number(n) || 0)));
export const humanPlayerCount = players => players.filter(p => p.name.trim().toLowerCase() !== 'krypto king').length;

export class GameAnalytics {
  constructor(emit = () => {}) { this.emit = emit; this.deck = null; this.players = 0; }
  send(name, props = {}, interactive = true) {
    if (!this.deck) return;
    // Analytics is optional: an unavailable or blocked provider must never break play.
    try { this.emit(name, { deck: this.deck, human_players: this.players, ...props }, interactive); } catch {}
  }
  handShown(deck, reason, players) {
    if (!DECKS.has(deck) || !REASONS.has(reason)) return;
    this.players = count(players);
    if (deck !== this.deck) {
      const previous = this.deck;
      this.deck = deck;
      this.send('pageview', {}, false);
      this.send('Deck Visit', {}, false);
      // Snapshot once at the start of each deck visit, including resumed rosters.
      this.send('Players Present', { count: this.players }, false);
      if (previous) this.send('Deck Changed', { from_deck: previous });
    }
    this.send('Round Started', { reason }, !['initial', 'resume'].includes(reason));
    if (reason === 'new-game') this.send('Game Started');
  }
  playerAdded(players) {
    this.players = count(players);
    this.send('Human Player Added');
  }
  kingPressed(action) { if (['claim', 'retry'].includes(action)) this.send('Krypto King Pressed', { action }); }
  solutionFound(computer, players) {
    this.players = count(players);
    this.send('Solution Scored', { player_type: computer ? 'computer' : 'human' });
  }
}

export function createAnalytics() {
  if (typeof window === 'undefined' || window.location.hostname !== HOST) return new GameAnalytics();
  try {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    window.plausible.init = window.plausible.init || function (options) { window.plausible.o = options || {}; };
    // A deck is a virtual page. Plausible associates its engagement measurements
    // with this page and flushes the previous page's viewing time on deck changes.
    window.plausible.init({ autoCapturePageviews: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://plausible.io/js/pa-cbysi0ou2mgOPcAkqwLyx.js';
    document.head.append(script);
    const campaign = new URLSearchParams();
    const incoming = new URLSearchParams(window.location.search);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source']) {
      if (incoming.has(key)) campaign.set(key, incoming.get(key).slice(0, 200));
    }
    return new GameAnalytics((name, props, interactive) => {
      const url = `https://${HOST}/deck/${props.deck}${campaign.size ? '?' + campaign : ''}`;
      window.plausible(name, { url, props, interactive });
    });
  } catch { return new GameAnalytics(); }
}
