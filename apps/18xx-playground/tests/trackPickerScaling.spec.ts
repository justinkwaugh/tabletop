import { expect, test } from '@playwright/test'

test('the track picker opens on its hex where getBoundingClientRect leaves out CSS zoom', async ({
    page
}) => {
    // Safari 26.0 and older report a rect inside a CSS-zoomed element divided by its zoom.
    await page.addInitScript(() => {
        const measure = Element.prototype.getBoundingClientRect
        Object.assign(window, { trueRect: (element: Element) => measure.call(element) })
        Element.prototype.getBoundingClientRect = function (this: Element) {
            let zoom = Number.parseFloat(getComputedStyle(this).zoom) || 1
            for (let node = this.parentElement; node; node = node.parentElement)
                zoom *= Number.parseFloat(getComputedStyle(node).zoom) || 1
            const rect = measure.call(this)
            return new DOMRect(rect.x / zoom, rect.y / zoom, rect.width / zoom, rect.height / zoom)
        }
    })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await expect(page.locator('[data-map-location]')).toHaveCount(110, { timeout: 15000 })
    await page.locator('[data-map-location="K17"]').click()
    await page.locator('[data-map-tile-choice="18xx:8"]').click()
    await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
    await expect
        .poll(() =>
            page.locator('.map-scene').evaluate((svg) => {
                const trueRect = (window as unknown as { trueRect(element: Element): DOMRect })
                    .trueRect
                if (!(svg instanceof SVGSVGElement)) throw new Error('Missing map SVG')
                const hex = document.querySelector('[data-map-location="K17"]')
                const tile = document.querySelector('.tile-choice.chosen')
                if (!hex || !tile) throw new Error('Missing hex or chosen tile')
                const expected = (106 * trueRect(svg).width) / svg.viewBox.baseVal.width
                const [hexRect, tileRect] = [trueRect(hex), trueRect(tile)]
                return Math.max(
                    Math.abs(tileRect.width - expected),
                    Math.abs(tileRect.x + tileRect.width / 2 - hexRect.x - hexRect.width / 2),
                    Math.abs(tileRect.y + tileRect.height / 2 - hexRect.y - hexRect.height / 2)
                )
            })
        )
        .toBeLessThan(0.5)
})

for (const title of ['TOP', '1889']) {
    test(`${title} track preview and controls match the rendered map scale`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await expect(page.locator('[data-map-location]')).toHaveCount(title === 'TOP' ? 110 : 52, {
            timeout: 15000
        })
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
            .getByRole('tabpanel', { name: 'Board', exact: true })
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
