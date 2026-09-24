import { expect, test } from '@playwright/test'

test('a company train purchase names its seller in the Purchased list', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('transfers')

    const panel = page.getByRole('region', { name: 'Train purchases' })
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Other companies' }).click()
    await panel.getByRole('group', { name: 'Souris' }).getByRole('button', { name: '3H' }).click()
    await panel.getByRole('button', { name: 'Offer' }).click()
    await panel.getByRole('button', { name: 'Accept' }).click()
    await expect
        .poll(() =>
            panel.getByLabel('Trains purchased this OR').evaluate((element) => element.textContent)
        )
        .toContain('3H from Souris')
})
