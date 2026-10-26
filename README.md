# Krypto!

A local, static multiplayer-at-one-table arithmetic card game. No install step or runtime dependencies required; Node.js 22 or newer is recommended.

```sh
npm run dev
```

Open http://127.0.0.1:5173. Run `npm test` for the arithmetic/deck tests, and `npm run build` for JavaScript syntax checks. The production-ready static files are in `dist/`; there is no compilation step. The development server listens only on the local computer.

## Playing

The game uses one viewport: the green play area contains the dealt cards and Krypto button. Calling Krypto replaces the large cards with the solution builder; **Back to cards** returns to the deal. The right score rail shows colored player initials and points. Expand it with the chevron to see full names and this round’s answers. On narrower screens it opens over the table. Long score lists and step histories scroll within their own panels; the primary controls stay in place. Very short windows may require page scrolling to keep controls readable.

Press **New game** to deal five cards and a target. Press the green **Krypto!** button when someone has an answer, then type or select their name. Tap cards and operations to build an expression. **=** makes a green result card that can be used in later lines, providing grouping without parentheses. Standard arithmetic precedence applies within each line. **Undo** removes the last token or, from an empty line, reopens the last calculation. **Clear** resets the attempt.

The game automatically awards one point as soon as all five original cards are used exactly once and the result matches the target and a player name is present. If the solution is built before entering a name, enter the name and press Enter or leave the field to claim the point. Different solutions can score in the same round. Reordering/regrouping addition and multiplication does not create a new solution; other structurally different expressions count separately. A solution already scored by any player cannot score again that round.

**Redeal** preserves players and scores. **New game** asks for confirmation, then resets the player list and scores. Names, scores, current deal, selected deck, settings, and winning answers are saved in browser localStorage. Unfinished attempts are not saved. Storage is local to that browser and origin; multiple devices/tabs do not synchronize.

Whole-number mode defaults on and disallows fractions and negative intermediate values. Change the checkbox before the next deal to enable exact fractional and negative results. Zero is permitted; division by zero is rejected. There are no timers, losing penalties, or tournament streak bonuses: this version uses the requested one-point-per-solution house rules.

**Standard deck:** three each of 1–6, four each of 7–10, two each of 11–17, one each of 18–25 (56 total). **Primary age deck:** five each of 1–10 (50 total), with a blue table. Every deal reshuffles the entire selected deck and draws six cards without replacement. Switching decks immediately redeals without clearing players or scores. Random deals are not guaranteed solvable.

Rules and deck reference: [Krypto on Wikipedia](https://en.wikipedia.org/wiki/Krypto_(game)). All visuals are original HTML/CSS, inspired by a physical tabletop and the supplied button reference. Celebration sound is synthesized locally with Web Audio. Google Fonts is optional; local system fonts provide a fallback when offline.

## Later Sites deployment

The `dist/` folder can be hosted as a static ChatGPT Site. No Site has been registered or deployed yet. Future hosting should configure `static.directory` as `dist` and preserve this source.
