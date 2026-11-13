import { expect, test, type Locator, type Page } from '@playwright/test'
import { settled } from './helpers.js'
import { openFixture } from './scenarioTable.js'

/**
 * A desk at 1440 x 900, and a small laptop at 1280 x 720: where things stand on the real table, read
 * off the page.
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

const panel = (page: Page) => page.locator('[data-action-panel]')

const Target = 44

/** How far a press at a target's middle reaches across and down while still landing on it. */
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

async function openFunction(page: Page, scene: string, guild: string, fn: RegExp) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { openBenchTable } from '/src/lib/testing/benchTablePage.ts'
            await openBenchTable('${scene}')
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
    await panel(page)
        .getByRole('button', { name: /^Guild/ })
        .first()
        .click()
    await settled(page)
    if ((await page.locator('[data-board-popup]').count()) === 0) {
        await page.locator(`[data-board-surface] [data-pick="guild:${guild}"]`).click()
        await settled(page)
    }
    await page.locator('[data-board-popup] button').filter({ hasText: fn }).first().click()
    await settled(page)
}

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

test.describe('a 1440 px desk', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('S10a R-3.2 a picked card’s modes and Forfeit share one row in its tray', async ({
        page
    }) => {
        await openFixture(page, 'cards-improve-town')
        await page
            .locator('[data-action-panel] [data-cards="hand"] button.face[aria-label="Improve"]')
            .click()
        const tray = page.locator('[data-card-tray="Improve"]')
        await expect(tray.locator('[data-reason]')).toBeVisible()
        const boxes = await Promise.all((await tray.getByRole('button').all()).map(rect))
        const band = boxes.reduce((tall, box) => (box.height > tall.height ? box : tall))
        for (const box of boxes) {
            expect(box.y).toBeLessThan(band.y + band.height)
            expect(box.y + box.height).toBeGreaterThan(band.y)
        }
    })

    test('Contract, Symbol key: a Key button beside the zoom controls opens the vocabulary', async ({
        page
    }) => {
        await openFixture(page, 'cards-tile-gone-epoch-1')
        const toggle = page.locator('[data-symbol-key-toggle]')
        const controls = page.getByRole('button', { name: 'Enter full screen' })
        const beside = await rect(controls)
        const box = await rect(toggle)
        expect(box.x).toBeGreaterThanOrEqual(beside.x + beside.width)
        expect(Math.abs(box.y + box.height - (beside.y + beside.height))).toBeLessThan(8)

        await toggle.click()
        const key = page.getByRole('group', { name: 'Symbol key' })
        await expect(key).toBeVisible()
        await expect(key.locator('[data-key-caption]').first()).toHaveText('Farmer')
        const board = await rect(page.locator('[data-board-view]'))
        const card = await rect(key)
        expect(card.y).toBeGreaterThanOrEqual(board.y - 0.5)
        expect(card.x + card.width).toBeLessThanOrEqual(board.x + board.width + 0.5)
        await page.keyboard.press('Escape')
        await expect(key).toHaveCount(0)
    })

    test('Contract, Supply: no strip under the board; a Supply button beside the Key opens the general supply', async ({
        page
    }) => {
        await openFixture(page, 'cards-tile-gone-epoch-1')
        await expect(page.locator('[data-margin-layer], [data-layer="margin"]')).toHaveCount(0)

        // The board is its own height: the frame reaches the surface's foot, and the board fills the view one way.
        const surface = await rect(page.locator('[data-board-surface]'))
        const frame = await rect(page.locator('[data-board-surface] > svg').first())
        const row = await rect(page.locator('[data-board-row]'))
        const view = await rect(page.locator('[data-board-view]'))
        expect(Math.abs(frame.y + frame.height - (surface.y + surface.height))).toBeLessThan(1)
        expect(Math.max(row.width / view.width, row.height / view.height)).toBeGreaterThan(0.97)

        const key = await rect(page.locator('[data-symbol-key-toggle]'))
        const toggle = page.getByRole('button', { name: 'Supply' })
        const box = await rect(toggle)
        expect(box.x).toBeGreaterThanOrEqual(key.x + key.width)
        expect(Math.abs(box.y + box.height - (key.y + key.height))).toBeLessThan(2)

        const card = page.getByRole('group', { name: 'General supply' })
        await toggle.click()
        await expect(card).toBeVisible()
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        for (const name of [
            'Writ deck',
            'Haversack',
            "King's seals",
            'Vessels',
            'Influence markers',
            'Start player'
        ]) {
            await expect(card.getByRole('group', { name })).toBeVisible()
        }
        await expect(card.locator('[data-general-count="haversack-iron"]')).toHaveText(/^[0-9]+$/)
        const open = await rect(card)
        expect(open.y).toBeGreaterThanOrEqual(view.y - 0.5)
        expect(open.x + open.width).toBeLessThanOrEqual(view.x + view.width + 0.5)

        await page.keyboard.press('Escape')
        await expect(card).toHaveCount(0)
        await toggle.click()
        await card.click()
        await expect(card).toHaveCount(0)
        await toggle.click()
        await page.mouse.click(view.x + view.width - 20, view.y + 20)
        await expect(card).toHaveCount(0)
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    test('Contract, Supply: the zoom row stands right under the guild standings’ strip, not at the column’s foot', async ({
        page
    }) => {
        await openFixture(page, 'seats-four-mid-game')
        await settled(page)
        const strip = await rect(page.locator('[data-guild-strip]'))
        const view = await rect(page.locator('[data-board-view]'))
        const zoom = await rect(page.getByRole('button', { name: 'Zoom in' }))
        const key = await rect(page.locator('[data-symbol-key-toggle]'))
        const stripFoot = strip.y + strip.height
        // The row stands in the band under the strip: below it, and no further down than the band.
        expect(zoom.y).toBeGreaterThanOrEqual(stripFoot)
        expect(key.y + key.height - stripFoot).toBeLessThan(64)
        // The board's view ends with the band, so the row is the last thing in it.
        expect(Math.abs(view.y + view.height - (key.y + key.height))).toBeLessThan(8)
        // The board still takes the column's width.
        const surface = await rect(page.locator('[data-board-surface]'))
        expect(Math.abs(surface.width - view.width)).toBeLessThan(2)
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

    test('R-6.2 a sealed charter’s score reads as vp beneath its face', async ({ page }) => {
        await openFixture(page, 'game-end')
        const charter = panel(page).locator('[data-game-end-charter]')
        await expect(charter).toHaveCount(1)
        const score = charter.locator('[data-charter-score]')
        await expect(score).toHaveText('5 vp')
        const face = await rect(charter.locator('svg').first())
        expect((await rect(score)).y).toBeGreaterThanOrEqual(face.y + face.height - 1)
    })

    test('S68 R-4.6.5 each Knight row press reaches 44 px across, over its printed row', async ({
        page
    }) => {
        await openFunction(page, 'knightPush', 'knight', /^\s*Push/)
        const presses = page.locator('[data-bench-place^="row:"] button.face')
        expect(await presses.count()).toBeGreaterThan(1)
        for (const press of await presses.all()) {
            const { across, down } = await reach(press)
            expect(across).toBeGreaterThanOrEqual(Target)
            expect(down).toBeGreaterThanOrEqual(Target)
            const box = await rect(press)
            const row = await rect(press.locator('.ring'))
            expect(box.x).toBeLessThanOrEqual(row.x + 0.5)
            expect(box.x + box.width).toBeGreaterThanOrEqual(row.x + row.width - 0.5)
        }
    })
})

/** The game column holding the board view: how far its content runs past its height, and its foot. */
async function columnOf(page: Page) {
    return page.locator('[data-board-view]').evaluate((view) => {
        let column = view.parentElement
        while (column && getComputedStyle(column).display === 'contents') {
            column = column.parentElement
        }
        if (!column) {
            throw new Error('the board view has no column')
        }
        return {
            over: column.scrollHeight - column.clientHeight,
            foot: column.getBoundingClientRect().bottom
        }
    })
}

for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
]) {
    test.describe(`a ${viewport.width} x ${viewport.height} desk`, () => {
        test.use({ viewport })

        test('R-3.1 while a hand is chosen the board scales down, so the standings and the zoom row stay in the column', async ({
            page
        }) => {
            await openFixture(page, 'hands-five-seats')
            await expect(page.locator('[data-hand-tray]')).toBeVisible()
            await settled(page)
            const column = await columnOf(page)
            expect(column.over).toBeLessThanOrEqual(1)
            const strip = await rect(page.locator('[data-guild-strip]'))
            const zoom = await rect(page.getByRole('button', { name: 'Zoom in' }))
            const key = await rect(page.locator('[data-symbol-key-toggle]'))
            expect(strip.y + strip.height).toBeLessThanOrEqual(zoom.y)
            expect(key.y + key.height).toBeLessThanOrEqual(column.foot + 0.5)
            // R-1.2 Whole: smaller, the board keeps its shape.
            const surface = await rect(page.locator('[data-board-surface]'))
            expect(surface.width / surface.height).toBeCloseTo(2500 / 953, 1)
        })

        test('R-3.2 in card play the board is back at the column’s full width, and the column holds it all', async ({
            page
        }) => {
            await openFixture(page, 'seats-four-mid-game')
            await settled(page)
            const surface = await rect(page.locator('[data-board-surface]'))
            const view = await rect(page.locator('[data-board-view]'))
            expect(Math.abs(surface.width - view.width)).toBeLessThan(2)
            const column = await columnOf(page)
            expect(column.over).toBeLessThanOrEqual(1)
            const key = await rect(page.locator('[data-symbol-key-toggle]'))
            expect(key.y + key.height).toBeLessThanOrEqual(column.foot + 0.5)
        })
    })
}
