import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} history controls show one themed toolbar at every breakpoint`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)

        for (const width of [390, 639, 640, 1100, 390]) {
            await page.setViewportSize({ width, height: 900 })
            const fork = page.getByRole('button', { name: 'fork game', exact: true })
            await expect(fork).toHaveCount(1)
            await expect(fork.locator('svg')).toHaveCSS('color', 'rgb(105, 85, 64)')
            const backward = page.getByRole('button', { name: 'step backwards', exact: true })
            await expect(backward).toHaveCount(1)
            await expect(backward.locator('svg')).toHaveCSS('color', 'rgb(185, 174, 159)')
        }
    })
}
