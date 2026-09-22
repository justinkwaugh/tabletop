import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
    test(`published board preserves tile selections, history and Undo at ${width}px`, async ({
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
        await expect(scene).toHaveAttribute('height', '1322')
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
        await expect(hex.locator('[data-tile-grain]')).toHaveCount(1)
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

test('published artwork swaps token art and private cards', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    const publishedTokens = page.locator('image[href*="published/tokens/"]')
    await page.getByRole('button', { name: 'Use published artwork', exact: true }).waitFor()
    await expect(publishedTokens).toHaveCount(0)
    await page.getByRole('button', { name: 'Use published artwork', exact: true }).click()
    await expect.poll(() => publishedTokens.count()).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Use generic presentation', exact: true }).click()
    await expect(publishedTokens).toHaveCount(0)

    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    const cardImages = page.locator('[data-card-image] img')
    const offers = page.getByRole('region', { name: 'Auction offers' })
    await page.getByRole('button', { name: 'Use published artwork', exact: true }).click()
    const peirLot = offers.locator('button.name', { hasText: 'PEIR' }).first()
    await peirLot.click()
    await expect(cardImages).toHaveCount(1)
    await expect(cardImages.first()).toHaveAttribute('src', /published\/peirs\/v2\//)
    await page.keyboard.press('Escape')
    await expect(cardImages).toHaveCount(0)
    await offers.getByRole('button', { name: 'Offer Merchants and Co.', exact: true }).click()
    const bidding = page.getByRole('article', { name: 'Current auction' })
    await expect(bidding.locator('[data-card-image] img')).toHaveAttribute(
        'src',
        /published\/privates\//
    )
    await bidding.getByRole('button', { name: 'Show Merchants and Co. card', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Merchants and Co.' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Merchants and Co.' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Bid', exact: true }).click()
    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    const summary = page.getByRole('region', { name: 'Position summary' })
    await expect(summary).toContainText('offered Merchants and Co.')
    await expect(summary.locator('[data-card-image] img')).toHaveAttribute(
        'src',
        /published\/privates\//
    )
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await page.getByRole('button', { name: 'Use generic presentation', exact: true }).click()
    await expect(cardImages).toHaveCount(0)
    await expect(bidding.locator('.private-card h3')).toHaveText('Merchants and Co.')
    expect(errors).toEqual([])
})
