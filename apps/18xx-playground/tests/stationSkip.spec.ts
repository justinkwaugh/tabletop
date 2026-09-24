import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} skips stations with an automatically selected token`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('stations')
        const stationPanel = page.getByRole('region', { name: 'Station placement' })
        await expect(stationPanel.getByRole('button', { name: 'skip', exact: true })).toBeEnabled()
        await stationPanel.getByRole('button', { name: 'skip', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Train purchases' })).toBeVisible()
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(stationPanel.getByRole('button', { name: 'skip', exact: true })).toBeEnabled()
    })
}
