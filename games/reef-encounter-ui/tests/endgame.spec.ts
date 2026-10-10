import { expect, test } from '@playwright/test'
import { actionPanel, createGame, playSetup, settledCount } from './helpers'

test('the game ends when the open sea cannot be refilled, and shows the scores', async ({
    page
}) => {
    test.setTimeout(120_000)
    await createGame(page, 2)
    await playSetup(page, 2)
    const actions = actionPanel(page)
    // Taking the orange space every turn, with no orange cube ever played, empties the supply
    const orange = page.getByRole('button', { name: /^Take the orange larva cube/ })
    while (await settledCount(page, orange)) {
        await orange.click()
        await expect(actions).toContainText(/Grow your reefs|points/)
    }

    await expect(page.getByText('End of game', { exact: true })).toBeVisible()
    await expect(actions).toContainText(/(wins|share the win) with \d+ points/)
    await expect(actions).toContainText('The game ended when the open sea could not be refilled.')
    await expect(actions.locator('tbody tr')).toHaveCount(2)
})
