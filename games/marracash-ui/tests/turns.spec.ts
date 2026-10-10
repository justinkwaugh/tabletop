import { expect, test } from '@playwright/test'
import {
    actionPanel,
    board,
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
    await expect(actionPanel(page)).toHaveText(/auction an unowned shop/i)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(0)

    await auctionFirstShop(page)
    await expect(actionPanel(page)).toContainText('Sealed bid')
    await expect(auctionableShops(page)).toHaveCount(0)
    await finishBidding(page)
    await expect(actionPanel(page)).toContainText('Your turn')
    await expect(page.locator('g[aria-label^="Owned by"]')).toHaveCount(1)
    await expect(actionPanel(page)).toContainText(/won the yellow shop\./)
    await expect(actionPanel(page).getByRole('table')).toHaveCount(0)
    await expect(actionPanel(page)).not.toContainText('100')
})

test('clicking a shop starts its auction at once, and the auctioneer can undo it or their bid', async ({
    page
}) => {
    await createGame(page)
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    await auctionableShops(page).first().click()
    await expect(actionPanel(page)).toContainText('Sealed bid')
    await expect(page.getByRole('button', { name: 'Start auction' })).toHaveCount(0)

    await undo.click()
    await expect(actionPanel(page)).toHaveText(/auction an unowned shop/i)
    await expect(auctionableShops(page)).toHaveCount(25)

    await auctionFirstShop(page)
    const bidCount = actionPanel(page).getByText(/of 4 bids$/)
    await expect(bidCount).toHaveText('0 of 4 bids')
    await page.getByRole('button', { name: 'Place bid' }).click()
    await expect(bidCount).toHaveText('1 of 4 bids')
    await undo.click()
    await expect(bidCount).toHaveText('0 of 4 bids')
})

test('choosing a fountain dims the board around its destinations, previews a route and Undo restores the turn', async ({
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
    // The route's track and its flowing dashes; its glow is drawn beneath them
    await expect(page.locator('polyline:not(.route-glow)')).toHaveCount(2)
    await expect(page.locator('polyline.route-glow')).toHaveCount(1)

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
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

test('a turn ends on its second move without a confirmation and can still be undone', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    const turnPlayer = page.locator('.turn h1')
    await expect(undo).toHaveCount(0)

    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await undo.click()
    await expect(undo).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Fountain 6', exact: true })).toHaveCount(0)

    const mover = await turnPlayer.innerText()
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 6', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 1' }).click()
    await expect(turnPlayer).not.toHaveText(mover)
    await expect(page.getByRole('button', { name: 'Confirm turn' })).toHaveCount(0)

    // The harness's local seat is the active player, so Admin stands in for the mover
    await page.getByText('Admin', { exact: true }).click()
    await undo.click()
    await expect(page.getByRole('button', { name: 'Fountain 6', exact: true })).toBeVisible()
    await expect(turnPlayer).toHaveText(mover)
})

test('emptied entrances are refilled from a chosen end of the queue', async ({ page }) => {
    await createGame(page)
    await playOpeningRound(page)
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 9' }).click()

    await expect(actionPanel(page)).toContainText('Bring new visitors')
    const boardHalos = board(page).locator('path.candidate-halo')
    await expect(boardHalos).toHaveCount(2)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '3', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Bring 4 visitors from the back' }).first().click()
    await expect(incomingVisitors(page)).toHaveCount(4)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(2)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Front of queue' }).click()
    await expect(incomingVisitors(page)).toHaveCount(0)
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(3)
    await page.getByRole('button', { name: '4', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(4)
    await page.getByRole('button', { name: 'Back of queue' }).click()
    await expect(incomingVisitors(page)).toHaveCount(4)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(incomingVisitors(page)).toHaveCount(0)
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
    await expect(page.getByText(/^1200\s*د\.م\.\s*dirham$/)).toHaveCount(1)
})

test('the history shows who has bid while an auction is open and every bid once it resolves', async ({
    page
}) => {
    await createGame(page)
    await page.getByText('History', { exact: true }).click()
    await auctionFirstShop(page)
    const card = page.locator('.turn-card').first()
    await expect(card).toContainText('0 of 4 bids')
    await page.getByRole('button', { name: 'Place bid' }).click()
    await expect(card).toContainText('1 of 4 bids')
    await expect(card).not.toContainText('100')
    await finishBidding(page)
    await expect(card).toContainText(/Won the .* shop for 100/)
    await expect(card.locator('.bid')).toHaveCount(4)
})

test('the header names the turn and holds the only Undo, with no Back anywhere', async ({
    page
}) => {
    await createGame(page)
    await expect(actionPanel(page)).toContainText('Your turn')
    await auctionableShops(page).first().click()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(actionPanel(page)).toHaveText(/auction an unowned shop/i)

    await playOpeningRound(page)
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 9' }).click()
    await page.getByRole('button', { name: 'Bring 4 visitors from the back' }).first().click()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
})

test('the last refill of a turn can be undone after the next turn has started', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 9' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Front of queue' }).click()
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: 'Back of queue' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await expect(page.getByText('50 waiting')).toBeVisible()
    await expect(actionPanel(page)).toContainText(/move a fountain's visitors/i)

    // The harness's local seat is the active player, so Admin stands in for the previous player
    await page.getByText('Admin', { exact: true }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(actionPanel(page)).toContainText('Bring new visitors to the empty entrance.')
    await expect(page.getByText('52 waiting')).toBeVisible()
})

test('the queue keeps its front at the top as visitors leave either end', async ({ page }) => {
    await createGame(page)
    await playOpeningRound(page)
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 6' }).click()
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 9' }).click()
    await expect(actionPanel(page)).toContainText('Bring new visitors')

    const visitors = page.locator('g[aria-label="Visitor queue"] > g[transform]')
    const line = () =>
        visitors.evaluateAll((elements) =>
            elements.map((element) => ({
                at: element.getAttribute('transform'),
                shown: getComputedStyle(element).opacity !== '0'
            }))
        )
    const before = await line()

    await page.getByRole('button', { name: 'Front of queue' }).click()
    await page.getByRole('button', { name: '4', exact: true }).click()
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect(visitors).toHaveCount(before.length - 4)
    await expect.poll(line).toEqual(before.slice(0, before.length - 4))

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(line).toEqual(before)

    await page.getByRole('button', { name: 'Back of queue' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Fountain 1', exact: true }).click()
    await expect.poll(line).toEqual(before.slice(0, before.length - 3))
})

test('the new-game dialog offers Antique Cards, off by default', async ({ page }) => {
    await page.goto('/')
    const gameName = page.getByPlaceholder('choose a name for your game')
    await expect(async () => {
        await page.getByRole('button', { name: 'New game', exact: true }).click()
        await expect(gameName).toBeVisible({ timeout: 2_000 })
    }).toPass()
    const antiques = page
        .locator('dialog label', { hasText: 'Antique Cards' })
        .locator('input[type=checkbox]')
    await expect(antiques).toHaveCount(1)
    await expect(antiques).not.toBeChecked()
})
