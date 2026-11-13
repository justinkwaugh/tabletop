import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, openScenario, settled } from './helpers.js'

// The contract's Phone layout, Board: the board rests on the middle third, and an offer whose lit
// hexes all lie outside the view brings them into it, keeping the board's scale.
collectPageErrors()

/** Longer than the board's pan takes. */
const PAN_SETTLE_MS = 600

function skipOffPhone() {
    test.skip(
        test.info().project.use.isMobile !== true,
        'The fitted desktop board shows every hex, so none is out of view.'
    )
}

/** The lit hexes whose whole box lies inside the board's frame, where the view shows it. */
function litInView(page: Page): Promise<string[]> {
    return board(page).evaluate((root) => {
        let frame: Element | null = root.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') {
            frame = frame.parentElement
        }
        const clip = frame?.getBoundingClientRect()
        const left = Math.max(0, clip?.left ?? 0)
        const top = Math.max(0, clip?.top ?? 0)
        const right = Math.min(innerWidth, clip?.right ?? innerWidth)
        const bottom = Math.min(innerHeight, clip?.bottom ?? innerHeight)
        return [...root.querySelectorAll('g.hits [role="button"]')].flatMap((hit) => {
            const box = hit.getBoundingClientRect()
            const inside =
                box.left >= left && box.right <= right && box.top >= top && box.bottom <= bottom
            return inside ? [hit.getAttribute('data-hex-id') ?? ''] : []
        })
    })
}

/** Where the board is drawn on screen. */
async function boardBox(page: Page) {
    const box = await board(page).boundingBox()
    expect(box).not.toBeNull()
    return box ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** The screen point at the centre of a lit hex in view, where that hex's own polygon is on top. */
async function litCentreInView(page: Page, inView: readonly string[]) {
    const found = await board(page).evaluate((root, hexIds) => {
        for (const hexId of hexIds) {
            const hit = root.querySelector(`g.hits [data-hex-id="${hexId}"]`)
            const box = hit?.getBoundingClientRect()
            if (!hit || !box) continue
            const x = box.left + box.width / 2
            const y = box.top + box.height / 2
            if (document.elementFromPoint(x, y) === hit) return { hexId, x, y }
        }
        return undefined
    }, inView)
    expect(found).toBeDefined()
    return found ?? { hexId: '', x: 0, y: 0 }
}

test('An offer lit wholly outside the view pans the board to it, keeping its scale', async ({
    page
}) => {
    skipOffPhone()
    await openScenario(page, 'First placement')
    // The six East Coast cities lie outside the middle third the board rests on.
    await expect.poll(() => litInView(page)).not.toEqual([])
    await page.waitForTimeout(PAN_SETTLE_MS)
    const inView = await litInView(page)
    expect(inView.length).toBeGreaterThan(0)
    // The board kept the scale it rests at: a hex at least 33 px wide.
    const box = await boardBox(page)
    const hexWidth = await board(page).evaluate((root) => {
        const hit = root.querySelector('g.hits [role="button"]')
        return hit?.getBoundingClientRect().width ?? 0
    })
    expect(hexWidth).toBeGreaterThanOrEqual(33)
    expect(box.width).toBeGreaterThan(page.viewportSize()?.width ?? 0)
})

test('An offer with a lit hex in view leaves the board where it is', async ({ page }) => {
    skipOffPhone()
    await openScenario(page, 'First placement')
    await expect.poll(() => litInView(page)).not.toEqual([])
    await page.waitForTimeout(PAN_SETTLE_MS)
    const start = await litCentreInView(page, await litInView(page))
    const before = await boardBox(page)

    // Placing there lights the city's neighbours, the next offer, beside it in view.
    await page.touchscreen.tap(start.x, start.y)
    await settled(page)
    await expect
        .poll(() => page.evaluate(() => Object.keys(window.rtrSession.gameState.track).length))
        .toBe(1)
    await settled(page)
    expect((await litInView(page)).length).toBeGreaterThan(0)
    await page.waitForTimeout(PAN_SETTLE_MS)
    expect(await boardBox(page)).toEqual(before)
})
