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

test.describe('opening a game on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('never draws the table larger than its layout size, even as it first appears', async ({
        page
    }) => {
        // Record the widest any board layer is ever drawn, from the moment the page loads
        await page.addInitScript(() => {
            const record = window as unknown as { widestBoardLayer: number }
            record.widestBoardLayer = 0
            const measure = () => {
                for (const layer of document.querySelectorAll(
                    '[aria-label="MarraCash market"] > svg'
                )) {
                    record.widestBoardLayer = Math.max(
                        record.widestBoardLayer,
                        Number(layer.getAttribute('width'))
                    )
                }
            }
            new MutationObserver(measure).observe(document, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['width']
            })
        })
        await createGame(page)
        await expect(board(page).locator('> svg')).toHaveCount(3)
        for (const layer of await board(page).locator('> svg').all()) {
            await expect(layer).toHaveAttribute('width', LayoutWidth)
        }
        const widest = await page.evaluate(
            () => (window as unknown as { widestBoardLayer: number }).widestBoardLayer
        )
        expect(widest).toBe(Number(LayoutWidth))
    })
})
