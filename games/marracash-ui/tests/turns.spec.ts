import { expect, test } from '@playwright/test'
import {
    actionPanel,
    auctionableShops,
    createGame,
    exitArrows,
    finishBidding,
    playOpeningRound
} from './helpers'

let pageErrors: string[] = []

test.beforeEach(({ page }) => {
    pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
})

test.afterEach(() => {
    expect(pageErrors).toEqual([])
})

test('round 1 offers only auctions and collects a sealed bid from everyone', async ({ page }) => {
    await createGame(page)
    await expect(actionPanel(page)).toHaveText(/click an unowned shop to auction it/)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(0)

    await auctionableShops(page).first().click()
    await expect(actionPanel(page)).toContainText('Sealed bid')
    await expect(auctionableShops(page)).toHaveCount(0)
    await finishBidding(page)
    await expect(actionPanel(page)).toContainText('Your turn')
})

test('choosing a fountain shows its exits, previews a route and Back restores the turn', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    await expect(auctionableShops(page)).toHaveCount(21)

    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect(auctionableShops(page)).toHaveCount(0)
    await expect(exitArrows(page)).toHaveCount(3)

    await page.getByRole('button', { name: 'Move visitors S to fountain 6' }).hover()
    await expect(page.locator('polyline')).toHaveCount(2)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(exitArrows(page)).toHaveCount(0)
    await expect(auctionableShops(page)).toHaveCount(21)
    await expect(page.locator('polyline')).toHaveCount(0)
})

test('emptied entrances are refilled from a chosen end of the queue', async ({ page }) => {
    await createGame(page)
    await playOpeningRound(page)
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors S to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors E to fountain 9' }).click()

    await expect(actionPanel(page)).toContainText('Bring new visitors')
    await page.getByRole('button', { name: 'Front of queue' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect(page.getByText('52 waiting')).toBeVisible()

    await page.getByRole('button', { name: 'Back of queue' }).click()
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await expect(page.getByText('50 waiting')).toBeVisible()
    await expect(actionPanel(page)).toContainText('Your turn')
})

test('Concealed Cash hides other players’ cash', async ({ page }) => {
    await createGame(page, { concealedCash: true })
    await expect(page.getByText('Cash hidden')).toHaveCount(3)
    await expect(page.getByText('1200 Dirham')).toHaveCount(1)
})

test('the history keeps other players’ bids sealed until the auction resolves', async ({
    page
}) => {
    await createGame(page)
    await auctionableShops(page).first().click()
    await finishBidding(page)
    await page.getByText('History', { exact: true }).click()
    await expect(page.getByText('placed a sealed bid')).toHaveCount(3)
    await expect(page.getByText(/bought the .* shop .* Bids:/s)).toBeVisible()
})
