import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHexAt,
    litHexes,
    litInView,
    openScenario,
    pressHex,
    settled
} from './helpers.js'

// The contract's Build section: the deciding seat's view zooms to the hexes its building offer
// lights, a held spotlight narrows it, a hand move holds it, and the turn's end returns it.
collectPageErrors()

/** The contract's cap on how wide the zoom draws a hex. */
const BUILD_ZOOM_MOST_HEX_PX = 64

/** A hex is never drawn wider than this by the zoom (the cap, and rounding). */
const MOST_HEX_PX = BUILD_ZOOM_MOST_HEX_PX + 0.5

/** Screen pixels the phone's focus chooser keeps clear at the top of the board. */
const FOCUS_CHOOSER_INSET_PX = 40

/** Longer than a glide of the view takes to settle and redraw. */
const VIEW_SETTLE_MS = 600

function onPhone(): boolean {
    return test.info().project.use.isMobile === true
}

type Box = { left: number; top: number; width: number; height: number }

/** Where the board is drawn on screen, to the half pixel. */
function boardBox(page: Page): Promise<Box> {
    return board(page).evaluate((root) => {
        const box = root.getBoundingClientRect()
        const half = (value: number) => Math.round(value * 2) / 2
        return {
            left: half(box.left),
            top: half(box.top),
            width: half(box.width),
            height: half(box.height)
        }
    })
}

/** The box the board is clipped to on screen: its frame, within the window. */
function frameBox(page: Page): Promise<Box> {
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
        return { left, top, width: right - left, height: bottom - top }
    })
}

/** Where the board rests once the view has held still. */
async function steadyBoardBox(page: Page): Promise<Box> {
    await settled(page)
    // A glide starts a frame or more after what sets it off.
    await page.waitForTimeout(VIEW_SETTLE_MS)
    let last = await boardBox(page)
    await expect
        .poll(
            async () => {
                const next = await boardBox(page)
                const same = JSON.stringify(next) === JSON.stringify(last)
                last = next
                return same
            },
            { intervals: [250] }
        )
        .toBe(true)
    return last
}

/** How wide a hex is on screen. */
function hexWidth(page: Page): Promise<number> {
    return board(page).evaluate(
        (root) => root.querySelector('g.hits [data-hex-id]')?.getBoundingClientRect().width ?? 0
    )
}

/** Whether the whole board, every hex of the map, is drawn inside its frame. */
async function showsWholeMap(page: Page): Promise<boolean> {
    const box = await boardBox(page)
    const frame = await frameBox(page)
    return (
        box.left >= frame.left - 1 &&
        box.top >= frame.top - 1 &&
        box.left + box.width <= frame.left + frame.width + 1 &&
        box.top + box.height <= frame.top + frame.height + 1
    )
}

/**
 * Presses a railroad's spotlight as a player would: a seat card's share row on desktop (the
 * board's strip may be zoomed out of view), the railroad strip above the board on a phone.
 */
async function pressSpotlight(page: Page, name: string) {
    if (onPhone()) {
        await page.locator(`button[aria-label^="${name}: "][aria-label$=" track"]`).tap()
    } else {
        await page.locator(`button[aria-label^="${name}: "][aria-label*=" share"]`).first().click()
    }
}

/** The lit hexes a railroad may be placed in now. */
function litFor(page: Page, railroadId: string): Promise<string[]> {
    return page.evaluate(
        (id) =>
            window.rtrSession.boardOffer.lit
                .filter((hex) => hex.placements.some((placement) => placement.railroadId === id))
                .map((hex) => hex.hexId),
        railroadId
    )
}

/** Each distinct place the board is drawn, frame by frame, while `act` runs and after. */
async function boardBoxesDuring(page: Page, act: () => Promise<void>): Promise<string[]> {
    await page.evaluate(() => {
        const root = document.querySelector('[data-map-board]')
        const seen: string[] = []
        Reflect.set(window, 'rtrBoardBoxes', seen)
        const watch = () => {
            const box = root?.getBoundingClientRect()
            if (box) {
                const key = [box.left, box.top, box.width].map(Math.round).join(' ')
                if (seen.at(-1) !== key) seen.push(key)
            }
            if (Reflect.get(window, 'rtrBoardBoxes') === seen) requestAnimationFrame(watch)
        }
        watch()
    })
    await act()
    await page.waitForTimeout(VIEW_SETTLE_MS)
    return page.evaluate(() => {
        const seen: unknown = Reflect.get(window, 'rtrBoardBoxes')
        Reflect.set(window, 'rtrBoardBoxes', undefined)
        return Array.isArray(seen) ? seen.map(String) : []
    })
}

test('The first building turn of round 1 zooms the view to the East Coast lit hexes', async ({
    page
}) => {
    await openScenario(page, 'First placement')
    const box = await steadyBoardBox(page)
    await expect(litHexes(page)).toHaveCount(6)
    expect(await litInView(page)).toHaveLength(6)
    const width = await hexWidth(page)
    expect(width).toBeLessThanOrEqual(MOST_HEX_PX)
    expect(width).toBeGreaterThanOrEqual(33)
    // Zoomed in past the whole map the desktop board would otherwise rest at.
    expect(box.width).toBeGreaterThan((await frameBox(page)).width + 1)
    // Fitted: a hex is at its largest, or the lit hexes' box, a hex wider on every side, fills the
    // frame's width or its height below the focus chooser's inset.
    const lit = await litHexes(page).evaluateAll((hexes) => {
        const boxes = hexes.map((hex) => hex.getBoundingClientRect())
        return {
            width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
            height: Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top))
        }
    })
    const frame = await frameBox(page)
    const fills = (padded: number, sizes: number[]) =>
        sizes.some((size) => Math.abs(padded - size) < 2)
    expect(
        width >= BUILD_ZOOM_MOST_HEX_PX - 1 ||
            fills(lit.width + 2 * width, [frame.width]) ||
            fills(lit.height + 2 * width, [frame.height, frame.height - FOCUS_CHOOSER_INSET_PX])
    ).toBe(true)
})

test('A held spotlight narrows the view to its railroad, and its release widens it again', async ({
    page
}) => {
    // Ada holds Red, Orange and Black; Black's start lights nearly every city.
    await openScenario(page, 'Black unstarted')
    await steadyBoardBox(page)
    const wide = await hexWidth(page)
    const red = await litFor(page, 'railroad.red')
    expect(red.length).toBeGreaterThan(0)
    const redInView = async () => (await litInView(page)).filter((hexId) => red.includes(hexId))
    const redBefore = await redInView()

    await pressSpotlight(page, 'Red')
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.heldRailroadId))
        .toBe('railroad.red')
    await steadyBoardBox(page)
    expect(await hexWidth(page)).toBeLessThanOrEqual(MOST_HEX_PX)
    if (onPhone()) {
        // Red's lit hexes are too far apart to fit a phone above its resting scale, so the view
        // keeps that scale and brings in as many of them as fit.
        expect((await redInView()).length).toBeGreaterThan(redBefore.length)
    } else {
        expect(await hexWidth(page)).toBeGreaterThan(wide + 1)
        expect(await redInView()).toEqual(red)
    }

    await pressSpotlight(page, 'Red')
    await expect.poll(() => page.evaluate(() => window.rtrSession.heldRailroadId)).toBe(undefined)
    await steadyBoardBox(page)
    expect(await hexWidth(page)).toBeCloseTo(wide, 0)
})

test('Hovering a railroad strip entry on desktop does not move the view', async ({ page }) => {
    test.skip(onPhone(), 'A phone has no pointer to hover with; a tap presses the spotlight.')
    await openScenario(page, 'Black unstarted')
    const before = await steadyBoardBox(page)
    await board(page)
        .getByRole('button', { name: /^Red: .* track/ })
        .hover()
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.spotlightRailroadId))
        .toBe('railroad.red')
    expect(await page.evaluate(() => window.rtrSession.heldRailroadId)).toBeUndefined()
    await page.waitForTimeout(VIEW_SETTLE_MS)
    expect(await boardBox(page)).toEqual(before)
})

test('A hand pan holds the view across the next placement', async ({ page }) => {
    await openScenario(page, 'First placement')
    await steadyBoardBox(page)
    const frame = await frameBox(page)
    // The northernmost lit city, panned by hand up to the frame's top edge, so the hexes north of
    // it that a start there lights lie out of view.
    const north = await board(page).evaluate((root) => {
        const hexes = [...root.querySelectorAll('g.hits [role="button"]')].map((hit) => ({
            hexId: hit.getAttribute('data-hex-id') ?? '',
            box: hit.getBoundingClientRect()
        }))
        const northmost = hexes.reduce((a, b) => (a.box.top < b.box.top ? a : b))
        return { hexId: northmost.hexId, top: northmost.box.top }
    })
    await page.mouse.move(frame.left + frame.width / 2, frame.top + frame.height / 2)
    const shift = Math.round(north.top - frame.top - 4)
    // Wheel steps this small pan rather than zoom.
    for (let moved = 0; moved < shift; moved += 30) {
        await page.mouse.wheel(0, Math.min(30, shift - moved))
    }
    const panned = await steadyBoardBox(page)
    expect(await litInView(page)).toContain(north.hexId)

    await pressHex(page, litHexAt(page, north.hexId))
    await expect
        .poll(() => page.evaluate(() => Object.keys(window.rtrSession.gameState.track).length))
        .toBe(1)
    await settled(page)
    await page.waitForTimeout(VIEW_SETTLE_MS)
    // The placement lit hexes the view does not show, and still it stays where the hand put it.
    expect((await litInView(page)).length).toBeLessThan(await litHexes(page).count())
    expect(await boardBox(page)).toEqual(panned)
})

test('Done building at the end of the round returns the desktop view to the whole map', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone returns to its resting middle third, not the whole map.')
    await openScenario(page, 'First placement')
    // Ada, Ben and Cora build nothing; each seat's view zooms in turn on the one screen.
    for (const next of ['p2', 'p3', 'p4']) {
        await page.getByRole('button', { name: 'Build nothing', exact: true }).click()
        await expect.poll(() => activePlayerId(page)).toBe(next)
        await steadyBoardBox(page)
        expect(await showsWholeMap(page)).toBe(false)
    }
    // Dell, last in turn order, places and is done: the round goes on to Ride.
    const [first] = await litInView(page)
    await pressHex(page, litHexAt(page, first))
    await page.getByRole('button', { name: 'Done building', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.gameState.machineState))
        .toBe('Riding')
    await steadyBoardBox(page)
    expect(await showsWholeMap(page)).toBe(true)
})

test('A watching seat’s view does not zoom, not even for a held spotlight', async ({ page }) => {
    await openScenario(page, 'First placement')
    await steadyBoardBox(page)
    // The harness's Non-active view: Ben watches Ada build.
    await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(true))
    await expect.poll(() => page.evaluate(() => window.rtrSession.myPlayerId)).toBe('p2')
    await expect(litHexes(page)).toHaveCount(0)
    const watching = await steadyBoardBox(page)
    if (!onPhone()) expect(await showsWholeMap(page)).toBe(true)

    await pressSpotlight(page, 'Red')
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.heldRailroadId))
        .toBe('railroad.red')
    await page.waitForTimeout(VIEW_SETTLE_MS)
    expect(await boardBox(page)).toEqual(watching)
})

test('The zoom glides to a held spotlight’s railroad', async ({ page }) => {
    await openScenario(page, 'Black unstarted')
    await steadyBoardBox(page)
    const boxes = await boardBoxesDuring(page, () => pressSpotlight(page, 'Red'))
    expect(boxes.length).toBeGreaterThan(3)
})

test('With reduced motion the zoom jumps rather than glides', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openScenario(page, 'Black unstarted')
    await steadyBoardBox(page)
    const boxes = await boardBoxesDuring(page, () => pressSpotlight(page, 'Red'))
    // Where it was, and where it jumped to: no frame in between.
    expect(boxes).toHaveLength(2)
})
