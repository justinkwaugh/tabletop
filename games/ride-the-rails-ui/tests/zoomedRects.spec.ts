import { expect, test, type Browser, type Page } from '@playwright/test'
import { board, collectPageErrors, openScenario, reportRectsUnzoomed, settled } from './helpers.js'

// docs/phone-rendering.md, Measuring under zoom: the view moves the same where the browser reports
// the boxes inside its CSS zoom unzoomed, as Safari 26.0 and older do. Positions here are read as
// drawn.
collectPageErrors()

test.beforeEach(async ({ page }) => {
    test.skip(
        test.info().project.use.isMobile !== true,
        'The fitted desktop board shows every hex, so none is out of view.'
    )
    await reportRectsUnzoomed(page)
})

/** Longer than the board's pan takes. */
const PAN_SETTLE_MS = 600

/** The lit hexes drawn wholly inside the board's frame and the screen. */
function litDrawnInView(page: Page): Promise<number> {
    return board(page).evaluate((root) => {
        const drawn: (element: Element) => DOMRect = Reflect.get(window, 'rtrDrawnRect')
        let frame: Element | null = root.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') frame = frame.parentElement
        const clip = frame ? drawn(frame) : undefined
        const left = Math.max(0, clip?.left ?? 0)
        const top = Math.max(0, clip?.top ?? 0)
        const right = Math.min(innerWidth, clip?.right ?? innerWidth)
        const bottom = Math.min(innerHeight, clip?.bottom ?? innerHeight)
        return [...root.querySelectorAll('g.hits [role="button"]')]
            .map((hex) => drawn(hex))
            .filter(
                (box) =>
                    box.left >= left && box.top >= top && box.right <= right && box.bottom <= bottom
            ).length
    })
}

/** Where the board is drawn on screen, to the half pixel, measured by the browser's driver. */
async function drawnBoard(page: Page) {
    const box = await board(page).boundingBox()
    expect(box).not.toBeNull()
    const half = (value: number) => Math.round(value * 2) / 2
    return (
        box && { x: half(box.x), y: half(box.y), width: half(box.width), height: half(box.height) }
    )
}

/** A page in a browser that reports boxes inside CSS zoom as drawn, as Chromium does. */
async function asDrawn(browser: Browser): Promise<Page> {
    const context = await browser.newContext(test.info().project.use)
    return context.newPage()
}

async function panToJourneyOffer(page: Page) {
    await openScenario(page, 'Round one ends')
    await page.waitForTimeout(PAN_SETTLE_MS)
    await settled(page)
}

test('A journey offer lit outside the view pans the board where it would as drawn', async ({
    page,
    browser
}) => {
    await panToJourneyOffer(page)
    expect(await litDrawnInView(page)).toBeGreaterThan(0)
    const plain = await asDrawn(browser)
    await panToJourneyOffer(plain)
    expect(await drawnBoard(page)).toEqual(await drawnBoard(plain))
    await plain.context().close()
})
