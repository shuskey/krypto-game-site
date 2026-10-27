# Krypto analytics

Dashboard: https://plausible.io/krypto-game.chummy-bard-6128.chatgpt.site

Analytics is enabled only on the public production hostname, so local previews and automated unit tests do not pollute traffic. Player names, initials, card values, solutions, and browser-local game identifiers are never included. Counts cap at 100. No extra persistent visitor/session identifier is created by the game.

## Comparing decks

Open **Top Pages → Details**. These are virtual analytics pages; the visible game URL does not change:

| Page | Deck |
| --- | --- |
| `/deck/standard` | Standard deck |
| `/deck/primary` | Primary age deck |

Compare **Visitors**, **Pageviews**, and **Time on Page**. The last metric is Plausible's average visible viewing time for the deck page, not a timer between button clicks. It includes time spent looking at the puzzle. The provider excludes inactive-tab time; it does not infer whether someone is thinking, distracted, or away from a visible screen. Deck switches start a new virtual page, so time is attributed to the deck being viewed. Redeals on the same deck do not create extra pageviews. New page loads resume the saved deck and begin a new deck visit.

For average hands shown per deck visit, filter **Conversions** by the `deck` property and divide **Round Started → Total Conversions** by **Deck Visit → Total Conversions**. This denominator is an uninterrupted deck visit (a page load or a switch to a deck), not a unique person or a full Plausible session. Switching away and back creates another deck visit. A restored hand counts once when shown after a reload; background solver results do not count as new hands.

For average hands shown per visitor, use **Round Started → Total Conversions ÷ Unique Conversions**, with the same deck filter. Plausible's unique-visitor definition applies; this is not the number of people sitting together at a table.

## Events / goals

All events include `deck` (`standard` or `primary`) and `human_players` (0–100, excluding Krypto King).

| Event | Meaning | Additional properties |
| --- | --- | --- |
| Deck Visit | Begin viewing a deck on load or switch | — |
| Deck Changed | Switch to a different deck | `from_deck` |
| Round Started | A dealt or restored hand is shown | `reason`: initial, resume, redeal, new-game, deck-change |
| Krypto King Pressed | Press enabled light-bulb/claim or error-retry button | `action`: claim or retry |
| Human Player Added | A new human joins this game's roster | — |
| Players Present | Human roster snapshot at the beginning of a deck visit | `count` |
| Solution Scored | A validated answer earns a point | `player_type`: human or computer |
| Game Started | User confirms New game | — |

**Krypto King Pressed → Total Conversions** answers how often the computer button is pressed. Filter `action=claim` for light-bulb claims only. Automatic searches, ready bulbs, and disabled X buttons do not increment this event.

**Human Player Added → Total Conversions** counts player additions. Choosing an existing player again does not increment it. Starting a new game and adding that person to the new roster counts as another addition. **Players Present** with its `count` property shows the existing roster sizes at deck-visit entry, including people restored from a previous visit. The `human_players` property on later actions shows how large the table has grown; it is not the number of site visitors. Krypto King never increments human-player counts.

Initial Deck Visit, Players Present, and initial/resumed Round Started events are non-interactive so merely loading a dealt hand does not falsely count as user engagement. Real redeals and other player actions are interactive. The Plausible tracker sends native engagement measurements on deck changes/tab visibility changes; no high-frequency custom heartbeat is used.

## Limits and references

Tracking begins with this deployment; previous gameplay is not backfilled. Browser blocking, connectivity, and abrupt browser termination can lose events. The game works when analytics is blocked. Live installation verification and a small number of owner test visits/actions are included in launch data.

- [Plausible custom locations](https://plausible.io/docs/custom-locations)
- [Metrics definitions](https://plausible.io/docs/metrics-definitions)
- [Custom events and goal setup](https://plausible.io/docs/custom-event-goals)
- [Custom event properties](https://plausible.io/docs/custom-props/for-custom-events)
