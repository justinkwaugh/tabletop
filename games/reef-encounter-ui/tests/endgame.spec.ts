import { expect, test } from '@playwright/test'
import { actionPanel, openScenario } from './helpers'

test('the game ends when the open sea cannot be refilled, and shows the scores', async ({
    page
}) => {
    await openScenario(page, 'Last orange larva cube')
    const actions = actionPanel(page)

    await page.getByRole('button', { name: /^Take the orange larva cube/ }).click()

    await expect(page.getByText('End of game', { exact: true })).toBeVisible()
    await expect(actions).toContainText(/(wins|share the win) with \d+ points/)
    await expect(actions).toContainText('The game ended when the open sea could not be refilled.')
    await expect(actions.locator('tbody tr')).toHaveCount(2)
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByText(/parrotfish had been fed/).first()).toBeVisible()
})
