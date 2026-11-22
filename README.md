# Krypto!

A local, static multiplayer-at-one-table arithmetic card game. No install step or runtime dependencies required; Node.js 22 or newer is recommended.

```sh
npm run dev
```

Open http://127.0.0.1:5173. Run `npm test` for the arithmetic/deck tests, and `npm run build` for JavaScript syntax checks. The production-ready static files are in `dist/`; there is no compilation step. The development server listens only on the local computer.

## Learning Playwright

Playwright opens a real browser, interacts with the game, and checks what a player sees. The existing `npm test` tests game logic directly; `npm run test:e2e` tests the page through Chromium. Browser testing needs the development dependencies below, even though serving the game itself needs no dependencies.

### 1. Install once per checkout

Use Node.js 22 or newer. From this repository's folder:

```sh
npm ci
npx playwright install chromium
```

`npm ci` installs the versions recorded in `package-lock.json`; the second command downloads Playwright's matching Chromium browser. On Linux, use `npx playwright install --with-deps chromium` to also install required system libraries.

### 2. Run the starter tests locally

```sh
npm run test:e2e
```

You do **not** need to deploy or start the server first. `playwright.config.js` starts `npm run dev`, waits for http://127.0.0.1:5173, and shuts down its server afterward. It can reuse a server you've already started locally.

The four tests in `e2e/game.spec.js` check the initial cards and rules dialog, player-name gating and a two-card calculation, deck selection surviving a reload, and a winning solution that increases a player's score from 0 to 1. Each test gets a fresh browser context with separate localStorage. The two-card calculation test reads the visible cards so it works with random deals; it does not assume the hand is solvable. The winning test seeds a saved hand of 1, 2, 3, 4, 5 with target 15, then uses the game controls to enter `1 + 2 + 3 + 4 + 5`. The game awards the point automatically when the fifth card is selected.

To run only the seeded winning test:

```sh
npm run test:e2e -- -g "solves seeded cards"
```

### 3. Watch and explore

```sh
npm run test:e2e:headed
npm run test:e2e:ui
```

Run either command: `headed` shows the browser while tests execute; `ui` opens Playwright's interactive runner, where you can select tests and inspect actions. To step through a single test with the Inspector:

```sh
npm run test:e2e -- --debug -g "requires a player name"
```

Read that test alongside the browser. `page` is the browser tab; `getByRole` and `getByLabel` find controls by their accessible names; `click` and `fill` perform actions; `await expect(...)` waits for the expected page state. These assertions retry automatically, so there are no fixed sleeps.

Try changing the expected available-card count from `4` to `5`, run the test to see the failure, then restore `4`. View the last run's HTML report with:

```sh
npm run test:e2e:report
```

Failures include a screenshot and a trace in the report. The trace lets you inspect the page around each action. Reports and test results are ignored by Git. See the [Playwright introduction](https://playwright.dev/docs/intro) for more on running and debugging tests.

### 4. Run the same tests against a deployed Site

```sh
PLAYWRIGHT_BASE_URL=https://krypto-game.chummy-bard-6128.chatgpt.site npm run test:e2e
```

When `PLAYWRIGHT_BASE_URL` is set, the config skips the local server and opens that URL instead. This checks the version currently deployed there; local edits only affect local runs until deployed. The tests block requests to `plausible.io` to keep test activity out of visitor statistics. Their names, calculations, and deck changes stay in their isolated browser storage.

Sites hosting does not require production-only testing: this repo serves the same `dist/` files locally that Sites deploys. Use local tests before deployment and an optional deployed run afterward. A private Site requiring sign-in would also need an authenticated test browser; this starter does not configure that.

### 5. Let GitHub run it

`.github/workflows/playwright.yml` installs dependencies and Chromium, runs the unit tests and syntax checks, then runs all four browser tests against the runner's local server. It runs on pull requests targeting `main`, merge-queue checks targeting `main` (if a merge queue is used), pushes to `main` (including completed merges), and manual dispatch once the workflow is on GitHub. Open the repository's **Actions → Playwright** run to see results and download its HTML report artifact. This workflow checks source before publication; it does not deploy the Site or automatically test production. To prevent merging when tests fail, the repository's branch protection or ruleset must require the `Unit and Playwright tests` status check; workflow triggers alone do not enforce that rule.

## Playing

The game uses one viewport: the green play area contains the dealt cards and Krypto button. Calling Krypto replaces the large cards with the solution builder; **Back to cards** returns to the deal. The right score rail shows colored player initials and points. Expand it with the chevron to see full names and this round’s answers. On narrower screens it opens over the table. Long score lists and step histories scroll within their own panels; the primary controls stay in place. Very short windows may require page scrolling to keep controls readable.

New visitors immediately get a Standard-deck hand: five cards and a target. Existing saved games resume their current hand. **New game** starts a fresh game after confirmation. Press the green **Krypto!** button when someone has an answer, then type or select their name to unlock the solution controls. Blank or whitespace-only names keep the cards and operations disabled. Tap cards and operations to build an expression. **=** makes a green result card that can be used in later lines, providing grouping without parentheses. Standard arithmetic precedence applies within each line. **Undo** removes the last token or, from an empty line, reopens the last calculation. **Clear** resets the attempt.

The game automatically awards one point as soon as all five original cards are used exactly once and the result matches the target and a player name is present. Different solutions can score in the same round. Reordering/regrouping addition and multiplication does not create a new solution; other structurally different expressions count separately. A solution already scored by any player cannot score again that round.

**Redeal** preserves players and scores. **New game** asks for confirmation, then resets the player list and scores. Names, scores, current deal, selected deck, settings, and winning answers are saved in browser localStorage. Unfinished attempts are not saved. Storage is local to that browser and origin; multiple devices/tabs do not synchronize.

Whole-number mode defaults on and disallows fractions and negative intermediate values. Change the checkbox before the next deal to enable exact fractional and negative results. Zero is permitted; division by zero is rejected. There are no timers, losing penalties, or tournament streak bonuses: this version uses the requested one-point-per-solution house rules.

**Standard deck:** three each of 1–6, four each of 7–10, two each of 11–17, one each of 18–25 (56 total). **Primary age deck:** five each of 1–10 (50 total), with a blue table. Every deal reshuffles the entire selected deck and draws six cards without replacement. Switching decks immediately redeals without clearing players or scores. Random deals are not guaranteed solvable.

Rules and deck reference: [Krypto on Wikipedia](https://en.wikipedia.org/wiki/Krypto_(game)). All visuals are original HTML/CSS, inspired by a physical tabletop and the supplied button reference. Celebration sound is synthesized locally with Web Audio. Google Fonts is optional; local system fonts provide a fallback when offline.

## Sites deployment

The public Site is https://krypto-game.chummy-bard-6128.chatgpt.site. The static files in `dist/` are deployed using the project configuration in `.openai/hosting.json`. Player names and scores stay in each visitor’s browser.


## Krypto King

The browser runs an adaptation of Scott Huskey’s F# **KryptoSolver** in a dedicated module Web Worker as soon as each hand is dealt. The source algorithm is in `KryptoSolver/FSharpKrypto/Krypto.fs` and `Tree.fs` in [shuskey/KryptoSolver](https://github.com/shuskey/KryptoSolver): card permutations, all operator combinations, and every binary expression-tree grouping. This JavaScript port searches the same expression space lazily, skips interchangeable permutations of equal cards, and uses exact arithmetic with the current round’s whole-number or relaxed rules. The F# source’s optional exponent/modulo and nearest-answer modes are not part of this game.

A light bulb on **Krypto King**, above **Redeal**, means a solution is cached. Clicking it reveals the calculation and awards exactly one point. Searching alone never scores. An X means no legal solution was found; the button is disabled and the table can redeal. If all solutions were already claimed, that is shown separately. Human play stays enabled while searching. If a person scores the cached answer first, Krypto King searches again for an unclaimed solution. Redealing terminates the old worker and invalidates its results. A computer point stays limited to once per round across reloads. Browser/worker errors show a retry option and are never reported as proof that no solution exists. No external AI API is called.

## Sharing

**Share** opens an original 1200×630 PNG with an intro-copy button and image download. Open Graph and X card metadata use the same image and public Site URL. Regenerate the image with `tools/create_social_preview.py` using Python with Pillow and the listed macOS fonts. The intro is also available in `share-intro.md`.

## Analytics

Production uses Plausible for per-deck visits and viewing time, hands shown, Krypto King presses, human-player additions/counts, and validated wins. Player names and solutions are excluded. Local previews do not transmit analytics. See [the analytics guide](docs/analytics.md) for the dashboard link, event definitions, and average-hands formulas.
