import { expect, test, type Locator, type Page } from '@playwright/test'
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
    await expect(aid(page)).toContainText('over 500')
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
    const raised = await page.evaluate(() => {
        const overlay = document.querySelector('[aria-label="MarraCash market"] g[opacity="0.25"]')
        const follows = (selector: string) =>
            [...document.querySelectorAll(`[aria-label="MarraCash market"] ${selector}`)].filter(
                (element) =>
                    overlay !== null &&
                    overlay.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING
            ).length
        return {
            overlay: overlay !== null,
            fountainsAbove: follows('path[fill*="fountain-glints"]'),
            signsAbove: follows('g.pointer-events-none[aria-hidden="true"]')
        }
    })
    expect(raised.overlay).toBe(true)
    expect(raised.fountainsAbove).toBeGreaterThan(0)
    expect(raised.signsAbove).toBeGreaterThan(0)
})

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('the aid scrolls from its first card instead of cutting it off', async ({ page }) => {
        await createGame(page)
        await aidButton(page).click()
        const top = await aid(page).evaluate((cards) => {
            const area = cards.parentElement
            return cards.getBoundingClientRect().top - (area?.getBoundingClientRect().top ?? 0)
        })
        expect(top).toBeGreaterThanOrEqual(0)
        await expect(aid(page).getByRole('region', { name: 'Your Turn' })).toBeInViewport()
    })
})

test('full screen keeps the action panel and the aid', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const fullScreen = page.getByRole('dialog', { name: 'Full screen view' })
    await expect(fullScreen.getByRole('region', { name: 'Actions' })).toBeVisible()
    await fullScreen.getByRole('button', { name: 'Player aid' }).click()
    await expect(fullScreen.getByRole('dialog', { name: 'Player aid' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(aid(page)).toHaveCount(0)
    await expect(fullScreen.getByRole('region', { name: 'Actions' })).toBeVisible()
})

test('a bid being raised carries across full screen and back', async ({ page }) => {
    await createGame(page)
    await auctionFirstShop(page)
    const raise = (scope: Locator) => scope.getByRole('button', { name: 'Raise bid' }).click()
    const shownBid = (scope: Locator) => scope.getByRole('region', { name: 'Actions' })
    await raise(page.locator('body'))
    await raise(page.locator('body'))
    await expect(shownBid(page.locator('body'))).toContainText('150')

    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const fullScreen = page.getByRole('dialog', { name: 'Full screen view' })
    await expect(shownBid(fullScreen)).toContainText('150')
    await raise(fullScreen)
    await expect(shownBid(fullScreen)).toContainText('175')

    await fullScreen.getByRole('button', { name: 'Exit full screen' }).click()
    await expect(page.getByRole('region', { name: 'Actions' })).toHaveCount(1)
    await expect(shownBid(page.locator('body'))).toContainText('175')
})

test('the aid takes keyboard focus, keeps the board out of reach and hands focus back', async ({
    page
}) => {
    await createGame(page)
    await aidButton(page).focus()
    await expect(aidButton(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(aid(page)).toBeFocused()
    await expect(page.locator('g[aria-label^="Auction shop"]').first()).not.toBeFocused()
    expect(
        await page
            .getByRole('img', { name: 'MarraCash market' })
            .evaluate((market) => market.closest('[inert]') !== null)
    ).toBe(true)

    await page.keyboard.press('Escape')
    await expect(aid(page)).toHaveCount(0)
    await expect(aidButton(page)).toBeFocused()
})
