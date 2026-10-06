import { expect, test, type Page } from '@playwright/test'
import { auctionFirstShop, board, createGame, playOpeningRound } from './helpers'

let pageErrors: string[] = []

test.beforeEach(({ page }) => {
    pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
})

test.afterEach(() => {
    expect(pageErrors).toEqual([])
})

function aidButton(page: Page) {
    return page.getByRole('button', { name: 'Player aid' })
}

function aid(page: Page) {
    return page.getByRole('dialog', { name: 'Player aid' })
}

test('the ? button lays the turn, money and antique cards over the board', async ({ page }) => {
    await createGame(page)
    await aidButton(page).click()
    await expect(aidButton(page)).toHaveAttribute('aria-expanded', 'true')
    for (const card of ['Your Turn', 'Money', 'Antiques']) {
        await expect(aid(page).getByRole('region', { name: card })).toBeVisible()
    }
    await expect(aid(page)).toContainText('Move not allowed after Auction')
    await expect(aid(page)).toContainText('525 or more')
    await expect(aid(page)).toContainText('+ best 5 cards')

    await page.keyboard.press('Escape')
    await expect(aid(page)).toHaveCount(0)

    await aidButton(page).click()
    await board(page).click({ position: { x: 5, y: 5 }, force: true })
    await expect(aid(page)).toHaveCount(0)
})

test('the aid leaves out the antiques card when Antique Cards is off', async ({ page }) => {
    await createGame(page, { antiqueCards: false })
    await aidButton(page).click()
    await expect(aid(page).getByRole('region', { name: 'Money' })).toBeVisible()
    await expect(aid(page).getByRole('region', { name: 'Antiques' })).toHaveCount(0)
})

test('an auction dims the board but keeps fountains and shop signs above the overlay', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    await auctionFirstShop(page)
    const order = await page.evaluate(() => {
        const market = document.querySelector('g[aria-label="MarraCash market"]')
        const overlay = market?.querySelector(':scope > g[opacity="0.25"]')
        const children = [...(market?.children ?? [])]
        const overlayIndex = overlay ? children.indexOf(overlay) : -1
        const indexOf = (selector: string) =>
            children.findIndex(
                (child) => child.matches(selector) || child.querySelector(selector) !== null
            )
        return {
            overlayIndex,
            firstFountain: indexOf('path[filter*="fountain-water"]'),
            firstSign: indexOf('g.pointer-events-none[aria-hidden="true"]')
        }
    })
    expect(order.overlayIndex).toBeGreaterThan(-1)
    expect(order.firstFountain).toBeGreaterThan(order.overlayIndex)
    expect(order.firstSign).toBeGreaterThan(order.overlayIndex)
})
