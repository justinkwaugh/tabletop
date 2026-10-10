import { expect, test } from '@playwright/test'
import { actionPanel, createGame, playSetup } from './helpers'

test('a history entry shows the table as its player left it', async ({ page }) => {
    await createGame(page, 2)
    await playSetup(page, 2)
    const actions = actionPanel(page)
    await actions
        .getByRole('button', { name: /^Play an? \w+ larva cube$/ })
        .first()
        .click()
    await page
        .getByRole('button', { name: /^(Place|Attack with) an? / })
        .first()
        .click()
    await page
        .getByRole('button', { name: /^Take the \w+ larva cube/ })
        .first()
        .click()
    await expect(actions).toContainText('Grow your reefs')

    await page.getByRole('tab', { name: 'History' }).click()
    const entries = page.getByRole('button', { name: /^Show the table as \w+ left it$/ })
    await expect(page.getByRole('heading', { name: 'Setup' })).toHaveCount(1)
    // Newest first: the first player's turn, then each player's cubes and feeding in setup
    await expect(entries).toHaveCount(5)
    await entries.nth(1).click()
    // History View shows the game up to that entry, so the later one leaves the list
    await expect(entries).toHaveCount(4)
    // The action panel tells the step that led there: that player taking their larva cubes
    await expect(actions).toContainText(/took (two \w+|an? \w+ and an? \w+) larva cubes?\./)
    await expect(actions).not.toContainText('Grow your reefs')
})

test("Replay plays a turn's moves and returns to the live game", async ({ page }) => {
    await createGame(page, 2)
    await playSetup(page, 2)
    const actions = actionPanel(page)
    await actions
        .getByRole('button', { name: /^Play an? \w+ larva cube$/ })
        .first()
        .click()
    await page
        .getByRole('button', { name: /^(Place|Attack with) an? / })
        .first()
        .click()
    await page
        .getByRole('button', { name: /^Take the \w+ larva cube/ })
        .first()
        .click()
    await expect(actions).toContainText('Grow your reefs')

    await page.getByRole('tab', { name: 'History' }).click()
    // Setup choices move no pieces, so only the turn replays
    const replays = page.getByRole('button', { name: /^Replay \w+'s moves$/ })
    await expect(replays).toHaveCount(1)
    await replays.click()
    await expect(page.getByText('Replaying')).toBeVisible()
    await expect(page.getByText('Replaying')).toHaveCount(0, { timeout: 15_000 })
    await expect(actions).toContainText('Grow your reefs')
    await expect(replays).toHaveCount(1)
})
