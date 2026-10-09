import { expect, test, type Page } from '@playwright/test'
import { auctionFirstShop, board, createGame, playOpeningRound } from './helpers'

// In WebKit, mounting a fountain's basin into the board restyles and repaints it, so raising a
// fountain above the overlay only swaps which of its two drawn copies is visible.
async function basinsMountedBy(page: Page, act: () => Promise<void>): Promise<number> {
    await page.evaluate(() => {
        const record = { basins: 0 }
        Object.assign(window, { basinRecord: record })
        new MutationObserver((records) => {
            for (const added of records.flatMap((r) => [...r.addedNodes])) {
                if (!(added instanceof Element)) continue
                const water = '[fill*="fountain-water-shade"]'
                record.basins += added.matches(water) ? 1 : added.querySelectorAll(water).length
            }
        }).observe(document.querySelector('[aria-label="MarraCash market"]')!, {
            childList: true,
            subtree: true
        })
    })
    await act()
    await page.waitForTimeout(500)
    return page.evaluate(
        () => (window as unknown as { basinRecord: { basins: number } }).basinRecord.basins
    )
}

test('choosing a fountain raises it and its destinations without mounting a basin', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    const mounted = await basinsMountedBy(page, () =>
        page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    )
    await expect(
        page.getByRole('button', { name: 'Keep the visitors at fountain 8' })
    ).toBeVisible()
    expect(mounted).toBe(0)
})

test('starting an auction keeps every fountain above the overlay without mounting a basin', async ({
    page
}) => {
    await createGame(page)
    const mounted = await basinsMountedBy(page, () => auctionFirstShop(page))
    await expect(board(page).locator('g[opacity="0.25"]')).toHaveCount(1)
    expect(mounted).toBe(0)
})
