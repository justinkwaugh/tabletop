import { expect, test } from '@playwright/test'

test('consecutive stock passes follow the selected history order', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const passes = page
        .getByRole('list', { name: 'SR 6 actions', exact: true })
        .locator('.passes .stock-action')
    await page.getByRole('button', { name: 'Newest last', exact: true }).click()
    const chronological = await passes.allTextContents()
    expect(new Set(chronological).size).toBeGreaterThan(1)
    await page.getByRole('button', { name: 'Newest first', exact: true }).click()
    await expect(passes).toHaveText(chronological.toReversed())
    await page.getByRole('button', { name: 'Newest last', exact: true }).click()
    await expect(passes).toHaveText(chronological)
})
