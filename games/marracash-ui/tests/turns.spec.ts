import { expect, test } from '@playwright/test'
import {
    actionPanel,
    auctionFirstShop,
    auctionableShops,
    createGame,
    destinationFountains,
    finishBidding,
    incomingVisitors,
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
    await expect(actionPanel(page)).toHaveText(/choose an unowned shop to auction it/)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(0)

    await auctionFirstShop(page)
    await expect(actionPanel(page)).toContainText('Sealed bid')
    await expect(auctionableShops(page)).toHaveCount(0)
    await finishBidding(page)
    await expect(actionPanel(page)).toContainText('Your turn')
})

test('a chosen shop waits for confirmation and Back cancels it before anyone bids', async ({
    page
}) => {
    await createGame(page)
    await auctionableShops(page).first().click()
    await expect(actionPanel(page)).toContainText('Every player will be asked for a sealed bid')
    await expect(auctionableShops(page)).toHaveCount(0)
    await expect(page.locator('path[filter*="candidate-halo"]')).toHaveCount(1)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(actionPanel(page)).toHaveText(/choose an unowned shop to auction it/)
    await expect(auctionableShops(page)).toHaveCount(25)

    await auctionFirstShop(page)
    await expect(actionPanel(page)).toContainText('Sealed bid')
})

test('choosing a fountain dims the board around its destinations, previews a route and Back restores the turn', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    await expect(auctionableShops(page)).toHaveCount(21)

    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect(auctionableShops(page)).toHaveCount(0)
    await expect(destinationFountains(page)).toHaveCount(3)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(0)
    await expect(actionPanel(page)).toContainText('Choose the destination for these visitors.')

    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).hover()
    await expect(page.locator('polyline')).toHaveCount(2)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(destinationFountains(page)).toHaveCount(0)
    await expect(auctionableShops(page)).toHaveCount(21)
    await expect(page.locator('polyline')).toHaveCount(0)

    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Keep the visitors at fountain 1' }).click()
    await expect(destinationFountains(page)).toHaveCount(0)
    await expect(auctionableShops(page)).toHaveCount(21)

    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 4' }).hover()
    await expect(page.locator('g[aria-label$="entering shop Y1"]')).toHaveAttribute(
        'aria-label',
        '1 entering shop Y1'
    )
    await expect(page.locator('g[aria-label$="entering shop P1"]')).toHaveAttribute(
        'aria-label',
        '1 entering shop P1'
    )
})

test('emptied entrances are refilled from a chosen end of the queue', async ({ page }) => {
    await createGame(page)
    await playOpeningRound(page)
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 9' }).click()

    await expect(actionPanel(page)).toContainText('Bring new visitors')
    await page.getByRole('button', { name: 'Front of queue' }).click()
    await expect(incomingVisitors(page)).toHaveCount(0)
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(3)
    await page.getByRole('button', { name: '4', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(4)
    await page.getByRole('button', { name: 'Back of queue' }).click()
    await expect(incomingVisitors(page)).toHaveCount(4)
    await page.getByRole('button', { name: 'Front of queue' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(0)
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
    await auctionFirstShop(page)
    await finishBidding(page)
    await page.getByText('History', { exact: true }).click()
    await expect(page.getByText('placed a sealed bid')).toHaveCount(3)
    await expect(page.getByText(/bought the .* shop .* Bids:/s)).toBeVisible()
})
