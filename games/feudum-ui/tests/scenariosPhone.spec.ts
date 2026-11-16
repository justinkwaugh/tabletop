import { expect, type Locator } from '@playwright/test'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/**
 * The contract's phone scenarios S67 to S70 and S73, on the real table. A phone's scenario also runs at
 * the desktop, where it proves the desk's counterpart: no chip over the board, the whole board kept
 * by the zoom row's chooser, the bench and the seats in their columns.
 */

const Badlands1 = 'space:space.badlands.1'
const Forest2 = 'space:space.forest.2'
const BoardWidth = 2500
const Target = 44

const chip = (table: ScenarioTable, area: string) =>
    table.page.locator(`[data-focus-chip="${area}"]`)

/** A desk has no chip over the board; its zoom row's chooser stays on the whole board. */
async function expectDeskOnWholeBoard(table: ScenarioTable) {
    await expect(table.page.locator('[data-focus-chooser="phone"]')).toHaveCount(0)
    await expect(chip(table, 'board')).toHaveAttribute('aria-pressed', 'true')
}
const view = (table: ScenarioTable) => table.page.locator('[data-board-view]')
const surface = (table: ScenarioTable) => table.page.locator('[data-board-surface]')
const bench = (table: ScenarioTable) => table.page.locator('[data-bench]')
const enlarged = (table: ScenarioTable) => table.page.locator('[data-enlarged]')
const seatLayer = (table: ScenarioTable) => table.page.locator('[data-table-layer="seat"]')
const tracksLayer = (table: ScenarioTable) => table.page.locator('[data-table-layer="tracks"]')

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

const boardScale = async (table: ScenarioTable) => (await rect(surface(table))).width / BoardWidth

/** Each target stands wholly inside the board's view. */
async function expectInView(table: ScenarioTable, targets: Locator) {
    const frame = await rect(view(table))
    const all = await targets.all()
    expect(all.length).toBeGreaterThan(0)
    for (const target of all) {
        const box = await rect(target)
        expect(box.x).toBeGreaterThanOrEqual(frame.x - 1)
        expect(box.y).toBeGreaterThanOrEqual(frame.y - 1)
        expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1)
        expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1)
    }
}

/** Nothing in the game column scrolls sideways. */
async function expectNoSidewaysScroll(table: ScenarioTable) {
    const over = await table.page.evaluate(() =>
        ['[data-action-cap]', '.game-stack', '.feudum-table', '[data-bench]']
            .flatMap((selector) => [...document.querySelectorAll(selector)])
            .map(({ scrollWidth, clientWidth }) => scrollWidth - clientWidth)
    )
    for (const each of over) {
        expect(each).toBeLessThanOrEqual(0)
    }
    expect(
        await table.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(0)
}

/** A hand across the board: a real touch, start, moves and end, as a finger sends them. */
async function touchPan(table: ScenarioTable, dx: number, dy: number) {
    const frame = await rect(view(table))
    const from = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
    const touch = await table.page.context().newCDPSession(table.page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
    for (let step = 1; step <= 8; step += 1) {
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: from.x + (dx * step) / 8, y: from.y + (dy * step) / 8 }]
        })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await touch.detach()
    await table.boardAtRest()
}

/**
 * Whatever is drawn at a target's middle belongs to its layer: nothing stands over it. The enlarged face
 * takes no presses, so the hit lands on the scrim that holds it.
 */
const onTop = (target: Locator) =>
    target.evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        const hit = document.elementFromPoint(x + width / 2, y + height / 2)
        const layer = element.closest('[data-table-layer]') ?? element
        return hit !== null && layer.contains(hit)
    })

scenario(
    'S67 R-1.2, R-3.7 Phone board: the Map under four chips, a Move pick framed, a hand pan clears it',
    'move-last-step-farmer',
    async (table) => {
        await table.boardAtRest()
        const rest = await boardScale(table)
        if (!table.phone) {
            // The desk shows the whole board, with no chooser over it.
            await expectDeskOnWholeBoard(table)
            await table.press(table.card('Move'))
            await expectInView(table, table.lit())
            expect(await boardScale(table)).toBeCloseTo(rest, 3)
            await expectDeskOnWholeBoard(table)
            return
        }
        const chips = await table.page
            .locator('[data-focus-chip]')
            .evaluateAll((all) => all.map((one) => one.getAttribute('data-focus-chip')))
        expect(chips).toEqual(['map', 'west', 'east', 'tracks'])
        await expect(chip(table, 'map')).toHaveAttribute('aria-pressed', 'true')
        const restView = await rect(view(table))

        await table.press(table.card('Move'))
        await table.boardAtRest()
        await expectInView(table, table.lit())
        // The tray takes room from the view; the frame never zooms out past the cover of what is left.
        const cover = (rest * (await rect(view(table))).height) / restView.height
        expect(await boardScale(table)).toBeGreaterThanOrEqual(cover - 0.001)
        await expect(chip(table, 'map').locator('[data-lit-dot]')).toHaveCount(1)

        const framed = await rect(surface(table))
        await touchPan(table, 60, 30)
        const panned = await rect(surface(table))
        expect(panned.x).not.toBeCloseTo(framed.x, 0)
        await expect(chip(table, 'map')).toHaveAttribute('aria-pressed', 'false')
        // The pick stays open where the hand left the view; the Map chip brings the cover back.
        await expect(table.pick(Badlands1)).toHaveAttribute('data-pick-role', 'lit')
        await table.press(chip(table, 'map'))
        await table.boardAtRest()
        await expect(chip(table, 'map')).toHaveAttribute('aria-pressed', 'true')
    },
    ['desktop', 'phone', 'sideways']
)

scenario(
    'S67 R-3.16 Phone board: a guild pick frames the West, and the East chip carries a lit dot',
    'guild-pick',
    async (table) => {
        await table.press(table.card('Guild'))
        await table.boardAtRest()
        if (!table.phone) {
            await expectDeskOnWholeBoard(table)
            await expectInView(table, table.page.locator('[data-board-surface] [data-guild]'))
            return
        }
        await expect(chip(table, 'west')).toHaveAttribute('aria-pressed', 'true')
        await expect(chip(table, 'west').locator('[data-lit-dot]')).toHaveCount(1)
        await expect(chip(table, 'east').locator('[data-lit-dot]')).toHaveCount(1)
        await expect(chip(table, 'map').locator('[data-lit-dot]')).toHaveCount(0)
        await expectInView(
            table,
            table.page.locator('[data-board-surface] [data-guild="merchant"]')
        )
    },
    ['desktop', 'phone', 'sideways']
)

scenario(
    'S68 R-4.6.4 Phone bench: a Merchant pull opens a bottom sheet, its result and primary in its footer',
    'guild-merchant-pull',
    async (table) => {
        await table.press(table.card('Guild'))
        await table.pressPick('guild:merchant')
        await table.press(table.popupRowStarting('Pull'))
        await expect(bench(table)).toBeVisible()
        const footer = bench(table).locator('[data-bench-footer]')
        // R-X.2 The send appears once the pull's goods are picked.
        await expect(table.page.locator('[data-primary]')).toHaveCount(0)
        for (const id of ['good:iron', 'good:iron', 'good:wood']) {
            await table.press(
                table.page
                    .locator(
                        `[data-bench-place="${id}"] button, [data-bench-button="${id}"] button`
                    )
                    .first()
            )
        }
        await expect(table.page.locator('[data-primary]')).toHaveCount(1)
        if (table.phone) {
            const sheet = await rect(bench(table))
            const screen = table.page.viewportSize() ?? { width: 0, height: 0 }
            expect(sheet.x).toBe(0)
            expect(sheet.width).toBe(screen.width)
            expect(sheet.y + sheet.height).toBeCloseTo(screen.height, 0)
            expect(sheet.height).toBeLessThanOrEqual(0.8 * screen.height + 1)
            await expect(footer.locator('[data-bench-result]')).toBeVisible()
            await expect(footer.locator('[data-primary]')).toBeVisible()
            await expect(table.panel().locator('[data-primary]')).toHaveCount(0)
        } else {
            // At the desk the bench stands over the board, not across the screen as a sheet; its result in
            // the footer.
            const over = await rect(bench(table))
            const board = await rect(view(table))
            expect(over.width).toBeLessThan((table.page.viewportSize() ?? { width: 0 }).width)
            expect(over.x).toBeGreaterThanOrEqual(board.x - 1)
            await expect(bench(table)).not.toHaveClass(/bench-sheet/)
            await expect(footer.locator('[data-bench-result]')).toBeVisible()
            // Its primary stays the panel's, where the desk's every primary is.
            await expect(footer.locator('[data-primary]')).toHaveCount(0)
            await expect(table.panel().locator('[data-primary]')).toBeVisible()
        }
        await expectNoSidewaysScroll(table)
    }
)

scenario(
    'S68 R-3.1 Phone hand: the eleven-card draft in two rows, tray A under them',
    'hands-first-saltpeter',
    async (table) => {
        const cells = table.panel().locator('[data-cards] [data-row]')
        await expect(cells).toHaveCount(11)
        const boxes = await Promise.all((await cells.all()).map((cell) => rect(cell)))
        const rows = [...new Set(boxes.map(({ y }) => Math.round(y)))]
        expect(rows.length).toBe(table.phone ? 2 : rows.length)
        expect(rows.length).toBeLessThanOrEqual(2)
        const lowest = Math.max(...boxes.map(({ y, height }) => y + height))
        // A desk stands tray A beside the eleven; a phone's sheet, under them.
        for (const line of table.phone
            ? [
                  table.panel().locator('[data-rows="pouch"]'),
                  table.panel().locator('[data-tray-row="send"]')
              ]
            : []) {
            expect((await rect(line)).y).toBeGreaterThanOrEqual(lowest - 1)
        }
        await expectNoSidewaysScroll(table)
    }
)

scenario(
    'S69 R-5.1 Phone seat strip: a seat chip opens the seat as a sheet, a card enlarges above it',
    'move-last-step-farmer',
    async (table) => {
        if (!table.phone) {
            // The desk holds every seat in its column; a card enlarges above the table.
            await expect(table.page.locator('[data-seat-chip]')).toHaveCount(0)
            await expect(table.page.locator('[data-seat-column] [data-seat-panel]')).toHaveCount(3)
            await table.press(
                table.page.locator('[data-seat-panel="p2"] [data-enlarge="card back"]').first()
            )
            await expect(enlarged(table)).toBeVisible()
            expect(await onTop(enlarged(table))).toBe(true)
            await table.page.keyboard.press('Escape')
            await expect(enlarged(table)).toHaveCount(0)
            return
        }
        await expect(table.page.locator('[data-seat-chip]')).toHaveCount(3)
        await table.press(table.page.locator('[data-seat-chip="p2"]'))
        const sheet = seatLayer(table).locator('[data-sheet]')
        await expect(sheet).toBeVisible()
        await expect(sheet.locator('[data-seat-panel="p2"]')).toHaveCount(1)
        const enlarge = sheet.locator('[data-enlarge="card back"]').first()
        const { width, height } = await rect(enlarge)
        expect(Math.min(width, height)).toBeGreaterThan(0)
        await table.press(enlarge)
        await expect(enlarged(table)).toBeVisible()
        expect(await onTop(enlarged(table))).toBe(true)
        await table.page.keyboard.press('Escape')
        await expect(enlarged(table)).toHaveCount(0)
        await expect(sheet).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(seatLayer(table)).toHaveCount(0)

        // The own seat's sheet counts its hand: the hand itself is on the desk.
        await table.press(table.page.locator('[data-seat-chip="p1"]'))
        const own = sheet.locator('[data-seat-panel="p1"]')
        await expect(own.locator('[data-in-hand]')).toHaveText(/^\d+ in hand$/)
        await expect(own.locator('[data-seat-card]:not([data-card-played])')).toHaveCount(0)
        await table.page.keyboard.press('Escape')
        await expect(seatLayer(table)).toHaveCount(0)
    }
)

scenario(
    'S70 R-3.16, R-4.6.4 Full screen: the panel in the toolbar, the bench and popups in the dialog, a send works',
    'guild-below-threshold',
    async (table) => {
        await table.press(table.page.getByRole('button', { name: 'Enter full screen' }))
        const dialog = table.page.locator('dialog:modal')
        await expect(dialog).toHaveCount(1)
        await expect(dialog.locator('[data-action-panel]')).toBeVisible()
        await table.press(
            dialog.locator('[data-action-panel] [data-cards] [data-row="Guild"] button').first()
        )
        await table.boardAtRest()
        await table.press(dialog.locator('[data-pick="guild:merchant"] [role="button"]').first())
        await expect(dialog.locator('[data-board-popup]')).toBeVisible()
        await table.press(dialog.locator('[data-board-popup] [data-row^="Pull"] button').first())
        await expect(dialog.locator('[data-bench]')).toBeVisible()
        await table.press(dialog.locator('[data-bench-place="good:iron"] button').first())
        const send = dialog.locator('[data-primary]')
        await expect(send).toHaveText('Move 1 good')
        const sent = await table.page.evaluate(() => window.feudumFixture.host.actions.length)
        await table.press(send)
        await expect(dialog.locator('[data-bench]')).toHaveCount(0)
        // R-4.7-H1 The seat's Action reaches the server, and its pull offers a reeve.
        const by = await table.page.evaluate(
            (from) => window.feudumFixture.host.actions[from]?.playerId ?? 'none',
            sent
        )
        expect(by).toBe(await table.page.evaluate(() => window.feudumFixture.seat))
        await expect(dialog.locator('[data-action-panel]')).toContainText('Reeve in Merchant?')
        await expect(dialog).toHaveCount(1)
    }
)

scenario(
    'S73 R-1.2, R-3.7.5 Phone Tracks sheet: legible, scrolling inside, no target; a disc pick frames the voyage track',
    'voyage-repeat',
    async (table) => {
        await table.boardAtRest()
        const rest = await boardScale(table)
        await table.press(table.card('Repeat'))
        await table.pressPick(Forest2)
        await table.press(table.primary())
        await table.boardAtRest()
        await expect(table.pick('voyage:1')).toHaveAttribute('data-pick-role', 'lit')
        if (!table.phone) {
            await expectDeskOnWholeBoard(table)
            await expect(tracksLayer(table)).toHaveCount(0)
            await expectInView(
                table,
                table.page.locator('[data-board-surface] [data-pick^="voyage:"]')
            )
            return
        }
        await expectInView(table, table.pick('voyage:1'))
        expect(await boardScale(table)).toBeGreaterThan(rest)
        const framed = await rect(surface(table))

        await table.press(chip(table, 'tracks'))
        const sheet = tracksLayer(table).locator('[data-sheet]')
        await expect(sheet).toBeVisible()
        const tracks = await tracksLayer(table)
            .locator('[data-track]')
            .evaluateAll((all) => all.map((one) => one.getAttribute('data-track')))
        expect(tracks).toEqual(
            expect.arrayContaining([
                'epoch',
                'stacks-west',
                'stacks-east',
                'chart',
                'barrels',
                'voyage',
                'service',
                'score'
            ])
        )
        await expect(
            tracksLayer(table).locator('[data-pick-role]:not([data-pick-role="plain"])')
        ).toHaveCount(0)
        const { down, across, smallest } = await sheet.evaluate((element) => {
            const body = element.querySelector('[data-tracks-sheet]')?.parentElement ?? element
            return {
                down: body.scrollHeight - body.clientHeight,
                across: Math.max(
                    body.scrollWidth - body.clientWidth,
                    element.scrollWidth - element.clientWidth
                ),
                smallest: Math.min(
                    ...[...element.querySelectorAll('svg text')]
                        .filter((text) => (text.textContent ?? '').trim() !== '')
                        .map((text) => {
                            const svg = text.closest('svg')
                            const scale = svg
                                ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
                                : 1
                            return Number.parseFloat(getComputedStyle(text).fontSize) * scale
                        })
                )
            }
        })
        expect(down).toBeGreaterThan(0)
        expect(across).toBeLessThanOrEqual(0)
        expect(smallest).toBeGreaterThanOrEqual(11)
        await expectNoSidewaysScroll(table)
        // The sheet is to look at: Escape gives the framed board back, the pick still open.
        await table.page.keyboard.press('Escape')
        await expect(tracksLayer(table)).toHaveCount(0)
        await table.boardAtRest()
        expect((await rect(surface(table))).width).toBeCloseTo(framed.width, 0)
        await expect(table.pick('voyage:1')).toHaveAttribute('data-pick-role', 'lit')
        // The pick's row, a phone's reach: the disc goes on the space the sheet showed.
        const place = await rect(table.row('Place'))
        expect(place.height).toBeGreaterThanOrEqual(Target)
    }
)
