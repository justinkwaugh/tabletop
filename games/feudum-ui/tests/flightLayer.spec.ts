import { expect, test, type Page } from '@playwright/test'
import type { FlightFrame, FlightTable } from '../src/lib/testing/flightTablePage.js'
import { settled } from './helpers.js'

/**
 * The flight layer on the real table: every painted frame's copies read back in page pixels, so a
 * framed board, a phone and full screen are held to the same rectangles.
 */

declare global {
    interface Window {
        flightTable: FlightTable
        historyTable: { stepBack(): Promise<FlightFrame[]> }
    }
}

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

async function openTable(page: Page, viewer: 'drawer' | 'other' = 'drawer') {
    await openWith(page, `openFlightTable('${viewer}')`)
}

async function openWith(page: Page, call: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import * as tables from '/src/lib/testing/flightTablePage.ts'
            await tables.${call}
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
    await page.evaluate(() => document.fonts.ready)
}

const boxOf = (page: Page, selector: string) =>
    page.evaluate((chosen) => window.flightTable.boxOf(chosen), selector)

const flying = (frames: readonly FlightFrame[]) => frames.filter(({ copies }) => copies.length > 0)

/** No frame paints a piece gone with nothing in its place, or a piece twice. */
function expectNothingLost(frames: readonly FlightFrame[]) {
    for (const frame of frames) {
        if (frame.hidden.length > 0) {
            expect(frame.copies.length).toBeGreaterThan(0)
        }
    }
    expect(frames[frames.length - 1].copies).toEqual([])
    expect(frames[frames.length - 1].hidden).toEqual([])
}

test.describe('at the desk', () => {
    test('R-3.6 a copy runs from one rectangle to the other, its source hidden, its target untouched', async ({
        page
    }) => {
        await openTable(page)
        const piece = await page.evaluate(() => window.flightTable.pieceOfPawn())
        expect(piece).toBeTruthy()
        const pieceBox = await boxOf(page, `[data-motion="${piece}"]`)
        const seat = await page.evaluate(() => window.flightTable.seat)
        const seatBox = await boxOf(page, `[data-seat-panel="${seat}"]`)
        const { frames, last, hiddenAfter, copiesAfter } = await page.evaluate(() =>
            window.flightTable.pawnHome()
        )
        const air = flying(frames)
        expect(air.length).toBeGreaterThan(5)
        const [first] = air
        expect(first.hidden.join()).toContain(`data-motion="${piece}"`)
        expect(Math.abs(first.copies[0].x - (pieceBox?.x ?? NaN))).toBeLessThan(12)
        expect(Math.abs(first.copies[0].y - (pieceBox?.y ?? NaN))).toBeLessThan(12)
        for (const frame of air) {
            expect(frame.hidden.join()).toContain(`data-motion="${piece}"`)
        }
        const landed = last.copies[0]
        expect(landed.x).toBeGreaterThanOrEqual(seatBox?.left ?? NaN)
        expect(landed.x).toBeLessThanOrEqual(seatBox?.right ?? NaN)
        expect(landed.inDialog).toBe(false)
        expect(hiddenAfter).toEqual([])
        expect(copiesAfter).toBe(0)
    })

    test('R-3.6 on a zoomed board an end with no piece of its own is read off the board’s rectangle', async ({
        page
    }) => {
        await openTable(page)
        await page.getByRole('button', { name: 'Zoom in' }).click()
        await page.getByRole('button', { name: 'Zoom in' }).click()
        await settled(page)
        const view = await boxOf(page, '[data-board-view]')
        const { last, boardEnd } = await page.evaluate(() => window.flightTable.goodLeaves())
        expect(boardEnd).toBeDefined()
        const heldX = Math.min(view?.right ?? NaN, Math.max(view?.left ?? NaN, boardEnd?.x ?? NaN))
        const heldY = Math.min(view?.bottom ?? NaN, Math.max(view?.top ?? NaN, boardEnd?.y ?? NaN))
        expect(Math.abs(last.copies[0].x - heldX)).toBeLessThan(2)
        expect(Math.abs(last.copies[0].y - heldY)).toBeLessThan(2)
    })

    test('R-3.10.1 a writ flies face up to its drawer', async ({ page }) => {
        await openTable(page)
        const frames = await page.evaluate(() => window.flightTable.explore())
        const names = await page.evaluate(() => window.flightTable.drawnWrits())
        const writs = flying(frames).flatMap(({ copies }) =>
            copies.filter(({ row }) => row === 'writs')
        )
        expect(names.length).toBeGreaterThan(0)
        expect(writs.length).toBeGreaterThan(0)
        expect(writs.every(({ html }) => names.some((name) => html.includes(name)))).toBe(true)
        expectNothingLost(frames)
    })

    test('R-3.10.1 another seat sees backs: the flying copy’s own markup names no writ', async ({
        page
    }) => {
        await openTable(page, 'other')
        const frames = await page.evaluate(() => window.flightTable.explore())
        const names = await page.evaluate(() => window.flightTable.drawnWrits())
        const writs = flying(frames).flatMap(({ copies }) =>
            copies.filter(({ row }) => row === 'writs')
        )
        expect(names.length).toBeGreaterThan(0)
        expect(writs.length).toBeGreaterThan(0)
        for (const { html } of writs) {
            for (const name of names) {
                expect(html).not.toContain(name)
            }
        }
        expectNothingLost(frames)
    })

    test('S66 a second Action mid-flight: nothing stays hidden, the layer empties, the latest state shows', async ({
        page
    }) => {
        await openTable(page)
        const frames = await page.evaluate(() => window.flightTable.exploreThenKeep())
        expect(flying(frames).length).toBeGreaterThan(0)
        expectNothingLost(frames)
        expect(await page.evaluate(() => window.flightTable.latestShown())).toBe(true)
    })

    test('S63 a step in history: a copy lasts no longer than the fast fallback allows', async ({
        page
    }) => {
        await openWith(page, 'openHistoryTable()')
        const frames = await page.evaluate(() => window.historyTable.stepBack())
        const air = flying(frames)
        expect(air.length).toBeGreaterThan(0)
        // 200 ms of tween, and a frame or two either side of it.
        expect(air[air.length - 1].at - air[0].at).toBeLessThan(0.2 * 1000 + 100)
        expectNothingLost(frames)
    })

    test.describe('with reduced motion', () => {
        test.use({ reducedMotion: 'reduce' })

        test('S65 a copy never moves: it is simply there, and gone with the state', async ({
            page
        }) => {
            await openTable(page)
            const { frames, hiddenAfter, copiesAfter } = await page.evaluate(() =>
                window.flightTable.pawnHome()
            )
            const places = new Set(
                flying(frames).flatMap(({ copies }) =>
                    copies.map(({ x, y }) => `${x.toFixed(1)}:${y.toFixed(1)}`)
                )
            )
            expect(places.size).toBe(1)
            expect(hiddenAfter).toEqual([])
            expect(copiesAfter).toBe(0)
        })
    })

    test('R-3.6 in full screen the copy flies inside the dialog, on the board’s own rectangles', async ({
        page
    }) => {
        await openTable(page)
        await page
            .locator('button[aria-label*="full" i]:visible, button[title*="full" i]:visible')
            .first()
            .click()
        await expect(page.locator('dialog:modal')).toHaveCount(1)
        await settled(page)
        const piece = await page.evaluate(() => window.flightTable.pieceOfPawn())
        const pieceBox = await boxOf(page, `[data-motion="${piece}"]`)
        const { frames, hiddenAfter } = await page.evaluate(() => window.flightTable.pawnHome())
        const air = flying(frames)
        expect(air.length).toBeGreaterThan(5)
        expect(air.every(({ copies }) => copies.every(({ inDialog }) => inDialog))).toBe(true)
        expect(Math.abs(air[0].copies[0].x - (pieceBox?.x ?? NaN))).toBeLessThan(12)
        expect(Math.abs(air[0].copies[0].y - (pieceBox?.y ?? NaN))).toBeLessThan(12)
        expect(hiddenAfter).toEqual([])
        await page.locator('dialog:modal').screenshot({
            path: test.info().outputPath('full-screen-after.png')
        })
    })

    test('R-3.6 full screen opening mid-flight: the copy carries on inside the dialog, and nothing is left hidden', async ({
        page
    }) => {
        await openTable(page)
        const { frames, hiddenAfter, copiesAfter } = await page.evaluate(() =>
            window.flightTable.pawnHomeOpeningFullScreen()
        )
        const air = flying(frames)
        expect(air.some(({ copies }) => copies[0].inDialog)).toBe(true)
        expect(air[air.length - 1].copies[0].inDialog).toBe(true)
        expect(hiddenAfter).toEqual([])
        expect(copiesAfter).toBe(0)
    })

    test('R-3.6 a copy held in mid-air, as a watcher sees it', async ({ page }) => {
        await openTable(page)
        const held = await page.evaluate(() => window.flightTable.holdPawnHome())
        expect(held.copies.length).toBeGreaterThan(0)
        await page.screenshot({ path: test.info().outputPath('desk-pawn-home-mid-flight.png') })
    })
})

test.describe('as a watcher sees it', () => {
    test('R-3.10.1 a draw in mid-air: faces to the drawer', async ({ page }) => {
        await openTable(page)
        const held = await page.evaluate(() => window.flightTable.holdWritDraw())
        expect(held.copies.length).toBe(3)
        await page.screenshot({ path: test.info().outputPath('desk-draw-drawer.png') })
    })

    test('R-3.10.1 a draw in mid-air: backs to another seat', async ({ page }) => {
        await openTable(page, 'other')
        const held = await page.evaluate(() => window.flightTable.holdWritDraw())
        expect(held.copies.length).toBe(3)
        await page.screenshot({ path: test.info().outputPath('desk-draw-other.png') })
    })

    test('R-3.6 a copy in mid-air in full screen', async ({ page }) => {
        await openTable(page)
        await page
            .locator('button[aria-label*="full" i]:visible, button[title*="full" i]:visible')
            .first()
            .click()
        await expect(page.locator('dialog:modal')).toHaveCount(1)
        await settled(page)
        const held = await page.evaluate(() => window.flightTable.holdPawnHome())
        expect(held.copies[0].inDialog).toBe(true)
        await page.screenshot({ path: test.info().outputPath('full-screen-mid-flight.png') })
    })
})

test.describe('at phone width', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('R-3.6 a copy held in mid-air, as a watcher sees it', async ({ page }) => {
        await openTable(page)
        const held = await page.evaluate(() => window.flightTable.holdPawnHome())
        expect(held.copies.length).toBeGreaterThan(0)
        await page.screenshot({ path: test.info().outputPath('phone-pawn-home-mid-flight.png') })
    })

    test('R-3.6 with no seat open, the seat strip’s chip stands in, and is never hidden', async ({
        page
    }) => {
        await openTable(page)
        const seat = await page.evaluate(() => window.flightTable.seat)
        await expect(page.locator(`[data-open-seat="${seat}"]`)).toHaveCount(0)
        const chip = await boxOf(page, `[data-seat-chip="${seat}"]`)
        const { frames, last, hiddenAfter } = await page.evaluate(() =>
            window.flightTable.goodLeaves()
        )
        expect(flying(frames).length).toBeGreaterThan(0)
        expect(Math.abs(flying(frames)[0].copies[0].x - (chip?.x ?? NaN))).toBeLessThan(12)
        expect(Math.abs(flying(frames)[0].copies[0].y - (chip?.y ?? NaN))).toBeLessThan(12)
        for (const frame of frames) {
            expect(frame.hidden.join()).not.toContain('data-seat-chip')
        }
        expect(last.copies.length).toBeGreaterThan(0)
        expect(hiddenAfter).toEqual([])
    })

    test('R-3.6 a pawn on the framed board leaves from its own rectangle, and lands on the chip', async ({
        page
    }) => {
        await openTable(page)
        const seat = await page.evaluate(() => window.flightTable.seat)
        const piece = await page.evaluate(() => window.flightTable.pieceOfPawn())
        const pieceBox = await boxOf(page, `[data-motion="${piece}"]`)
        const chip = await boxOf(page, `[data-seat-chip="${seat}"]`)
        const view = await boxOf(page, '[data-board-view]')
        const held = (
            value: number | undefined,
            low: number | undefined,
            high: number | undefined
        ) => Math.min(high ?? NaN, Math.max(low ?? NaN, value ?? NaN))
        const { frames, last } = await page.evaluate(() => window.flightTable.pawnHome())
        const air = flying(frames)
        expect(air.length).toBeGreaterThan(5)
        expect(
            Math.abs(air[0].copies[0].x - held(pieceBox?.x, view?.left, view?.right))
        ).toBeLessThan(12)
        expect(
            Math.abs(air[0].copies[0].y - held(pieceBox?.y, view?.top, view?.bottom))
        ).toBeLessThan(12)
        expect(Math.abs(last.copies[0].x - (chip?.x ?? NaN))).toBeLessThan(2)
        expect(Math.abs(last.copies[0].y - (chip?.y ?? NaN))).toBeLessThan(2)
        await page.screenshot({ path: test.info().outputPath('phone-after-pawn.png') })
    })

    test('R-3.6 with the sheet open the copy leaves from the sheet’s own good, and it hides', async ({
        page
    }) => {
        await openTable(page)
        const seat = await page.evaluate(() => window.flightTable.seat)
        await page.locator(`[data-seat-chip="${seat}"]`).click()
        const sheet = page.locator(`[data-open-seat="${seat}"]`)
        await expect(sheet).toBeVisible()
        await settled(page)
        const good = sheet.locator('[data-supply-good="food"]')
        await good.scrollIntoViewIfNeeded()
        const goodBox = await boxOf(page, `[data-open-seat="${seat}"] [data-supply-good="food"]`)
        await page.evaluate(() => window.flightTable.holdPawnHome())
        await page.screenshot({ path: test.info().outputPath('phone-sheet-mid-flight.png') })
        await page.evaluate(() =>
            window.feudumSession.beforeNewState({
                kind: 'own-action',
                actions: [],
                intent: 'actions'
            })
        )
        const { frames, hiddenAfter } = await page.evaluate(() => window.flightTable.goodLeaves())
        const air = flying(frames)
        expect(air.length).toBeGreaterThan(0)
        expect(air[0].hidden.join()).toContain('data-supply-good')
        expect(Math.abs(air[0].copies[0].x - (goodBox?.x ?? NaN))).toBeLessThan(12)
        expect(hiddenAfter).toEqual([])
    })

    test('R-3.6 a source scrolled out of the sheet’s cap stays put: the copy leaves from what is on screen', async ({
        page
    }) => {
        await openTable(page)
        const seat = await page.evaluate(() => window.flightTable.seat)
        await page.locator(`[data-seat-chip="${seat}"]`).click()
        await expect(page.locator(`[data-open-seat="${seat}"]`)).toBeVisible()
        await settled(page)
        // A seat with little fits its sheet: the cap is drawn in, as a seat with much would need.
        await page.addStyleTag({
            content: `[data-open-seat="${seat}"] { max-height: 40px; overflow-y: auto; }`
        })
        const scrolled = await page.evaluate((chosen) => {
            const sheet = document.querySelector(`[data-open-seat="${chosen}"]`)
            const good = sheet?.querySelector('[data-supply-good="food"]')
            if (!sheet || !good) {
                return false
            }
            sheet.scrollTop = sheet.scrollHeight
            const box = good.getBoundingClientRect()
            const cap = sheet.getBoundingClientRect()
            return box.bottom < cap.top || box.top > cap.bottom
        }, seat)
        expect(scrolled).toBe(true)
        const sheet = await boxOf(page, `[data-open-seat="${seat}"]`)
        const { frames, hiddenAfter } = await page.evaluate(() => window.flightTable.goodLeaves())
        const air = flying(frames)
        expect(air.length).toBeGreaterThan(0)
        expect(air[0].hidden).toEqual([])
        expect(air[0].copies[0].y).toBeGreaterThanOrEqual(sheet?.top ?? NaN)
        expect(air[0].copies[0].y).toBeLessThanOrEqual(sheet?.bottom ?? NaN)
        expect(hiddenAfter).toEqual([])
    })
})
