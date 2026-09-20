import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
    test(`published board preserves tile drafts, history and Undo at ${width}px`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width, height: 960 })
        await page.goto('/table')
        const scene = page.locator('.map-scene')
        const hex = page.locator('[data-map-location="K17"]')
        await page.getByRole('button', { name: 'Use published artwork', exact: true }).waitFor()
        const initialPageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        await page.getByRole('button', { name: 'Use published artwork', exact: true }).click()
        await expect(scene).toHaveAttribute('width', '2048')
        await expect(scene).toHaveAttribute('height', '1394')
        await expect(scene).toHaveAttribute('data-presentation', 'published')
        await expect
            .poll(async () => {
                const board = await scene.boundingBox()
                const area = await page.locator('.map-area').boundingBox()
                return (
                    !!board &&
                    !!area &&
                    board.width <= area.width + 1 &&
                    board.height <= area.height + 1
                )
            })
            .toBe(true)
        await expect(scene.locator('[data-map-layer="board-artwork"]')).toHaveCount(1)
        await expect(scene.locator('[data-map-layer="outlines"] polygon')).toHaveCount(0)
        await expect(scene.locator('[data-placed="false"] .tile-artwork')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
        await hex.click()
        await page.locator('[data-map-tile-choice="18xx:8"]').click()
        await expect(hex.locator('.tile-artwork')).toHaveCount(1)
        await page.getByRole('button', { name: 'Use generic presentation', exact: true }).click()
        await expect(scene).toHaveAttribute('data-presentation', 'generic')
        await expect(
            page.getByRole('button', { name: 'Accept track lay', exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: 'Use published artwork', exact: true }).click()
        await page.getByRole('button', { name: 'Accept track lay', exact: true }).click()
        await expect(hex).toHaveAttribute('data-placed', 'true')
        await expect(hex.locator('.tile-artwork')).toHaveCount(1)
        await page.getByRole('button', { name: 'step backwards', exact: true }).click()
        await expect(hex).toHaveAttribute('data-placed', 'false')
        await expect(hex.locator('.tile-artwork')).toHaveCount(0)
        await expect(scene).toHaveAttribute('data-presentation', 'published')
        await page.getByRole('button', { name: 'go to current', exact: true }).click()
        await expect(hex.locator('.tile-artwork')).toHaveCount(1)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(hex.locator('.tile-artwork')).toHaveCount(0)
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
            .toBe(initialPageWidth)
        await page.getByLabel('Game', { exact: true }).selectOption('1889')
        await expect(
            page.getByRole('button', { name: /Use (published artwork|generic presentation)/ })
        ).toHaveCount(0)
        await expect(scene).toHaveAttribute('data-presentation', 'generic')
        expect(errors).toEqual([])
    })
}
