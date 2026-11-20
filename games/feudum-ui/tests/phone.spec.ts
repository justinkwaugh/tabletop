import { expect, test, type Locator, type Page } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import {
    createGame as createHarnessGame,
    playToCards,
    playToHands,
    scoreSpacesCovered,
    settled,
    shot,
    zoomToLowerLeft
} from './helpers.js'
import { openFixture, ScenarioTable } from './scenarioTable.js'

/**
 * A phone on the real table: where things stand and what a press does, at 375 x 812 and held
 * sideways. The focus model's rules are proved in its own spec; this proves they reach the board.
 */

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

const Upright = { width: 375, height: 812 }
const Sideways = { width: 812, height: 375 }
const Target = 44
const BoardWidth = 2500

/**
 * The harness's own toolbar runs past a phone's width, and a phone's browser would zoom the page out
 * to show it, so its last button goes: what is proved here is the table, at the phone's own width.
 */
async function createGame(page: Page) {
    await createHarnessGame(page)
    await page
        .getByRole('button', { name: 'Options' })
        .evaluate((button) => button.parentElement?.style.setProperty('display', 'none'))
    await settled(page)
}

/** The CSS zoom a node is drawn under: the product of its ancestors' zooms, its own too if `self`. */
function zoomOf(node: Locator, self = false): Promise<number> {
    return node.evaluate((element, self) => {
        let zoom = 1
        for (let at = self ? element : element.parentElement; at; at = at.parentElement) {
            zoom *= Number.parseFloat(getComputedStyle(at).zoom) || 1
        }
        return zoom
    }, self)
}

const panel = (page: Page) => page.locator('[data-action-panel]')
const cap = (page: Page) => page.locator('[data-action-cap]')
const stack = (page: Page) => page.locator('.game-stack')
const boardView = (page: Page) => page.locator('[data-board-view]')
const surface = (page: Page) => page.locator('[data-board-surface]')
const chip = (page: Page, area: string) => page.locator(`[data-focus-chip="${area}"]`)
const seatChips = (page: Page) => page.locator('[data-seat-strip] [data-seat-chip]')
const seatLayer = (page: Page) => page.locator('[data-table-layer="seat"]')
const lit = (page: Page) => page.locator('[data-pick-role="lit"]')
const popup = (page: Page) => page.locator('[data-board-popup]')

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

async function boardScale(page: Page) {
    return (await rect(surface(page))).width / BoardWidth
}

/** Waits out a view's animation: the board stands still across two reads. */
async function boardAtRest(page: Page) {
    let last = ''
    await expect
        .poll(
            async () => {
                const now = JSON.stringify(await rect(surface(page)))
                const still = now === last
                last = now
                return still
            },
            { timeout: 5000, intervals: [150] }
        )
        .toBe(true)
}

/** What a press at each edge of a target's middle lands on: within it, or the target is short. */
async function reach(target: Locator) {
    return target.evaluate((element, wanted) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        const middle = { x: x + width / 2, y: y + height / 2 }
        const inside = (px: number, py: number) => {
            const hit = document.elementFromPoint(px, py)
            return hit !== null && (hit === element || element.contains(hit))
        }
        const along = (step: (n: number) => [number, number]) => {
            let n = 0
            while (n < wanted && inside(...step(n + 1))) {
                n += 1
            }
            return n
        }
        const across =
            along((n) => [middle.x + n, middle.y]) + along((n) => [middle.x - n, middle.y])
        const down = along((n) => [middle.x, middle.y + n]) + along((n) => [middle.x, middle.y - n])
        return { across: across + 1, down: down + 1 }
    }, Target)
}

async function expectTarget(target: Locator) {
    const { across, down } = await reach(target)
    expect(across).toBeGreaterThanOrEqual(Target)
    expect(down).toBeGreaterThanOrEqual(Target)
}

async function expectNoSidewaysScroll(page: Page) {
    const sizes = await page.evaluate(() =>
        ['[data-action-cap]', '.game-stack', '.feudum-table']
            .flatMap((selector) => [...document.querySelectorAll(selector)])
            .map(({ scrollWidth, clientWidth }) => scrollWidth - clientWidth)
    )
    for (const over of sizes) {
        expect(over).toBeLessThanOrEqual(0)
    }
}

async function openBench(page: Page, scene: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { openBenchTable } from '/src/lib/testing/benchTablePage.ts'
            await openBenchTable('${scene}')
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
}

async function openFollowUp(page: Page, call: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import * as tables from '/src/lib/testing/followUpTablePage.ts'
            await tables.${call}
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
}

async function pressGuildCard(page: Page) {
    await panel(page)
        .getByRole('button', { name: /^Guild/ })
        .first()
        .tap()
    await settled(page)
    await boardAtRest(page)
}

async function openFunction(page: Page, scene: string, guild: string, fn: RegExp) {
    await openBench(page, scene)
    await pressGuildCard(page)
    if ((await popup(page).count()) === 0) {
        await surface(page).locator(`[data-pick="guild:${guild}"]`).click()
        await settled(page)
    }
    await popup(page).locator('button').filter({ hasText: fn }).first().tap()
    await settled(page)
}

/**
 * Contract, The trade picker on a phone: a short bottom sheet, the board upright at its left and
 * compact rows beside it, every choice in view with no scroll, so more of the map shows.
 */
async function expectPickerSheet(page: Page, scene: string, guild: string) {
    await openFunction(page, scene, guild, /^\s*Trade/)
    const sheet = page.locator('[data-bench-sheet="trade"]')
    await expect(sheet.locator('[data-trade-picker]')).toBeVisible()
    const view = page.viewportSize()!
    const box = await rect(sheet)
    expect(box.height).toBeLessThanOrEqual(view.height * 0.4)
    const { down, across } = await sheet.evaluate((element) => ({
        down: element.scrollHeight - element.clientHeight,
        across: element.scrollWidth - element.clientWidth
    }))
    expect(down).toBeLessThanOrEqual(0)
    expect(across).toBeLessThanOrEqual(0)
    const board = await rect(sheet.locator('[data-upright-guild]'))
    expect(Math.abs(board.height - 210)).toBeLessThanOrEqual(2)
    expect(board.height).toBeGreaterThan(board.width)
    for (const card of await sheet.locator('[data-trade-card], [data-trade-other]').all()) {
        const at = await rect(card)
        expect(at.y).toBeGreaterThanOrEqual(box.y - 0.5)
        expect(at.y + at.height).toBeLessThanOrEqual(box.y + box.height + 0.5)
        expect(at.x + at.width).toBeLessThanOrEqual(view.width)
    }
    await expectNoSidewaysScroll(page)
}

/** A hand across the board. */
async function handPan(page: Page, dx: number, dy: number) {
    const view = await rect(boardView(page))
    const from = { x: view.x + view.width / 2, y: view.y + view.height / 2 }
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 })
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 })
    await page.mouse.up()
    await boardAtRest(page)
}

async function pressMove(page: Page) {
    await panel(page).getByRole('button', { name: 'Move', exact: true }).tap()
    await settled(page)
    await boardAtRest(page)
}

const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const boardGuild = (page: Page, guild: string) => surface(page).locator(`[data-guild="${guild}"]`)

test.describe('held upright', () => {
    test.use({ viewport: Upright, hasTouch: true, isMobile: true })

    test('R-1.2.5 the zoom row, Key and Supply in it, covers no score-track space, at rest or zoomed to the corner', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        await boardAtRest(page)
        expect(await scoreSpacesCovered(page)).toEqual([])
        await zoomToLowerLeft(page, 0)
        expect(await scoreSpacesCovered(page), 'at the corner').toEqual([])
        await zoomToLowerLeft(page, 2)
        expect(await scoreSpacesCovered(page), 'zoomed in 2').toEqual([])
        await shot(page, 'phone-zoom-row')
    })

    test('R-1.3 an enlarged guild area stands upright, as wide as the screen allows', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        // Framed or not, the area's own press enlarges it.
        await surface(page).locator('[data-enlarge="Merchant guild"]').dispatchEvent('click')
        await settled(page)
        const box = await rect(page.locator('[data-enlarged]'))
        expect(box.width).toBeCloseTo(Upright.width - 32, 0)
        expect(box.height).toBeCloseTo(((Upright.width - 32) * 500) / 354, 0)
        await expectNoSidewaysScroll(page)
    })

    test('S67 R-1.2 the height budget, top to bottom, with the board at cover fit on the Map', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        await boardAtRest(page)

        const column = await rect(stack(page))
        const header = await rect(page.locator('[data-table-header]'))
        const status = await rect(page.locator('[data-status-strip]'))
        const action = await rect(cap(page))
        const board = await rect(boardView(page))
        const strip = await rect(page.locator('[data-seat-strip]'))

        expect(header.height).toBe(28)
        expect(status.height).toBe(28)
        expect(strip.height).toBe(44)
        expect(action.height).toBeLessThanOrEqual(0.36 * column.height + 1)
        expect(status.y).toBeGreaterThanOrEqual(header.y + header.height - 1)
        expect(action.y).toBeGreaterThanOrEqual(status.y + status.height - 1)
        expect(board.y).toBeGreaterThanOrEqual(action.y + action.height - 1)
        expect(strip.y).toBeGreaterThanOrEqual(board.y + board.height - 1)
        expect(strip.y + strip.height).toBeLessThanOrEqual(Upright.height + 1)

        // The board, with the zoom row's band under it, fills the view's height and overruns its
        // width: a cover fit, and on the Map.
        const drawn = await rect(surface(page))
        const band = await rect(page.locator('[data-zoom-row-band]'))
        expect(drawn.width).toBeGreaterThan(board.width * 2)
        expect(band.y).toBeCloseTo(drawn.y + drawn.height, 0)
        expect(drawn.height + band.height).toBeGreaterThanOrEqual(board.height - 40)
        await expect(chip(page, 'map')).toHaveAttribute('aria-pressed', 'true')
        expect(drawn.x + drawn.width / 2).toBeCloseTo(board.x + board.width / 2, -1)
        await shot(page, 'phone-budget')
    })

    test('S67 R-1.2 the chooser frames each part of the board, and the Map brings it back', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await boardAtRest(page)
        const rest = await boardScale(page)
        for (const area of ['map', 'west', 'east', 'tracks']) {
            await expectTarget(chip(page, area))
        }

        await chip(page, 'west').tap()
        await boardAtRest(page)
        await expect(chip(page, 'west')).toHaveAttribute('aria-pressed', 'true')
        await expect(chip(page, 'map')).toHaveAttribute('aria-pressed', 'false')
        const view = await rect(boardView(page))
        const merchant = await rect(boardGuild(page, 'merchant'))
        expect(merchant.x).toBeGreaterThanOrEqual(view.x - 1)
        expect(merchant.x + merchant.width).toBeLessThanOrEqual(view.x + view.width + 1)

        await chip(page, 'east').tap()
        await boardAtRest(page)
        await expect(chip(page, 'east')).toHaveAttribute('aria-pressed', 'true')
        const monk = await rect(boardGuild(page, 'monk'))
        expect(monk.x).toBeGreaterThanOrEqual(view.x - 1)
        expect(monk.x + monk.width).toBeLessThanOrEqual(view.x + view.width + 1)

        await chip(page, 'map').tap()
        await boardAtRest(page)
        await expect(chip(page, 'map')).toHaveAttribute('aria-pressed', 'true')
        expect(await boardScale(page)).toBeCloseTo(rest, 3)
    })

    test('S67 R-3.7 a Move pick frames its lit targets, up to 2.5 times the rest; closing it gives the Map back', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await boardAtRest(page)
        const rest = await boardScale(page)

        await pressMove(page)
        await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
        const framed = await boardScale(page)
        expect(framed).toBeGreaterThan(rest)
        expect(framed).toBeLessThanOrEqual(rest * 2.5 + 0.001)

        const view = await rect(boardView(page))
        for (const target of await lit(page).all()) {
            const box = await rect(target)
            expect(box.x).toBeGreaterThanOrEqual(view.x - 1)
            expect(box.y).toBeGreaterThanOrEqual(view.y - 1)
            expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width + 1)
            expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height + 1)
        }
        await expect(chip(page, 'map').locator('[data-lit-dot]')).toHaveCount(1)
        await expectTarget(undo(page))
        await shot(page, 'phone-move-framed')

        await undo(page).tap()
        await settled(page)
        await boardAtRest(page)
        await expect(lit(page)).toHaveCount(0)
        expect(await boardScale(page)).toBeCloseTo(rest, 3)
        await expect(chip(page, 'map')).toHaveAttribute('aria-pressed', 'true')
    })

    test('S67 R-3.7 a hand pan clears the framing: the pick closes and the view stays where the hand left it', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await boardAtRest(page)
        const rest = await boardScale(page)

        await pressMove(page)
        const framed = await rect(surface(page))
        await handPan(page, 60, 30)
        const panned = await rect(surface(page))
        expect(panned.x).not.toBe(framed.x)
        await expect(chip(page, 'map')).toHaveAttribute('aria-pressed', 'false')

        await undo(page).tap()
        await settled(page)
        await boardAtRest(page)
        const after = await rect(surface(page))
        expect(after.x).toBeCloseTo(panned.x, 0)
        expect(after.width).toBeCloseTo(panned.width, 0)
        expect(after.width / BoardWidth).toBeGreaterThan(rest)

        await chip(page, 'map').tap()
        await boardAtRest(page)
        expect(await boardScale(page)).toBeCloseTo(rest, 3)
    })

    test('S67 R-4.12 a table opened on an open pick frames it from the cover’s scale, not from nothing', async ({
        page
    }) => {
        await openFollowUp(page, 'openDawnTable()')
        await boardAtRest(page)
        const view = await rect(boardView(page))
        await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
        const across = view.width / BoardWidth
        expect(await boardScale(page)).toBeGreaterThan(across * 2)
        const drawn = await rect(surface(page))
        expect(drawn.height).toBeGreaterThanOrEqual(view.height - 40)
    })

    test('S67 R-3.16 a guild pick frames the West, and the East chip carries a lit dot', async ({
        page
    }) => {
        await openBench(page, 'guildPick')
        await pressGuildCard(page)
        await expect(chip(page, 'west')).toHaveAttribute('aria-pressed', 'true')
        await expect(chip(page, 'east').locator('[data-lit-dot]')).toHaveCount(1)
        await expect(chip(page, 'west').locator('[data-lit-dot]')).toHaveCount(1)
        await expect(chip(page, 'map').locator('[data-lit-dot]')).toHaveCount(0)
        const view = await rect(boardView(page))
        const merchant = await rect(boardGuild(page, 'merchant'))
        expect(merchant.x).toBeGreaterThanOrEqual(view.x - 1)
        expect(merchant.x + merchant.width).toBeLessThanOrEqual(view.x + view.width + 1)
        await shot(page, 'phone-guild-pick')
    })

    test('S68 R-4.6.4 a Merchant pull: the bench is a bottom sheet, its result and primary in its footer', async ({
        page
    }) => {
        await openFunction(page, 'merchantPull', 'merchant', /^\s*Pull/)
        const bench = page.locator('[data-bench]')
        const sheet = await rect(bench)
        expect(sheet.height).toBeLessThanOrEqual(0.8 * Upright.height + 1)
        expect(sheet.x).toBe(0)
        expect(sheet.width).toBe(Upright.width)
        expect(sheet.y + sheet.height).toBeCloseTo(Upright.height, 0)

        const footer = bench.locator('[data-bench-footer]')
        await expect(footer.locator('[data-bench-result]')).toBeVisible()
        // R-X.2 The send appears once the pull's goods are picked.
        await expect(page.locator('[data-primary]')).toHaveCount(0)
        for (const id of ['good:iron', 'good:iron', 'good:wood']) {
            await page
                .locator(`[data-bench-place="${id}"] button, [data-bench-button="${id}"] button`)
                .first()
                .tap()
            await settled(page)
        }
        await expect(footer.locator('[data-primary]')).toBeVisible()
        await expect(panel(page).locator('[data-primary]')).toHaveCount(0)
        await expect(page.locator('[data-primary]')).toHaveCount(1)
        const foot = await rect(footer)
        const picked = await rect(bench)
        expect(foot.y + foot.height).toBeLessThanOrEqual(picked.y + picked.height + 1)
        await expectTarget(footer.locator('[data-primary]'))

        const { across, down } = await bench.evaluate((element) => ({
            across: element.scrollWidth - element.clientWidth,
            down: element.getBoundingClientRect().height
        }))
        expect(across).toBeLessThanOrEqual(0)
        expect(down).toBeGreaterThan(0)
        await expectNoSidewaysScroll(page)
        await shot(page, 'phone-bench')

        // The presses stand over the art at the sheet's width, and the footer answers them.
        await expect(footer.locator('[data-primary]')).toContainText(/Move 3\b/)
    })

    test('S74 R-4.6.2 the trade picker’s sheet fits, its choices in view with no scroll', async ({
        page
    }) => {
        await expectPickerSheet(page, 'alchemistTrade', 'alchemist')
        await shot(page, 'phone-trade-picker')
        await expectPickerSheet(page, 'merchantTrade', 'merchant')
        const sheet = page.locator('[data-bench-sheet="trade"]')
        await sheet.locator('[data-trade-card="good:iron"] button').tap()
        await settled(page)
        await expect(sheet.locator('[data-basket-pick]')).toHaveCount(1)
        await expect(sheet.locator('[data-bench-send] [data-primary]')).toHaveText(
            /^Buy 1 good · \d+s$/
        )
        await expectTarget(sheet.locator('[data-bench-send] [data-primary]'))
    })

    test('S68 R-4.6 a tame from the bench collapses the sheet to its header', async ({ page }) => {
        await openFunction(page, 'knightTrade', 'knight', /^\s*Trade/)
        await page.locator('[data-trade-buy="row:seat"] button').first().tap()
        await settled(page)
        await popup(page)
            .locator('button')
            .filter({ hasText: /behemoth/ })
            .first()
            .tap()
        await settled(page)
        await expect(page.locator('[data-bench-header]')).toBeVisible()
        await expect(page.locator('[data-bench-footer]')).toHaveCount(0)
        const header = await rect(page.locator('[data-bench-header]'))
        expect(header.height).toBeLessThanOrEqual(60)
        await expectNoSidewaysScroll(page)
    })

    test('S68 R-3.1 the hand is drafted in a bottom sheet over the board: the heading, the eleven in two rows, then tray A', async ({
        page
    }) => {
        await createGame(page)
        await playToHands(page)
        await settled(page)
        // The sheet stands over the board on the seat strip, and the whole draft is in sight.
        await expect(cap(page)).toHaveAttribute('data-hand-sheet', '')
        const sheet = await rect(cap(page))
        const strip = await rect(page.locator('[data-seat-strip]'))
        expect(Math.abs(sheet.y + sheet.height - strip.y)).toBeLessThan(2)
        await expectTarget(seatChips(page).first())
        expect(sheet.y).toBeGreaterThan((await rect(boardView(page))).y)
        expect(
            await cap(page).evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
        ).toBe(true)
        const cells = panel(page).locator('[data-cards] [data-row]')
        await expect(cells).toHaveCount(11)
        const boxes = await Promise.all((await cells.all()).map((cell) => rect(cell)))
        const firstRow = boxes.filter(({ y }) => Math.abs(y - (boxes[0]?.y ?? 0)) < 2)
        expect(firstRow).toHaveLength(6)
        const secondRow = boxes.filter(({ y }) => y > (boxes[0]?.y ?? 0) + 2)
        expect(secondRow).toHaveLength(5)
        expect(new Set(secondRow.map(({ y }) => y)).size).toBe(1)
        await expectNoSidewaysScroll(page)

        // The round's heading over the eleven; tray A under them: the slots, the pouch, the send.
        const heading = await rect(panel(page).locator('[data-finalise-row]'))
        expect(heading.y + heading.height).toBeLessThanOrEqual((boxes[0]?.y ?? 0) + 1)
        const lastCard = boxes[10]
        expect(lastCard).toBeDefined()
        const tray = await rect(panel(page).locator('[data-hand-tray]'))
        expect(tray.y).toBeGreaterThanOrEqual((lastCard?.y ?? 0) + (lastCard?.height ?? 0) - 1)
        const slots = panel(page).locator('[data-plan] [data-slot]')
        await expect(slots).toHaveCount(4)
        const plan = await rect(panel(page).locator('[data-plan] [role="list"]'))
        const pouch = await rect(panel(page).locator('[data-rows="pouch"]'))
        // R-X.2 The send's row: the send appears there once the hand is picked.
        const send = await rect(panel(page).locator('[data-tray-row="send"]'))
        expect(pouch.y).toBeGreaterThanOrEqual(plan.y + plan.height)
        expect(send.y).toBeGreaterThanOrEqual(pouch.y + pouch.height)
        // The labels share one column, the rows another, so the rows line up on the left.
        const label = await rect(panel(page).locator('[data-tray-label="hand"]'))
        expect(label.x + label.width).toBeLessThanOrEqual(plan.x)
        expect(Math.abs(pouch.x - plan.x)).toBeLessThan(1)
        expect(Math.abs(send.x - plan.x)).toBeLessThan(1)
        expect(send.x + send.width).toBeLessThanOrEqual(tray.x + tray.width)
        for (const button of await panel(page).locator('[data-rows="pouch"] button').all()) {
            await expectTarget(button)
        }
        // R-3.3 Only the pouch good the seat can commit (saltpeter) is drawn: its art and short
        // name, nothing beneath, and no line about the one it lacks.
        const choices = panel(page).locator('[data-rows="pouch"] [data-pouch-choice]')
        await expect(choices).toHaveCount(1)
        await expect(choices.first().locator('[data-pouch-title]')).toHaveText('+1 card')
        await expect(choices.locator('[data-pouch-caption]')).toHaveCount(0)
        await expect(panel(page).locator('[data-rows="pouch"] [aria-disabled="true"]')).toHaveCount(
            0
        )
        await expect(panel(page).locator('[data-pouch-reason]')).toHaveCount(0)

        expect(send.y + send.height).toBeLessThanOrEqual(sheet.y + sheet.height + 1)

        // The send takes from the sheet; at a shared screen the next seat drafts in it.
        for (const index of [0, 1, 2, 3]) {
            await cells.nth(index).locator('button').first().tap()
        }
        const button = await rect(panel(page).locator('[data-primary]'))
        expect(Math.abs(button.y - send.y)).toBeLessThanOrEqual(2)
        expect(button.y + button.height).toBeLessThanOrEqual(sheet.y + sheet.height + 1)
        expect(await panel(page).locator('[data-primary-note]').innerText()).toBe("can't be undone")
        await shot(page, 'phone-hand')
        await panel(page).locator('[data-primary]').tap()
        await settled(page)
        await expect(panel(page).locator('[data-finalise-seat][data-finalised]')).toHaveCount(1)
    })

    test('S68 R-3.1 a card takes a pick and a magnifier, each 44 px, and the magnifier enlarges to the screen less 32', async ({
        page
    }) => {
        await createGame(page)
        await playToHands(page)
        await settled(page)
        const first = panel(page).locator('[data-cards] [data-row]').first()
        await first.scrollIntoViewIfNeeded()
        const pick = first.locator('button.face')
        const magnifier = first.locator('[data-enlarge]')

        const face = await rect(pick)
        const glass = await rect(magnifier)
        expect(glass.height).toBeGreaterThanOrEqual(Target)
        expect(glass.width).toBeGreaterThanOrEqual(Target)
        expect(glass.y - face.y).toBeGreaterThanOrEqual(Target)

        await magnifier.tap()
        await settled(page)
        const enlarged = await rect(page.locator('[data-enlarged]'))
        expect(enlarged.width).toBeCloseTo(Upright.width - 32, 0)
        await expect(pick).toHaveAttribute('aria-pressed', 'false')
        await page.keyboard.press('Escape')
        await settled(page)

        await page.touchscreen.tap(face.x + face.width / 2, face.y + 12)
        await settled(page)
        await expect(pick).toHaveAttribute('aria-pressed', 'true')
    })

    test('S68 the page narrowing to the screen raises no ResizeObserver loop', async ({ page }) => {
        await page.addInitScript(() => {
            window.addEventListener('error', (event) => {
                if (String(event.message).includes('ResizeObserver')) {
                    document.documentElement.dataset.resizeLoop = 'true'
                }
            })
        })
        // The harness's toolbar is wider than the phone; when it goes, the page narrows to the screen.
        await createGame(page)
        await playToHands(page)
        await settled(page)
        await expect(page.locator('html[data-resize-loop]')).toHaveCount(0)
    })

    test('S69 R-3.1 a chip for each seat, reading score, hand and writs, opening that seat as a sheet', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        const seats = await page.evaluate(() =>
            window.feudumSession.gameState.players.map(({ playerId, handCount }) => ({
                playerId,
                handCount
            }))
        )
        await expect(seatChips(page)).toHaveCount(seats.length)
        for (const { playerId, handCount } of seats) {
            const seatChip = page.locator(`[data-seat-chip="${playerId}"]`)
            await expectTarget(seatChip)
            await expect(seatChip.locator('[data-seat-chip-hand]')).toContainText(`${handCount}`)
            await seatChip.tap()
            await settled(page)
            await expect(seatLayer(page).locator('[data-seat-panel]')).toHaveAttribute(
                'data-seat-panel',
                playerId
            )
            const sheet = await rect(seatLayer(page).locator('[data-sheet]'))
            expect(sheet.height).toBeLessThanOrEqual(0.85 * Upright.height + 1)
            expect(sheet.y + sheet.height).toBeCloseTo(Upright.height, 0)
            expect(sheet.width).toBe(Upright.width)
            await page.keyboard.press('Escape')
            await settled(page)
            await expect(seatLayer(page)).toHaveCount(0)
        }
    })

    test('S69 R-5.1 another seat shows only what its seat panel shows, and its card back enlarges above the sheet', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        const { me, other, hiddenCards, count } = await page.evaluate(() => {
            const session = window.feudumSession
            const seat = session.gameState.players.find(
                ({ playerId }) => playerId !== session.myPlayerId
            )
            return {
                me: session.myPlayerId,
                other: seat?.playerId ?? '',
                hiddenCards: seat?.hand ?? [],
                count: seat?.handCount ?? 0
            }
        })
        expect(hiddenCards.length).toBeGreaterThan(0)

        await page.locator(`[data-seat-chip="${other}"]`).tap()
        await settled(page)
        const theirs = seatLayer(page).locator(`[data-seat-panel="${other}"]`)
        for (const face of [
            'data-seat-card',
            'data-set-aside',
            'data-writ-face',
            'data-deck-note'
        ]) {
            await expect(theirs.locator(`[${face}]`)).toHaveCount(0)
        }
        const theirHtml = await theirs.innerHTML()
        for (const name of [
            'Migrate',
            'Move',
            'Influence',
            'Improve',
            'Explore',
            'Harvest',
            'Tax'
        ]) {
            expect(theirHtml).not.toContain(name)
        }
        await expect(
            page.locator(`[data-seat-chip="${other}"] [data-seat-chip-hand]`)
        ).toContainText(`${count}`)
        await shot(page, 'phone-seat-other')
        const theirText = await theirs.innerText()
        await page.keyboard.press('Escape')
        await settled(page)

        await page.locator(`[data-seat-chip="${me}"]`).tap()
        await settled(page)
        const mine = seatLayer(page).locator(`[data-seat-panel="${me}"]`)
        // The seat's own sheet counts its hand; the hand itself is on the desk.
        await expect(mine.locator('[data-in-hand]')).toHaveText(/^\d+ in hand$/)
        await expect(mine.locator('[data-seat-card]')).toHaveCount(0)
        expect(await mine.innerText()).not.toBe(theirText)
        await page.keyboard.press('Escape')
        await settled(page)

        await page.locator(`[data-seat-chip="${other}"]`).tap()
        await settled(page)
        const card = theirs.locator('[data-enlarge="card back"]').first()
        await card.tap()
        await settled(page)
        const enlarged = page.locator('[data-enlarged]')
        await expect(enlarged).toBeVisible()
        const box = await rect(enlarged)
        const onTop = await page.evaluate(
            ({ x, y }) =>
                document
                    .elementFromPoint(x, y)
                    ?.closest('[data-table-layer]')
                    ?.getAttribute('data-table-layer'),
            { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        )
        expect(onTop).toBe('enlarged')
        await expect(seatLayer(page)).toHaveCount(1)
        await shot(page, 'phone-seat-enlarged')
    })

    test('S69 R-5.1 another seat reads the same on a phone as in the desk column', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        const other = await page.evaluate(() => {
            const session = window.feudumSession
            return (
                session.gameState.players.find(({ playerId }) => playerId !== session.myPlayerId)
                    ?.playerId ?? ''
            )
        })
        await page.locator(`[data-seat-chip="${other}"]`).tap()
        await settled(page)
        const onPhone = await seatLayer(page)
            .locator(`[data-seat-panel="${other}"]`)
            .evaluate((element) => element.textContent)
        await page.keyboard.press('Escape')

        await page.setViewportSize({ width: 1600, height: 1000 })
        await settled(page)
        const onDesk = await page
            .locator(`[data-seat-column] [data-seat-panel="${other}"]`)
            .evaluate((element) => element.textContent)
        const words = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()
        expect(words(onPhone)).toBe(words(onDesk))
    })

    test('S73 R-1.2 the Tracks chip opens a sheet to look at: legible, scrolling inside, no target in it', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await boardAtRest(page)
        await pressMove(page)
        await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
        await chip(page, 'tracks').tap()
        await settled(page)
        const layer = page.locator('[data-table-layer="tracks"]')
        const sheet = layer.locator('[data-sheet]')
        const box = await rect(sheet)
        expect(box.height).toBeLessThanOrEqual(0.8 * Upright.height + 1)
        expect(box.width).toBe(Upright.width)
        const tracks = await layer
            .locator('[data-track]')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-track')))
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
        // Each drawing keeps its anchors, plain: an open pick lights none of them here.
        await expect(layer.locator('[data-pick-role]:not([data-pick-role="plain"])')).toHaveCount(0)

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
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            Upright.width
        )
        await shot(page, 'phone-tracks')
    })

    test('R-3.2 no hover: a card has no preview path, its press lights the places', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        const hand = panel(page).locator('[data-cards="hand"]')
        await expect(hand.locator('[data-preview]:visible')).toHaveCount(0)
        await expect(page.locator('[data-bright]')).toHaveCount(0)
        await hand.locator('button.face[aria-label="Move"]').tap()
        await settled(page)
        await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
    })

    test('S10a R-3.2 a picked card’s tray takes the line under the hand, Forfeit last', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        const cells = panel(page).locator('[data-cards="hand"] [data-row]:has(button.face)')
        await cells.first().locator('button.face').click()
        await settled(page)
        const tray = panel(page).locator('[data-card-tray]')
        await expect(tray).toBeVisible()
        const box = await rect(tray)
        for (const cell of await cells.all()) {
            const face = await rect(cell.locator('button.face'))
            expect(box.y).toBeGreaterThanOrEqual(face.y + face.height)
        }
        await expect(tray.getByRole('button').last()).toHaveText('Forfeit')
        await expectNoSidewaysScroll(page)
    })

    test('R-3.2 the hand in card play: every pick and magnifier is 44 px', async ({ page }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        const cells = panel(page).locator('[data-cards] [data-row]')
        for (const cell of await cells.all()) {
            await expectTarget(cell.locator('[data-enlarge]'))
            const face = await rect(cell.locator('button.face'))
            const glass = await rect(cell.locator('[data-enlarge]'))
            expect(glass.y - face.y).toBeGreaterThanOrEqual(Target)
            expect(face.width).toBeGreaterThanOrEqual(Target)
        }
        await expectNoSidewaysScroll(page)
    })

    test('R-6.2 the game end stands one seat per row, every category and charter still shown', async ({
        page
    }) => {
        await openFollowUp(page, 'openGameEndTable()')
        const seats = panel(page).locator('[data-game-end] [data-game-end-seat]')
        await expect(seats).toHaveCount(3)
        const boxes = await Promise.all((await seats.all()).map((seat) => rect(seat)))
        for (const [index, box] of boxes.entries()) {
            const before = boxes[index - 1]
            if (before) {
                expect(box.y).toBeGreaterThanOrEqual(before.y + before.height)
                expect(box.x).toBe(before.x)
            }
        }
        for (const row of ['before-dawn', 'dawn', 'voyage', 'empire', 'shillings', 'total']) {
            await expect(seats.first().locator(`[data-game-end-row="${row}"]`)).toHaveCount(1)
        }
        await expect(panel(page).locator('[data-game-end-charter]')).toHaveCount(1)
        await expectNoSidewaysScroll(page)
    })

    for (const [name, call, rule] of [
        ['the Dawn sheet', 'openDawnTable()', 'R-4.12'],
        ['the game end', 'openGameEndTable()', 'R-6.1'],
        ['a defend', "openDefendTable(true, 'asked')", 'R-3.14'],
        ['a starve', "openStarveTable(true, 'asked')", 'R-4.10'],
        ['the writ limit', 'openWritLimitTable()', 'R-4.4'],
        ['the at-will row', 'openAtWillTable()', 'R-4.4']
    ] as const) {
        test(`${rule} ${name} stays inside the cap with no sideways scroll`, async ({ page }) => {
            await openFollowUp(page, call)
            await expect(panel(page)).toBeVisible()
            const column = await rect(stack(page))
            const area = await rect(cap(page))
            expect(area.height).toBeLessThanOrEqual(0.36 * column.height + 1)
            await expectNoSidewaysScroll(page)
            await shot(page, `phone-${name.replace(/\W+/g, '-')}`)
        })
    }
})

test.describe('a 390 px phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('phone rendering: the board is drawn at the scale it shows, and the rails’ text is not zoomed', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        // Once the view settles the board is laid out again at its view scale (CSS zoom).
        await expect.poll(() => zoomOf(surface(page)), { timeout: 5_000 }).toBeLessThan(0.5)
        const zoom = await zoomOf(surface(page))
        const shown = (await surface(page).boundingBox())?.width ?? 0
        expect(zoom).toBeCloseTo(shown / BoardWidth, 2)

        // HTML laid out under that zoom would move and hit Safari's text floor: the rails take it off.
        await chip(page, 'west').click()
        await settled(page)
        const drawings = page.locator('[data-guild-rails] [data-guild-rail] > div')
        await expect(drawings).toHaveCount(3)
        for (const drawing of await drawings.all()) {
            expect(await zoomOf(drawing, true)).toBeCloseTo(1, 5)
        }
    })

    test('S74 R-4.6.2 the trade picker’s sheet fits, its choices in view with no scroll', async ({
        page
    }) => {
        await expectPickerSheet(page, 'alchemistTrade', 'alchemist')
        await shot(page, 'phone-390-trade-picker')
        await expectPickerSheet(page, 'merchantTrade', 'merchant')
    })

    test('Contract, Symbol key: the key opens over the board, inside the screen', async ({
        page
    }) => {
        await openFixture(page, 'cards-tile-gone-epoch-1')
        await page.locator('[data-symbol-key-toggle]').click()
        const key = page.getByRole('group', { name: 'Symbol key' })
        await expect(key).toBeVisible()
        const box = await key.boundingBox()
        const board = await page.locator('[data-board-view]').boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(390)
        expect(box!.y).toBeGreaterThanOrEqual(board!.y - 0.5)
        await page.locator('[data-symbol-key-toggle]').click()
        await expect(key).toHaveCount(0)
    })

    test('Contract, Supply: the general supply opens over the board, inside the screen, and a press closes it', async ({
        page
    }) => {
        await openFixture(page, 'cards-tile-gone-epoch-1')
        await expect(page.locator('[data-margin-layer]')).toHaveCount(0)
        const toggle = page.getByRole('button', { name: 'Supply' })
        await toggle.click()
        const card = page.getByRole('group', { name: 'General supply' })
        await expect(card).toBeVisible()
        const box = await card.boundingBox()
        const board = await page.locator('[data-board-view]').boundingBox()
        const width = page.viewportSize()!.width
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        expect(box!.y).toBeGreaterThanOrEqual(board!.y - 0.5)
        await card.tap()
        await expect(card).toHaveCount(0)
    })

    test('S10a R-3.2 a picked card’s tray fits the action area: one line, then the modes and Forfeit', async ({
        page
    }) => {
        await openFixture(page, 'cards-improve-town')
        const hand = panel(page).locator('[data-cards="hand"]')
        await hand.locator('button.face[aria-label="Improve"]').click()
        const tray = panel(page).locator('[data-card-tray="Improve"]')
        await expect(tray).toBeVisible()

        // No hover on a phone: a press on a card or a mode is itself the preview.
        await expect(hand.locator('[data-preview]:visible')).toHaveCount(0)
        await expect(tray.locator('[data-preview]:visible')).toHaveCount(0)

        // The stage line is one line, its card named at its head.
        const line = tray.locator('[data-tray-line]')
        await expect(line).toBeVisible()
        await expect(line).toContainText('Improve')
        const height = await line.evaluate((element) => {
            const box = element.getBoundingClientRect()
            return box.height / Number.parseFloat(getComputedStyle(element).lineHeight)
        })
        expect(height).toBeLessThan(1.5)

        // The tray's presses share one row; the special it can't play now is not drawn.
        const modes = tray.getByRole('button')
        const rows = new Set<number>()
        for (const mode of await modes.all()) {
            rows.add(Math.round((await rect(mode)).y + (await rect(mode)).height / 2))
        }
        expect(rows.size).toBe(1)
        await expect(tray.locator('[data-row^="Tend Landscape"]')).toHaveCount(0)

        // Forfeit stands in sight without scrolling, inside the action area.
        const forfeit = modes.last()
        await expect(forfeit).toHaveText('Forfeit')
        const area = await rect(page.locator('[data-action-cap]'))
        const box = await rect(forfeit)
        expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height + 0.5)
        expect(box.y + box.height).toBeLessThanOrEqual(844)
        expect(
            await page.locator('[data-action-cap]').evaluate((element) => element.scrollTop)
        ).toBe(0)
    })

    test('R-1.4.8 the starting-goods choice shows all five goods in the panel, in sight', async ({
        page
    }) => {
        await openFixture(page, 'setup-goods')
        const rows = panel(page).locator('[data-rows="goods"] [data-row]')
        await expect(rows).toHaveCount(5)
        const view = page.viewportSize()!
        const area = await rect(panel(page))
        for (const row of await rows.all()) {
            await expect(row).toBeVisible()
            const box = await rect(row)
            expect(box.x).toBeGreaterThanOrEqual(Math.max(0, area.x) - 0.5)
            expect(box.x + box.width).toBeLessThanOrEqual(
                Math.min(view.width, area.x + area.width) + 0.5
            )
            expect(box.y).toBeGreaterThanOrEqual(Math.max(0, area.y) - 0.5)
            expect(box.y + box.height).toBeLessThanOrEqual(view.height)
        }
    })

    test('R-4.6 the bench sheet shows both guild areas whole, the market’s every row in sight', async ({
        page
    }) => {
        await openFixture(page, 'guild-merchant-pull')
        const table = new ScenarioTable(page, true)
        await table.press(table.card('Guild'))
        await table.pressPick('guild:merchant')
        await table.press(table.popupRowStarting('Pull'))
        for (const id of ['good:iron', 'good:iron', 'good:wood']) {
            await table.press(
                page
                    .locator(
                        `[data-bench-place="${id}"] button, [data-bench-button="${id}"] button`
                    )
                    .first()
            )
        }
        const holder = page.locator('[data-bench-areas]')
        const room = await rect(holder)
        const areas = holder.locator('[data-bench-area]')
        await expect(areas).toHaveCount(2)
        for (const area of await areas.all()) {
            const box = await rect(area)
            expect(box.y).toBeGreaterThanOrEqual(room.y)
            expect(box.y + box.height).toBeLessThanOrEqual(room.y + room.height + 0.5)
            expect(box.x).toBeGreaterThanOrEqual(room.x)
            expect(box.x + box.width).toBeLessThanOrEqual(room.x + room.width + 0.5)
        }
        const { scrollHeight, clientHeight } = await holder.evaluate((element) => ({
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight
        }))
        expect(scrollHeight).toBeLessThanOrEqual(clientHeight)
        await expect(page.locator('[data-bench-footer] [data-primary]')).toBeInViewport({
            ratio: 1
        })
        await expectNoSidewaysScroll(page)
    })

    test('S68 R-4.6.5 each Knight row press reaches 44 px across, over its printed row', async ({
        page
    }) => {
        await openFunction(page, 'knightPush', 'knight', /^\s*Push/)
        const presses = page.locator('[data-bench-place^="row:"] button.face')
        expect(await presses.count()).toBeGreaterThan(1)
        for (const press of await presses.all()) {
            await expectTarget(press)
            const box = await rect(press)
            const row = await rect(press.locator('.ring'))
            expect(box.x).toBeLessThanOrEqual(row.x + 0.5)
            expect(box.x + box.width).toBeGreaterThanOrEqual(row.x + row.width - 0.5)
        }
        await expectNoSidewaysScroll(page)
    })

    test('R-3.14.1 the defender’s two answers each read on one line and stay in sight together', async ({
        page
    }) => {
        await openFixture(page, 'conquer-asked-defend')
        await settled(page)
        const answers = [
            "Flip Defend · +1 defence · +1 vp · can't be undone",
            "Let it stand · can't be undone"
        ]
        const edge = await panel(page).evaluate((element) => element.getBoundingClientRect().right)
        const area = await rect(cap(page))
        const boxes = []
        for (const name of answers) {
            const button = panel(page).getByRole('button', { name, exact: true })
            await expect(button).toBeVisible()
            const lines = await button.evaluate((element) => {
                const range = document.createRange()
                range.selectNodeContents(element)
                return new Set(
                    [...range.getClientRects()]
                        .filter(({ width }) => width > 0)
                        .map(({ top }) => Math.round(top))
                ).size
            })
            expect(lines).toBe(1)
            await expectTarget(button)
            const box = await rect(button)
            expect(box.x + box.width).toBeLessThanOrEqual(edge + 0.5)
            expect(box.y).toBeGreaterThanOrEqual(area.y)
            expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height + 1)
            boxes.push(box)
        }
        const [flip, stand] = boxes
        const apart =
            flip!.y + flip!.height <= stand!.y ||
            stand!.y + stand!.height <= flip!.y ||
            flip!.x + flip!.width <= stand!.x
        expect(apart).toBe(true)
        await expectNoSidewaysScroll(page)
    })

    test('R-4.12 the dawn sheet and the send beside it stay within the panel’s width', async ({
        page
    }) => {
        await openFixture(page, 'dawn-roll')
        const table = new ScenarioTable(page, true)
        await table.another('p3', { type: ActionType.ForfeitCard, kind: 'migrate' })
        const sheet = panel(page).locator('[data-dawn-sheet]')
        await expect(sheet.locator('[data-dawn-row]')).toHaveCount(3)
        const edge = await panel(page).evaluate((element) => element.getBoundingClientRect().right)
        const over = await panel(page)
            .locator('button, [data-dawn-row], [data-dawn-note], [data-primary]')
            .evaluateAll(
                (elements, right) =>
                    elements
                        .filter((element) => element.getBoundingClientRect().right > right + 0.5)
                        .map((element) => (element as HTMLElement).innerText.slice(0, 30)),
                edge
            )
        expect(over).toEqual([])
        const { scrollWidth, clientWidth } = await sheet.evaluate((element) => ({
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth
        }))
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
        await expectTarget(panel(page).locator('[data-primary]'))
        await expectNoSidewaysScroll(page)

        // The cap scrolls to the sheet's last line, clear of the send that stays in sight.
        await cap(page).evaluate((element) => element.scrollTo(0, element.scrollHeight))
        const area = await rect(cap(page))
        const send = await rect(panel(page).locator('[data-primary]'))
        for (const last of [sheet.locator('[data-dawn-row]').last(), sheet.locator('p').last()]) {
            const box = await rect(last)
            expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height + 1)
            expect(box.y >= send.y + send.height || box.y + box.height <= send.y).toBe(true)
        }
    })

    test('R-6.2 the game end shows every seat whole inside the action area', async ({ page }) => {
        await openFixture(page, 'game-end')
        await settled(page)
        const area = await rect(cap(page))
        const seats = panel(page).locator('[data-game-end] [data-game-end-seat]')
        await expect(seats).toHaveCount(3)
        for (const seat of await seats.all()) {
            const box = await rect(seat)
            expect(box.x).toBeGreaterThanOrEqual(area.x)
            expect(box.x + box.width).toBeLessThanOrEqual(area.x + area.width)
            expect(box.y).toBeGreaterThanOrEqual(area.y)
            expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height)
        }
        const charter = panel(page).locator('[data-game-end-charter]')
        await expect(charter.locator('[data-charter-score]')).toHaveText('5 vp')
        await charter.getByRole('button', { name: /^Enlarge/ }).tap()
        await expect(page.locator('[data-enlarged]')).toBeVisible()
        await expectNoSidewaysScroll(page)
    })
})

test.describe('held sideways', () => {
    test.use({ viewport: Sideways, hasTouch: true, isMobile: true })

    test('S67 R-3.1 the hand sheet caps at 85 % of the column, and scrolls inside rather than past it', async ({
        page
    }) => {
        await createGame(page)
        await playToHands(page)
        await settled(page)
        await expect(page.locator('.feudum-table')).toHaveAttribute('data-phone', 'sideways')
        // The action area's 40 % gives way to the hand's sheet while the hand is drafted.
        await expect(cap(page)).toHaveAttribute('data-hand-sheet', '')
        const column = await rect(stack(page))
        const action = await rect(cap(page))
        expect(action.height).toBeLessThanOrEqual(0.85 * column.height + 1)
        expect(action.height).toBeGreaterThan(0.4 * column.height)
        const overflowed = await cap(page).evaluate(
            ({ scrollHeight, clientHeight }) => scrollHeight > clientHeight
        )
        expect(overflowed).toBe(true)
        await expectNoSidewaysScroll(page)
        await shot(page, 'phone-sideways-hand')
    })

    test('S67 R-3.7 the board fits the chosen view by height, and a Move pick frames its targets', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await settled(page)
        await boardAtRest(page)
        const view = await rect(boardView(page))
        const map = await page.locator('[data-focus-chip="map"]').getAttribute('aria-pressed')
        expect(map).toBe('true')
        const rest = await boardScale(page)
        const mapHeight = rest * 833
        expect(mapHeight).toBeLessThanOrEqual(view.height - 36 + 1)
        expect(mapHeight).toBeGreaterThanOrEqual(view.height - 36 - 2 * 12 - 2)
        await shot(page, 'phone-sideways-board')

        await pressMove(page)
        await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
        for (const target of await lit(page).all()) {
            const box = await rect(target)
            expect(box.y).toBeGreaterThanOrEqual(view.y - 1)
            expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height + 1)
        }
    })
})

test.describe('a touch tablet', () => {
    test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true })

    test('S68 R-3.1 off the phone layout, a card magnifier under a finger is still 44 px', async ({
        page
    }) => {
        await createGame(page)
        await playToHands(page)
        await settled(page)
        await expect(page.locator('[data-phone]')).toHaveCount(0)
        const first = panel(page).locator('[data-cards] [data-row]').first()
        await first.scrollIntoViewIfNeeded()
        const pick = first.locator('button.face')
        const magnifier = first.locator('[data-enlarge]')
        const glass = await rect(magnifier)
        expect(glass.height).toBeGreaterThanOrEqual(Target)
        expect(glass.width).toBeGreaterThanOrEqual(Target)

        await magnifier.tap()
        await settled(page)
        await expect(page.locator('[data-enlarged]')).toBeVisible()
        await expect(pick).toHaveAttribute('aria-pressed', 'false')
    })
})
