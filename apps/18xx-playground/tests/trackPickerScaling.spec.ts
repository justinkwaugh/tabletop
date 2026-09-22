import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} track preview and controls match the rendered map scale`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await expect(page.locator('[data-map-location]')).toHaveCount(title === 'TOP' ? 110 : 52, { timeout: 15000 })
        await page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`).click()
        await page
            .locator(`[data-map-tile-choice="${title === 'TOP' ? '18xx:8' : '18xx:15'}"]`)
            .click()
        await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')

        async function expectMatchingScale() {
            await expect
                .poll(() =>
                    page.locator('.map-scene').evaluate((svg) => {
                        if (!(svg instanceof SVGSVGElement)) throw new Error('Missing map SVG')
                        const tile = document.querySelector('.tile-choice.chosen')
                        const accept = document.querySelector('[aria-label="Accept track lay"]')
                        if (!tile || !accept) throw new Error('Missing track preview controls')
                        const expected =
                            (106 * svg.getBoundingClientRect().width) / svg.viewBox.baseVal.width
                        return Math.max(
                            Math.abs(tile.getBoundingClientRect().width - expected),
                            Math.abs(accept.getBoundingClientRect().width - expected * 0.42)
                        )
                    })
                )
                .toBeLessThan(0.5)
        }

        await expectMatchingScale()
        const originalWidth = await page
            .locator('.tile-choice.chosen')
            .evaluate((tile) => tile.getBoundingClientRect().width)
        await page
            .getByRole('tabpanel', { name: 'Map', exact: true })
            .getByRole('button', { name: 'Zoom in', exact: true })
            .click()
        await expect
            .poll(() =>
                page
                    .locator('.tile-choice.chosen')
                    .evaluate((tile) => tile.getBoundingClientRect().width)
            )
            .toBeGreaterThan(originalWidth + 1)
        await expectMatchingScale()
        await page.getByRole('button', { name: 'Cancel track lay', exact: true }).click()
        await expect(page.locator('.picker')).toHaveCount(0)
    })
}
