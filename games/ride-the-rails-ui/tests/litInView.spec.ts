import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, litInView, openScenario, settled } from './helpers.js'

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

/** The hexes the board lights now. */
function litHexIds(page: Page): Promise<string[]> {
    return page.evaluate(() => window.rtrSession.boardOffer.lit.map((hex) => hex.hexId))
}

/** Where the board is drawn on screen. */
async function boardBox(page: Page) {
    const box = await board(page).boundingBox()
    expect(box).not.toBeNull()
    return box ?? { x: 0, y: 0, width: 0, height: 0 }
}

/**
 * Where the board is drawn from its frame's centre. The frame resizes as the panel above it
 * changes, and the view keeps the point at its centre where it was.
 */
function boardInFrame(page: Page) {
    return board(page).evaluate((root) => {
        let frame: Element | null = root.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') {
            frame = frame.parentElement
        }
        const clip = frame?.getBoundingClientRect()
        const box = root.getBoundingClientRect()
        const half = (value: number) => Math.round(value * 2) / 2
        return {
            x: half(box.left - ((clip?.left ?? 0) + (clip?.width ?? 0) / 2)),
            y: half(box.top - ((clip?.top ?? 0) + (clip?.height ?? 0) / 2)),
            width: half(box.width),
            height: half(box.height)
        }
    })
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

// Riding offers, since a building offer is fitted instead (tests/autoZoom.spec.ts).
test('A journey offer lit wholly outside the view pans the board to it, keeping its scale', async ({
    page
}) => {
    skipOffPhone()
    await openScenario(page, 'Round one ends')
    // Dell's journeys start on the East Coast, outside the middle third the board rests on.
    await expect.poll(() => litInView(page)).not.toEqual([])
    await page.waitForTimeout(PAN_SETTLE_MS)
    const inView = await litInView(page)
    expect(inView.length).toBeGreaterThan(0)
    // The board kept the scale it rests at: a hex at least 37 px wide.
    const box = await boardBox(page)
    const hexWidth = await board(page).evaluate((root) => {
        const hit = root.querySelector('g.hits [role="button"]')
        return hit?.getBoundingClientRect().width ?? 0
    })
    expect(hexWidth).toBeGreaterThanOrEqual(37 - 0.1)
    expect(box.width).toBeGreaterThan(page.viewportSize()?.width ?? 0)
})

test('A journey offer with a lit hex in view leaves the board where it is', async ({ page }) => {
    skipOffPhone()
    await openScenario(page, 'Round one ends')
    await expect.poll(() => litInView(page)).not.toEqual([])
    await page.waitForTimeout(PAN_SETTLE_MS)
    const start = await litCentreInView(page, await litInView(page))
    const before = await boardInFrame(page)
    const lit = await litHexIds(page)

    // Starting there lights the cities its links reach, the next offer, beside it in view.
    await page.touchscreen.tap(start.x, start.y)
    await settled(page)
    await expect.poll(() => litHexIds(page)).not.toEqual(lit)
    await settled(page)
    expect((await litInView(page)).length).toBeGreaterThan(0)
    await page.waitForTimeout(PAN_SETTLE_MS)
    expect(await boardInFrame(page)).toEqual(before)
})
