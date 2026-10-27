import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameAnalytics, humanPlayerCount } from '../dist/analytics.js';
const fixture = () => {
  const events = [];
  const analytics = new GameAnalytics((name, props, interactive) => events.push({ name, props, interactive }));
  return { analytics, events };
};
test('first hand records one deck visit and one hand; redeals do not inflate deck visits', () => {
  const { analytics:a, events:e } = fixture();
  a.handShown('standard', 'initial', 0); a.handShown('standard','redeal',2);
  assert.equal(e.filter(e => e.name === 'pageview').length,1);
  assert.equal(e.filter(e => e.name === 'Deck Visit').length,1);
  assert.equal(e.filter(e => e.name === 'Round Started').length,2);
  assert.equal(e.find(e => e.name === 'Round Started').interactive,false);
  assert.equal(e.at(-1).interactive,true);
});
test('deck switches move the page, counts, and following actions to the new deck', () => {
  const { analytics:a, events:e } = fixture();
  a.handShown('standard','resume',2); a.handShown('primary','deck-change',2); a.kingPressed('claim');
  assert.deepEqual(e.filter(e => e.name === 'pageview').map(e => e.props.deck), ['standard','primary']);
  assert.deepEqual(e.find(e => e.name === 'Deck Changed').props,{deck:'primary',human_players:2,from_deck:'standard'});
  assert.equal(e.at(-1).props.deck,'primary'); assert.equal(e.at(-1).name,'Krypto King Pressed');
  a.handShown('standard','deck-change',2);
  assert.equal(e.filter(e => e.name === 'Deck Visit').length,3,'returning to a deck begins a new deck visit');
});
test('restored games count the hand shown and existing human roster', () => {
  const { analytics:a, events:e } = fixture();
  const total = humanPlayerCount([{name:'Ada'},{name:'Krypto King'},{name:'Ben'},{name:' kRyPtO KiNg '}]);
  assert.equal(total,2); a.handShown('primary','resume',total);
  assert.equal(e.find(e => e.name === 'Players Present').props.count,2);
  assert.equal(e.find(e => e.name === 'Round Started').props.reason,'resume');
});
test('adding humans and scoring the computer never includes player names or adds a human', () => {
  const { analytics:a, events:e } = fixture();
  a.handShown('standard','initial',0); a.playerAdded(1); a.kingPressed('claim'); a.solutionFound(true,1);
  assert.equal(e.filter(e => e.name === 'Human Player Added').length,1);
  assert.equal(e.at(-1).props.human_players,1);
  assert.equal(e.at(-1).props.player_type,'computer');
  const allowed = new Set(['deck','human_players','count','reason','from_deck','action','player_type']);
  for (const event of e) for (const key of Object.keys(event.props)) assert.ok(allowed.has(key));
  assert.ok(!JSON.stringify(e).includes('Ada'));
});
test('starting a new game resets roster context without inventing a deck switch', () => {
  const { analytics:a, events:e } = fixture();
  a.handShown('primary','resume',4); a.handShown('primary','new-game',0); a.playerAdded(1);
  assert.equal(e.find(e => e.name === 'Game Started').props.human_players,0);
  assert.equal(e.filter(e => e.name === 'Deck Changed').length,0);
  assert.equal(e.at(-1).props.human_players,1);
});
test('invalid deck/action values and blocked analytics cannot break gameplay', () => {
  const { analytics:a, events:e } = fixture();
  a.handShown('name-or-private-data','initial',2); a.kingPressed('unknown'); assert.equal(e.length,0);
  const blocked = new GameAnalytics(() => { throw new Error('blocked'); });
  assert.doesNotThrow(() => { blocked.handShown('standard','initial',0); blocked.playerAdded(1); blocked.kingPressed('claim'); });
});
