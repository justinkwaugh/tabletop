import { expect, test } from '@playwright/test'

test.use({ browserName: 'webkit' })

for (const title of ['TOP', '1889']) {
    test(`${title} route rows do not intercept Run trains`, async ({ page }) => {
        await page.goto('/table')
        await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('routes')
        const panel = page.getByRole('region', { name: 'Run trains', exact: true })
        const run = panel.getByRole('button', { name: 'Run trains', exact: true })
        await expect(run).toBeEnabled()
        await run.click({ timeout: 5000 })
        await expect(panel).toHaveCount(0)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(run).toBeEnabled()
        const row = panel.locator('[data-route-train]').last()
        await row.locator('.income').click()
        await expect
            .poll(() =>
                row.evaluate((element) => {
                    const bounds = element.getBoundingClientRect()
                    const hit = document.elementFromPoint(
                        bounds.right - 4,
                        bounds.y + bounds.height / 2
                    )
                    return !!hit?.closest('button') && element.contains(hit)
                })
            )
            .toBe(true)
        await run.click({ timeout: 5000 })
        await expect(panel).toHaveCount(0)
    })
}
