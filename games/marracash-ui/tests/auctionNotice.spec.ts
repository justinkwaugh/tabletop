import { expect, test, type Page } from '@playwright/test'
import {
    actionPanel,
    auctionFirstShop,
    auctionableShops,
    board,
    createGame,
    finishBidding
} from './helpers'

function notice(page: Page) {
    return page.getByRole('status').filter({ hasText: /(is|are) auctioning a/ })
}

function stallPlacard(page: Page) {
    return board(page).locator('g.placard')
}

function historyButton(page: Page, name: string) {
    return page.locator(`button[aria-label="${name}"]:visible`).first()
}

test('your own auction is announced to you, then its placard settles on the stall', async ({
    page
}) => {
    await createGame(page)
    await auctionFirstShop(page)
    await expect(notice(page)).toContainText(
        /you are auctioning a\s+(red|blue|green|yellow|purple) shop/i
    )
    await expect(stallPlacard(page)).toBeHidden()
    await expect(notice(page)).toHaveCount(0, { timeout: 8_000 })
    await expect(stallPlacard(page)).toBeVisible()
})

// The next player starts an auction while the board is watched from Amira's seat, then the
// view steps back to just before it.
async function watchAnotherPlayersAuction(page: Page) {
    await createGame(page)
    await auctionFirstShop(page)
    await finishBidding(page)
    await auctionableShops(page).first().click()
    await expect(actionPanel(page).getByText('Sealed bid')).toBeVisible()
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByLabel('Protected view', { exact: true }).selectOption({ label: 'Amira' })
    await expect(board(page)).toBeVisible()
    await historyButton(page, 'step backwards').click()
}

// Replays the auction start in full, as it played live.
async function replayAuctionStart(page: Page) {
    await page.keyboard.down('Shift')
    await historyButton(page, 'step forwards').click()
    await page.keyboard.up('Shift')
}

test("another player's auction is announced, then its placard settles on the stall", async ({
    page
}) => {
    await watchAnotherPlayersAuction(page)

    // A state-only step forward and back never announces it.
    await historyButton(page, 'step forwards').click()
    await expect(stallPlacard(page)).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
    await historyButton(page, 'step backwards').click()

    // Replaying the action in full announces it as it was announced live.
    await replayAuctionStart(page)
    await expect(notice(page)).toContainText(
        /\w+ is auctioning a\s+(red|blue|green|yellow|purple) shop/
    )
    await expect(stallPlacard(page)).toBeHidden()
    await expect(notice(page)).toHaveCount(0, { timeout: 8_000 })
    await expect(stallPlacard(page)).toBeVisible()
})

test('entering full screen during an announcement carries it on in full screen', async ({
    page
}) => {
    await watchAnotherPlayersAuction(page)
    await replayAuctionStart(page)
    await expect(page.locator('div.placard')).toHaveCSS('opacity', '1')
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const fullScreen = page.getByRole('dialog', { name: 'Full screen view' })
    // The notice remounted there shows the announcement as far as it has got, not from the start.
    const placard = fullScreen.locator('.placard').first()
    await expect(fullScreen.getByRole('status')).toContainText('is auctioning a')
    expect(Number(await placard.evaluate((element) => element.style.opacity))).toBeGreaterThan(0.9)
    await expect(fullScreen.getByRole('status')).toHaveCount(0, { timeout: 8_000 })
    await expect(fullScreen.locator('g.placard')).toBeVisible()
})

test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the announcement fades in and out without moving', async ({ page }) => {
        await watchAnotherPlayersAuction(page)
        await replayAuctionStart(page)
        await expect(notice(page)).toBeVisible()
        const transforms = async () =>
            page.evaluate(() => {
                const card = document.querySelector<HTMLElement>('[role="status"]')
                const placard = card?.previousElementSibling?.firstElementChild
                return [
                    card?.style.transform,
                    placard instanceof HTMLElement ? placard.style.transform : undefined
                ]
            })
        const still = ['translateY(0px)', 'translate(0px, 0px) scale(1)']
        expect(await transforms()).toEqual(still)
        await page.waitForTimeout(1_600)
        expect(await transforms()).toEqual(still)
        await expect(notice(page)).toHaveCount(0, { timeout: 8_000 })
        await expect(stallPlacard(page)).toBeVisible()
    })
})

test('the placard lands on the stall where getBoundingClientRect leaves out CSS zoom', async ({
    page
}) => {
    // Safari 26.0 and older report a rect inside a CSS-zoomed element divided by its zoom.
    await page.addInitScript(() => {
        const measure = Element.prototype.getBoundingClientRect
        Element.prototype.getBoundingClientRect = function (this: Element) {
            let zoom = Number.parseFloat(getComputedStyle(this).zoom) || 1
            for (let node = this.parentElement; node; node = node.parentElement)
                zoom *= Number.parseFloat(getComputedStyle(node).zoom) || 1
            const rect = measure.call(this)
            return new DOMRect(rect.x / zoom, rect.y / zoom, rect.width / zoom, rect.height / zoom)
        }
    })
    await createGame(page)
    const boardZoom = await board(page).evaluate((svg) => {
        const zoomed = svg.closest<HTMLElement>('[style*="zoom"]')
        return zoomed ? Number.parseFloat(getComputedStyle(zoomed).zoom) : 1
    })
    expect(boardZoom).toBeLessThan(0.9)
    await auctionFirstShop(page)
    await expect(page.locator('div.placard')).toHaveCount(1)
    // The fake patches only getBoundingClientRect, so getClientRects gives the rect as drawn.
    const landing = await page.evaluate(
        () =>
            new Promise<number>((resolve) => {
                let gap = Number.POSITIVE_INFINITY
                function frame() {
                    const flying = document.querySelector('div.placard')
                    const stall = document.querySelector('g.placard')?.getClientRects()[0]
                    if (!flying || !stall) return resolve(gap)
                    const placard = flying.getClientRects()[0]
                    if (placard && Number(getComputedStyle(flying).opacity) > 0)
                        gap = Math.max(
                            Math.abs(placard.x + placard.width / 2 - stall.x - stall.width / 2),
                            Math.abs(placard.y + placard.height / 2 - stall.y - stall.height / 2),
                            Math.abs(placard.width - stall.width)
                        )
                    requestAnimationFrame(frame)
                }
                requestAnimationFrame(frame)
            })
    )
    expect(landing).toBeLessThan(2)
})
