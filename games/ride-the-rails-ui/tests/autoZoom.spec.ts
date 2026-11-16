import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    boardBox,
    collectPageErrors,
    litHexAt,
    litHexes,
    litInView,
    openScenario,
    pressHex,
    settled,
    type BoardBox
} from './helpers.js'

// The contract's Build section: the deciding seat's view zooms to the hexes its building offer
// lights, a held spotlight narrows it, a hand move holds it, and the turn's end returns it.
collectPageErrors()

/** The contract's cap on how wide the zoom draws a hex. */
const BUILD_ZOOM_MOST_HEX_PX = 64

/** The contract's floor: a phone's board rests, and the zoom never goes below, a hex this wide. */
const RESTING_HEX_PX = 37

/** A hex is never drawn wider than this by the zoom (the cap, and rounding). */
const MOST_HEX_PX = BUILD_ZOOM_MOST_HEX_PX + 0.5

/** Longer than a glide of the view takes to settle and redraw. */
const VIEW_SETTLE_MS = 600

function onPhone(): boolean {
    return test.info().project.use.isMobile === true
}

/** The box the board is clipped to on screen: its frame, within the window. */
function frameBox(page: Page): Promise<BoardBox> {
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

/** A railroad's card above the board on desktop, or its card in a phone's build panel. */
function railroadEntry(page: Page, name: string) {
    return page
        .getByRole('group', { name: 'Railroads' })
        .getByRole('button', { name: new RegExp(`^${name}: `) })
}

/** Presses a railroad's spotlight as a player would: its card, or its build panel card on a phone. */
async function pressSpotlight(page: Page, name: string) {
    if (onPhone()) {
        await railroadEntry(page, name).tap()
    } else {
        await railroadEntry(page, name).click()
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
    const box = await settled(page)
    await expect(litHexes(page)).toHaveCount(6)
    expect(await litInView(page)).toHaveLength(6)
    const width = await hexWidth(page)
    expect(width).toBeLessThanOrEqual(MOST_HEX_PX)
    expect(width).toBeGreaterThanOrEqual(RESTING_HEX_PX - 0.1)
    // Zoomed in past the whole map the desktop board would otherwise rest at.
    expect(box.width).toBeGreaterThan((await frameBox(page)).width + 1)
    // Fitted: a hex is at its largest, or the lit hexes' box, a hex wider on every side, fills the
    // frame's width or its height, or (a phone, where that box is wider than the view at the
    // resting scale) the view keeps the resting scale.
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
            (onPhone() && Math.abs(width - RESTING_HEX_PX) < 0.5) ||
            fills(lit.width + 2 * width, [frame.width]) ||
            fills(lit.height + 2 * width, [frame.height])
    ).toBe(true)
})

test('A held spotlight narrows the view to its railroad, and its release widens it again', async ({
    page
}) => {
    // Ada holds Red, Orange and Black; Black's start lights nearly every city.
    await openScenario(page, 'Black unstarted')
    const wide = await hexWidth(page)
    const red = await litFor(page, 'railroad.red')
    expect(red.length).toBeGreaterThan(0)
    const redInView = async () => (await litInView(page)).filter((hexId) => red.includes(hexId))
    const redBefore = await redInView()

    await pressSpotlight(page, 'Red')
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.heldRailroadId))
        .toBe('railroad.red')
    await settled(page)
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
    await settled(page)
    expect(await hexWidth(page)).toBeCloseTo(wide, 0)
})

test('Hovering a railroad card on desktop does not move the view', async ({ page }) => {
    test.skip(onPhone(), 'A phone has no pointer to hover with; a tap presses the spotlight.')
    await openScenario(page, 'Black unstarted')
    const before = await settled(page)
    await railroadEntry(page, 'Red').hover()
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.spotlightRailroadId))
        .toBe('railroad.red')
    expect(await page.evaluate(() => window.rtrSession.heldRailroadId)).toBeUndefined()
    await page.waitForTimeout(VIEW_SETTLE_MS)
    expect(await boardBox(page)).toEqual(before)
})

test('A hand pan holds the view across the next placement', async ({ page }) => {
    await openScenario(page, 'First placement')
    const frame = await frameBox(page)
    // The northernmost lit city, panned by hand up to the frame's top edge, so the hexes north of
    // it that a start there lights lie out of view. The cropped board's whole height nearly fits
    // a phone, so there the westernmost lit city is panned to the frame's left edge instead.
    const sideways = onPhone()
    const edge = await board(page).evaluate((root, west) => {
        const hexes = [...root.querySelectorAll('g.hits [role="button"]')].map((hit) => ({
            hexId: hit.getAttribute('data-hex-id') ?? '',
            box: hit.getBoundingClientRect()
        }))
        const reach = (hex: (typeof hexes)[number]) => (west ? hex.box.left : hex.box.top)
        const outmost = hexes.reduce((a, b) => (reach(a) < reach(b) ? a : b))
        return { hexId: outmost.hexId, reach: reach(outmost) }
    }, sideways)
    await page.mouse.move(frame.left + frame.width / 2, frame.top + frame.height / 2)
    const shift = Math.round(edge.reach - (sideways ? frame.left : frame.top) - 4)
    // Wheel steps this small pan rather than zoom.
    for (let moved = 0; moved < shift; moved += 30) {
        const step = Math.min(30, shift - moved)
        await page.mouse.wheel(sideways ? step : 0, sideways ? 0 : step)
    }
    const panned = await settled(page)
    expect(await litInView(page)).toContain(edge.hexId)

    await pressHex(page, litHexAt(page, edge.hexId))
    await expect
        .poll(() => page.evaluate(() => Object.keys(window.rtrSession.gameState.track).length))
        .toBe(1)
    await settled(page)
    await page.waitForTimeout(VIEW_SETTLE_MS)
    // The placement lit hexes the view does not show, and still it stays where the hand put it.
    expect((await litInView(page)).length).toBeLessThan(await litHexes(page).count())
    expect(await boardBox(page)).toEqual(panned)
})

test('Done at the end of the round returns the desktop view to the whole map', async ({ page }) => {
    test.skip(onPhone(), 'A phone returns to its resting middle third, not the whole map.')
    await openScenario(page, 'First placement')
    // Ada, Ben and Cora press Skip; each seat's view zooms in turn on the one screen.
    for (const next of ['p2', 'p3', 'p4']) {
        await page.getByRole('button', { name: 'Skip', exact: true }).click()
        await expect.poll(() => activePlayerId(page)).toBe(next)
        await settled(page)
        expect(await showsWholeMap(page)).toBe(false)
    }
    // Dell, last in turn order, places and is done. One locomotive links no cities, so every
    // seat passes its journey by itself (R-3.3.1) and the round ends: round 2 takes shares.
    const [first] = await litInView(page)
    await pressHex(page, litHexAt(page, first))
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expectNextRound(page)
    await settled(page)
    expect(await showsWholeMap(page)).toBe(true)
})

/** Drags the board by hand from the middle of its frame. */
async function dragBoard(page: Page, dx: number, dy: number) {
    const frame = await frameBox(page)
    const x = frame.left + frame.width / 2
    const y = frame.top + frame.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let step = 1; step <= 10; step++) {
        await page.mouse.move(x + (dx * step) / 10, y + (dy * step) / 10)
    }
    await page.mouse.up()
}

/**
 * Waits for round 2's Take a share. With no track to ride, every seat passes its journey by itself
 * (R-3.3.1), so the round ends straight after building.
 */
async function expectNextRound(page: Page) {
    await expect
        .poll(() =>
            page.evaluate(() => [
                window.rtrSession.gameState.machineState,
                window.rtrSession.gameState.roundManager.currentRound?.number
            ])
        )
        .toEqual(['TakingShares', 2])
}

/**
 * From "First placement": Ada first drags her zoomed view by hand if asked, then all four seats
 * press Skip, no seat has a journey, and round 2 opens on Take a share. Returns where the board
 * rests once it does.
 */
async function skipToNextRound(page: Page, dragFirst: boolean): Promise<BoardBox> {
    await openScenario(page, 'First placement')
    const zoomed = await settled(page)
    if (dragFirst) {
        await dragBoard(page, 80, 60)
        expect(await settled(page)).not.toEqual(zoomed)
    }
    for (const next of ['p2', 'p3', 'p4']) {
        await page.getByRole('button', { name: 'Skip', exact: true }).click()
        await expect.poll(() => activePlayerId(page)).toBe(next)
        await settled(page)
    }
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expectNextRound(page)
    await settled(page)
    await page.waitForTimeout(VIEW_SETTLE_MS)
    return settled(page)
}

test('The next round opens on the whole desktop map after a hand move in a building turn', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone returns to its resting middle third, not the whole map.')
    await skipToNextRound(page, true)
    expect(await showsWholeMap(page)).toBe(true)
})

test('The next round opens on the phone’s resting view after a hand move in a building turn', async ({
    page
}) => {
    test.skip(!onPhone(), 'The desktop returns to the whole map.')
    const untouched = await skipToNextRound(page, false)
    const moved = await skipToNextRound(page, true)
    // The resting view: the middle third at its scale, where the same turns end with no hand move.
    expect(Math.abs((await hexWidth(page)) - RESTING_HEX_PX)).toBeLessThan(0.5)
    expect(moved).toEqual(untouched)
})

/** What the view shows: how wide a hex is, and where on the board the frame's centre falls. */
type ShownView = { hexWidth: number; x: number; y: number }

async function viewShown(page: Page): Promise<ShownView> {
    const box = await settled(page)
    const frame = await frameBox(page)
    return {
        hexWidth: await hexWidth(page),
        x: (frame.left + frame.width / 2 - box.left) / box.width,
        y: (frame.top + frame.height / 2 - box.top) / box.height
    }
}

function expectSameView(shown: ShownView, expected: ShownView) {
    expect(shown.hexWidth).toBeCloseTo(expected.hexWidth, 1)
    expect(shown.x).toBeCloseTo(expected.x, 2)
    expect(shown.y).toBeCloseTo(expected.y, 2)
}

test('A phone’s resting view keeps its place and scale as the view resizes', async ({ page }) => {
    test.skip(!onPhone(), 'The desktop rests on the whole map, which the wrapper refits itself.')
    await openScenario(page, 'First share')
    await page.waitForTimeout(VIEW_SETTLE_MS)
    const resting = await viewShown(page)
    expect(Math.abs(resting.hexWidth - RESTING_HEX_PX)).toBeLessThan(0.5)
    const size = page.viewportSize()
    if (!size) throw new Error('The phone project sets a viewport.')
    await page.setViewportSize({ width: size.width, height: size.height - 100 })
    await page.waitForTimeout(VIEW_SETTLE_MS)
    expectSameView(await viewShown(page), resting)
})

test('At 1440 × 900 the desktop view rests on the whole map when a zoom would barely gain', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone rests on its middle third, not the whole map.')
    await page.setViewportSize({ width: 1440, height: 900 })
    // Purple's starts lie coast to coast, so fitting them would cut the board's edges for ~2%.
    await openScenario(page, 'Purple arrives')
    await expect(litHexes(page).first()).toBeVisible()
    await settled(page)
    expect(await showsWholeMap(page)).toBe(true)
    const deciding = await activePlayerId(page)
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect.poll(() => activePlayerId(page)).not.toBe(deciding)
    await settled(page)
    expect(await showsWholeMap(page)).toBe(true)
    await openScenario(page, 'First share')
    await settled(page)
    expect(await showsWholeMap(page)).toBe(true)
})

test('A watching seat’s view does not zoom, not even for a held spotlight', async ({ page }) => {
    await openScenario(page, 'First placement')
    // The harness's Non-active view: Ben watches Ada build.
    await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(true))
    await expect.poll(() => page.evaluate(() => window.rtrSession.myPlayerId)).toBe('p2')
    await expect(litHexes(page)).toHaveCount(0)
    const watching = await settled(page)
    if (!onPhone()) expect(await showsWholeMap(page)).toBe(true)

    if (onPhone()) {
        // A watching phone shows no railroad cards: the seat cards' share rows, in the Players drawer off
        // screen, hold the spotlight. Pressed in place, so the drawer does not scroll the board.
        await page
            .getByRole('region', { name: 'Ada', exact: true })
            .getByRole('button', { name: /^Red: / })
            .dispatchEvent('click')
    } else {
        await pressSpotlight(page, 'Red')
    }
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.heldRailroadId))
        .toBe('railroad.red')
    await page.waitForTimeout(VIEW_SETTLE_MS)
    expect(await boardBox(page)).toEqual(watching)
})

test('The zoom glides to a held spotlight’s railroad', async ({ page }) => {
    await openScenario(page, 'Black unstarted')
    const boxes = await boardBoxesDuring(page, () => pressSpotlight(page, 'Red'))
    expect(boxes.length).toBeGreaterThan(3)
})

type Touched = { hexId: string; box: string }

/** Where the board is drawn, to the whole pixel, as the touch records it. */
function boardKey(page: Page): Promise<string> {
    return board(page).evaluate((root) => {
        const box = root.getBoundingClientRect()
        return [box.left, box.top, box.width].map(Math.round).join(' ')
    })
}

/** Records, as the next finger lands, the hex under it and where the board is drawn. */
function recordTouch(page: Page): Promise<void> {
    return board(page).evaluate((root) => {
        Reflect.set(window, 'rtrTouched', undefined)
        const note = (event: TouchEvent) => {
            const touch = event.touches[0]
            const hit = document
                .elementFromPoint(touch?.clientX ?? -1, touch?.clientY ?? -1)
                ?.closest('[data-hex-id]')
            const box = root.getBoundingClientRect()
            Reflect.set(window, 'rtrTouched', {
                hexId: hit?.getAttribute('data-hex-id') ?? '',
                box: [box.left, box.top, box.width].map(Math.round).join(' ')
            })
        }
        addEventListener('touchstart', note, { capture: true, once: true })
    })
}

function touched(page: Page): Promise<Touched | undefined> {
    return page.evaluate(() => {
        const seen: unknown = Reflect.get(window, 'rtrTouched')
        return seen === undefined ? undefined : JSON.parse(JSON.stringify(seen))
    })
}

/** The lit hex with one placement nearest the screen's middle, where it is the topmost thing. */
function hexToTap(
    page: Page
): Promise<{ hexId: string; railroadId: string; x: number; y: number } | undefined> {
    return board(page).evaluate((root) => {
        const placed = new Map<string, string>()
        for (const hex of window.rtrSession.boardOffer.lit) {
            const [only, ...others] = hex.placements
            if (only && others.length === 0) placed.set(hex.hexId, only.railroadId)
        }
        let best: { hexId: string; railroadId: string; x: number; y: number } | undefined
        let bestDistance = Infinity
        for (const hit of root.querySelectorAll('g.hits [role="button"]')) {
            const hexId = hit.getAttribute('data-hex-id') ?? ''
            const railroadId = placed.get(hexId)
            const box = hit.getBoundingClientRect()
            const x = box.left + box.width / 2
            const y = box.top + box.height / 2
            if (!railroadId || document.elementFromPoint(x, y) !== hit) continue
            const distance = Math.hypot(x - innerWidth / 2, y - innerHeight / 2)
            if (distance < bestDistance) {
                best = { hexId, railroadId, x, y }
                bestDistance = distance
            }
        }
        return best
    })
}

function trackNow(page: Page): Promise<Record<string, string[]>> {
    return page.evaluate(() => JSON.parse(JSON.stringify(window.rtrSession.gameState.track)))
}

/** About half of the view's glide, which takes 180 ms. */
const HALF_GLIDE_MS = 90

test('On a phone a tap while the zoom glides places the hex under the finger as it lands', async ({
    page
}) => {
    test.skip(!onPhone(), 'A mouse press is a click; the finger that stops a glide is a touch.')
    // Where an uninterrupted glide to Red's lit hexes ends.
    await openScenario(page, 'Black unstarted')
    const start = await boardKey(page)
    await pressSpotlight(page, 'Red')
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.heldRailroadId))
        .toBe('railroad.red')
    await settled(page)
    const end = await boardKey(page)
    expect(end).not.toBe(start)

    // The same glide from the same view, with the page's clock held so it stops halfway.
    await openScenario(page, 'Black unstarted')
    expect(await boardKey(page)).toBe(start)
    const before = await trackNow(page)
    await page.clock.install()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
    await pressSpotlight(page, 'Red')
    await page.clock.runFor(HALF_GLIDE_MS)
    const halfway = await boardKey(page)
    expect(halfway).not.toBe(start)
    expect(halfway).not.toBe(end)
    const target = await hexToTap(page)
    expect(target).toBeDefined()
    await recordTouch(page)
    await page.touchscreen.tap(target?.x ?? -1, target?.y ?? -1)
    await page.clock.resume()
    await settled(page)

    // The finger landed on the hex mid-glide, and that hex is the one placed.
    const touch = await touched(page)
    expect(touch?.box).toBe(halfway)
    expect(touch?.hexId).toBe(target?.hexId)
    const after = await trackNow(page)
    const changed = Object.keys(after).filter(
        (hexId) => JSON.stringify(after[hexId]) !== JSON.stringify(before[hexId])
    )
    expect(changed).toEqual([target?.hexId])
    expect(after[target?.hexId ?? '']).toContain(target?.railroadId)
})

test('With reduced motion the zoom jumps rather than glides', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openScenario(page, 'Black unstarted')
    const boxes = await boardBoxesDuring(page, () => pressSpotlight(page, 'Red'))
    // Where it was, and where it jumped to: no frame in between.
    expect(boxes).toHaveLength(2)
})
