import { expect, test, type Page } from '@playwright/test'
import { board, createGame } from './helpers'

// Laid out at 1228 x 908; a large screen draws it 1.5 times that size, a phone at its layout size.
const LayoutWidth = '1228'
const LargeWidth = '1842'

function groundLayer(page: Page) {
    return board(page).locator('> svg').first()
}

test('a large screen draws the table half again as large and a phone at its layout size', async ({
    page
}) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await createGame(page)
    await expect(groundLayer(page)).toHaveAttribute('width', LargeWidth)

    // Drawn larger, the board's stacked layers outgrow the graphics memory iOS gives a page
    for (const viewport of [
        { width: 390, height: 844 },
        { width: 844, height: 390 }
    ]) {
        await page.setViewportSize(viewport)
        await expect(groundLayer(page)).toHaveAttribute('width', LayoutWidth)
        await expect(board(page).locator('> svg')).toHaveCount(3)
        for (const layer of await board(page).locator('> svg').all()) {
            await expect(layer).toHaveAttribute('width', LayoutWidth)
        }
    }

    // Back on a large screen the board is drawn larger again and the wrapper refits it
    await page.setViewportSize({ width: 1600, height: 1000 })
    await expect(groundLayer(page)).toHaveAttribute('width', LargeWidth)
    await expect(async () => {
        const box = await board(page).boundingBox()
        expect(box!.width).toBeLessThanOrEqual(1600)
    }).toPass()
})
