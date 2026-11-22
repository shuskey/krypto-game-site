import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep deployed smoke tests out of Plausible's real visitor statistics.
  await page.route('https://plausible.io/**', route => route.abort());
  await page.goto('/');
});

test('deals five cards and a target, and opens the rules', async ({ page }) => {
  await expect(page).toHaveTitle(/Krypto!/);
  const cards = page.getByRole('region', { name: 'Dealt cards' });
  await expect(cards).toBeVisible();
  // The cards already have accessible labels, so no test-only markup is needed.
  await expect(cards.locator('[aria-label^="Card "]')).toHaveCount(5);
  await expect(cards.locator('[aria-label^="Target: "]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Krypto!', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: /How to play/ }).click();
  const rules = page.getByRole('dialog');
  await expect(rules).toBeVisible();
  await expect(rules.getByRole('heading', { name: 'Let’s play Krypto!' })).toBeVisible();
  await rules.getByRole('button', { name: 'Close rules' }).click();
  await expect(rules).not.toBeVisible();
});

test('requires a player name, then calculates a reusable result card', async ({ page }) => {
  await page.getByRole('button', { name: 'Krypto!', exact: true }).click();
  const builder = page.getByRole('region', { name: 'Solution builder' });
  const available = builder.getByRole('button', { name: /^Use / });
  await expect(builder).toBeVisible();
  await expect(available).toHaveCount(5);
  await expect(available.first()).toBeDisabled();

  await page.getByLabel('Who called Krypto?').fill('Playwright Player');
  await expect(available.first()).toBeEnabled();

  // Deals are random: calculate the expected sum from the two visible cards.
  const first = Number(await available.nth(0).innerText());
  const second = Number(await available.nth(1).innerText());
  await available.first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await available.first().click();
  await page.getByRole('button', { name: 'Calculate line', exact: true }).click();

  await expect(builder.getByRole('button', {
    name: `Use ${first + second} from step 1`, exact: true,
  })).toBeEnabled();
  await expect(available).toHaveCount(4);
  await expect(page.locator('#feedback')).toContainText(`Step 1 makes ${first + second}.`);
});

test('switches decks and remembers the selected deck after reload', async ({ page }) => {
  const deck = page.getByRole('combobox', { name: /DECK/ });
  await expect(deck).toHaveValue('standard');
  await deck.selectOption({ label: 'Primary age deck' });
  await expect(deck).toHaveValue('primary');
  await expect(page.locator('#round-label')).toContainText('ROUND 02');

  await page.reload();
  await expect(deck).toHaveValue('primary');
  await expect(page.locator('#round-label')).toContainText('ROUND 02');
});

test('solves seeded cards 1 + 2 + 3 + 4 + 5 = 15 and awards one point', async ({ page }) => {
  const playerName = 'Playwright Player';
  // Seed the game's existing saved-game format, then let the app restore it.
  // All calculations and scoring below happen through the real game controls.
  await page.evaluate(savedGame => {
    localStorage.setItem('krypto-table-v1', JSON.stringify(savedGame));
  }, {
    players: [{ name: playerName, score: 0 }],
    deckType: 'standard',
    hand: [1, 2, 3, 4, 5],
    target: 15,
    round: 1,
    answers: [],
    whole: true,
    nextWhole: true,
    sound: false,
    computerDone: false,
    computerOutcome: 'idle',
  });
  await page.reload();

  const cards = page.getByRole('region', { name: 'Dealt cards' });
  for (const value of [1, 2, 3, 4, 5]) {
    await expect(cards.getByLabel(`Card ${value}: ${value}`, { exact: true })).toBeVisible();
  }
  await expect(cards.getByLabel('Target: 15', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Expand scores', exact: true }).click();
  const score = page.locator('#scores .score-row').filter({ hasText: playerName }).locator('.score-points');
  await expect(score).toHaveText('0');

  await page.getByRole('button', { name: 'Krypto!', exact: true }).click();
  await page.getByLabel('Who called Krypto?').fill(playerName);
  const builder = page.getByRole('region', { name: 'Solution builder' });
  for (const value of [1, 2, 3, 4, 5]) {
    if (value > 1) await builder.getByRole('button', { name: 'Add', exact: true }).click();
    await builder.getByRole('button', { name: `Use ${value}`, exact: true }).click();
    // A partial sum must not score, even when it uses some of the seeded cards.
    if (value < 5) await expect(score).toHaveText('0');
  }

  // Krypto scores automatically when the last card completes a winning expression.
  await expect(page.locator('#expression')).toHaveText('1+2+3+4+5');
  await expect(page.locator('#builder-target')).toHaveText('15');
  await expect(builder.getByRole('heading', { name: 'Krypto! You got it.', exact: true })).toBeVisible();
  await expect(page.locator('#feedback')).toContainText(`${playerName} gets a point!`);
  await expect(score).toHaveText('1');
});
