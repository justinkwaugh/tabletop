import { expect, test, type Locator, type Page } from '@playwright/test'
import { settled, shot } from './helpers.js'

/**
 * The bench on the real table, as a seat presses it, at guild boards no short game reaches: the
 * session's offers are proved in its own specs; this proves they draw over the board, take the
 * press, and leave the board's own guild areas unreachable.
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
const primary = (page: Page) => panel(page).locator('[data-primary]')
const bench = (page: Page) => page.locator('[data-bench]')
const header = (page: Page) => page.locator('[data-bench-header]')
const result = (page: Page) => page.locator('[data-bench-result]')
const popup = (page: Page) => page.locator('[data-board-popup]')
const place = (page: Page, id: string) => page.locator(`[data-bench-place="${id}"]`)
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const boardGuild = (page: Page, guild: string) =>
    page.locator(`[data-board-surface] [data-pick="guild:${guild}"]`)

async function openTable(page: Page, scene: string) {
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

async function pressGuildCard(page: Page) {
    await panel(page)
        .getByRole('button', { name: /^Guild/ })
        .first()
        .click()
    await settled(page)
}

const popupRow = (page: Page, label: RegExp) =>
    popup(page).locator('button').filter({ hasText: label }).first()

async function openFunction(page: Page, scene: string, guild: string, fn: RegExp) {
    await openTable(page, scene)
    await pressGuildCard(page)
    if ((await popup(page).count()) === 0) {
        await boardGuild(page, guild).click()
    }
    await popupRow(page, fn).click()
    await settled(page)
}

async function pressAll(page: Page, ...items: readonly string[]) {
    for (const id of items) {
        await itemPress(page, id).click()
        await settled(page)
    }
}

function itemPress(page: Page, id: string): Locator {
    return page
        .locator(`[data-bench-place="${id}"] button, [data-bench-button="${id}"] button`)
        .first()
}

/** What a press at the middle of this would land on. */
async function onTop(page: Page, target: Locator): Promise<string | undefined> {
    const box = await target.boundingBox()
    expect(box).not.toBeNull()
    return page.evaluate(
        ([x, y]) => {
            const top = document.elementFromPoint(x, y)
            return top?.closest('[data-bench]') ? 'bench' : top?.tagName
        },
        [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2]
    )
}

test('S40 R-3.16 guilds light, a used one doesn’t; the popup’s rows; Undo closes it, then the card', async ({
    page
}) => {
    await openTable(page, 'guildPick')
    await pressGuildCard(page)
    await expect(boardGuild(page, 'merchant')).toHaveAttribute('data-pick-role', 'lit')
    await expect(boardGuild(page, 'noble')).not.toHaveAttribute('data-pick-role', 'lit')
    await shot(page, 'guild-pick')
    await boardGuild(page, 'merchant').click()
    await expect(popup(page)).toBeVisible()
    const rows = popup(page).locator('[data-row]')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('Trade')
    await expect(rows.nth(1)).toContainText('Pull')
    await expect(rows.nth(2)).toContainText('Push')
    await expect(rows.nth(2).locator('button')).toHaveAttribute('aria-disabled', 'true')
    await rows.nth(2).locator('button').click({ force: true })
    await expect(rows.nth(2).locator('[data-refusal]')).not.toBeEmpty()
    await shot(page, 'guild-functions')
    await undo(page).click()
    await expect(popup(page)).toHaveCount(0)
    await expect(boardGuild(page, 'merchant')).toHaveAttribute('data-pick-role', 'lit')
    await undo(page).click()
    await expect(boardGuild(page, 'merchant')).not.toHaveAttribute('data-pick-role', 'lit')
})

test('S41 R-4.6.4 barn left, market right; ghosts, the line, the toggle; Undo; Send', async ({
    page
}) => {
    await openFunction(page, 'merchantPull', 'merchant', /^\s*Pull/)
    const areas = bench(page).locator('[data-bench-area]')
    await expect(areas).toHaveCount(2)
    await expect(areas.nth(0)).toHaveAttribute('data-bench-area', 'farmer')
    await expect(areas.nth(1)).toHaveAttribute('data-bench-area', 'merchant')
    const [left, right] = await Promise.all([
        areas.nth(0).boundingBox(),
        areas.nth(1).boundingBox()
    ])
    expect(left?.width).toBe(440)
    expect(right?.width).toBe(440)
    expect(left?.y).toBe(right?.y)
    expect((left?.x ?? 0) + (left?.width ?? 0)).toBeLessThanOrEqual(right?.x ?? 0)

    await pressAll(page, 'good:iron', 'good:iron', 'good:wood')
    await expect(bench(page).locator('[data-bench-area="merchant"] [data-ghost]')).toHaveCount(3)
    await expect(result(page)).toHaveText("3 vp · 2 writs, keep 1 · can't be undone")
    await expect(page.locator('[data-bench-moved]')).toHaveText('3 goods · 1 row, 2 columns')
    const toggle = page.locator('[data-bench-count-toggle] [data-row]')
    await expect(toggle.nth(0)).toHaveText('Rows (1)')
    await expect(toggle.nth(1)).toHaveText('Columns (2)')
    await expect(toggle.nth(1)).toHaveAttribute('data-picked', '')
    await shot(page, 'merchant-pull')

    await undo(page).click()
    await expect(bench(page).locator('[data-ghost]')).toHaveCount(2)
    await pressAll(page, 'good:wood')
    await primary(page).click()
    await settled(page)
    await expect(bench(page)).toHaveCount(0)
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.feudumSession.gameState.getPlayerState(
                        window.feudumSession.myPlayerId ?? ''
                    ).score
            )
        )
        .toBeGreaterThan(0)
    await shot(page, 'merchant-pull-sent')
})

test('R-4.6.1 the board’s own guild areas take no press under the bench; Escape never closes it, Undo does', async ({
    page
}) => {
    await openFunction(page, 'merchantPull', 'merchant', /^\s*Pull/)
    // Hidden, so a key press can't reach them either.
    await expect(page.locator('[data-board-surface] [data-layer="guilds"]')).toHaveAttribute(
        'visibility',
        'hidden'
    )
    for (const guild of ['alchemist', 'merchant', 'farmer', 'knight', 'noble', 'monk']) {
        expect(
            await onTop(page, page.locator(`[data-board-surface] [data-guild="${guild}"]`))
        ).toBe('bench')
    }
    await page.keyboard.press('Escape')
    await settled(page)
    await expect(bench(page)).toBeVisible()
    await undo(page).click()
    await expect(bench(page)).toHaveCount(0)
    await expect(popup(page)).toBeVisible()
})

test('S42 R-4.6.4 below the threshold: "0 vp · no writ", and no warning on the primary', async ({
    page
}) => {
    await openFunction(page, 'belowThreshold', 'merchant', /^\s*Pull/)
    await pressAll(page, 'good:iron')
    await expect(result(page)).toHaveText('0 vp · no writ')
    await expect(primary(page)).not.toContainText('undone')
    await shot(page, 'below-threshold')
})

test('R-4.6.2 a Merchant trade: each bin’s price in rose, the payment’s split, the goods to the seat', async ({
    page
}) => {
    await openFunction(page, 'merchantTrade', 'merchant', /^\s*Trade/)
    await expect(bench(page).locator('[data-bench-area]')).toHaveCount(1)
    await expect(place(page, 'good:iron').locator('[data-bench-note="cost"]')).toBeVisible()
    await pressAll(page, 'good:iron', 'good:wood')
    await expect(page.locator('[data-bench-payment]')).not.toBeEmpty()
    await expect(page.locator('[data-bench-tray] [data-ghost]')).toHaveCount(2)
    await shot(page, 'merchant-trade')
})

test('R-4.6.5 a Farmer push’s count is a press on the result line, the higher preselected', async ({
    page
}) => {
    await openFunction(page, 'farmerPush', 'farmer', /^\s*Push/)
    await pressAll(page, 'good:iron', 'good:iron', 'good:wood')
    const toggle = page.locator('[data-bench-count-toggle] [data-row]')
    await expect(toggle.locator('button')).toHaveCount(2)
    await expect(toggle.nth(1)).toHaveAttribute('data-picked', '')
    await toggle.nth(0).locator('button').click()
    await settled(page)
    await expect(page.locator('[data-bench-count-toggle] [data-row]').nth(0)).toHaveAttribute(
        'data-picked',
        ''
    )
    await shot(page, 'farmer-push')
})

test('S43 R-4.6.5, R-4.6.6 inventions as buttons; the barrel fills each Knight row; Send', async ({
    page
}) => {
    await openFunction(page, 'alchemistPush', 'alchemist', /^\s*Push/)
    await expect(page.locator('[data-bench-button^="invention:"]')).toHaveCount(4)
    await shot(page, 'alchemist-push-open')
    await pressAll(page, 'invention:ship', 'invention:krud-barrel')
    await expect(page.locator('[data-bench-area="knight"] [data-ghost]')).not.toHaveCount(0)
    await expect(
        page.locator('[data-bench-area="alchemist"] [data-ghost-at="vessel-space"]')
    ).toHaveCount(1)
    await shot(page, 'alchemist-push')
    await primary(page).click()
    await settled(page)
    await expect(bench(page)).toHaveCount(0)
})

test('R-4.6.3 an Alchemist trade: a vessel for sale takes the press where it stands', async ({
    page
}) => {
    await openFunction(page, 'alchemistTrade', 'alchemist', /^\s*Trade/)
    await expect(place(page, 'vessel:ship').locator('[data-bench-note="cost"]')).toHaveText('3s')
    await pressAll(page, 'vessel:ship')
    await shot(page, 'alchemist-trade')
})

test('S44 R-4.6.3, R-4.2.4 the row’s price; the popup; the header over the map; the deploy; Undo', async ({
    page
}) => {
    await openFunction(page, 'knightTrade', 'knight', /^\s*Trade/)
    await expect(page.locator('[data-bench-button="row:seat"]')).toContainText('3s: take 4 markers')
    await pressAll(page, 'row:seat')
    await expect(popup(page)).toBeVisible()
    await expect(popup(page).locator('[data-row]').last()).toHaveText('No')
    await shot(page, 'knight-trade-popup')
    await popupRow(page, /behemoth/).click()
    await settled(page)
    await expect(bench(page)).toHaveCount(0)
    await expect(header(page)).toHaveText('Knight trade: tame the behemoth')
    await expect(page.locator('[data-board-surface] [data-pick-role="lit"]')).not.toHaveCount(0)
    await shot(page, 'knight-trade-map')
    await page.keyboard.press('Escape')
    await expect(header(page)).toBeVisible()
    await undo(page).click()
    await settled(page)
    await expect(bench(page)).toBeVisible()
    await expect(popup(page)).toBeVisible()
    await popupRow(page, /behemoth/).click()
    await settled(page)
    await page.locator('[data-board-surface] [data-pick-role="lit"]').first().click()
    await settled(page)
    await expect(header(page)).toHaveCount(0)
    await expect(bench(page)).toHaveCount(0)
    await shot(page, 'knight-trade-sent')
})

test('S44 R-4.6.3 a Farmer trade: the header over the map; a farm’s popup keeps it', async ({
    page
}) => {
    await openFunction(page, 'farmerTrade', 'farmer', /^\s*Trade/)
    await expect(header(page)).toHaveText('Farmer trade: pick a farm')
    await page.locator('[data-board-surface] [data-pick-role="lit"]').first().click()
    await settled(page)
    await expect(popup(page)).toBeVisible()
    await expect(header(page)).toContainText('split the goods sent')
    // Closed down to its header, the bench covers nothing: the board's guilds stay drawn.
    await expect(page.locator('[data-board-surface] [data-layer="guilds"]')).not.toHaveAttribute(
        'visibility',
        'hidden'
    )
    await shot(page, 'farmer-trade-split')
})

test('S45 R-4.6.5, R-5-H1 a used colour’s row does nothing; the seals land unseen', async ({
    page
}) => {
    await openFunction(page, 'knightPush', 'knight', /^\s*Push/)
    await pressAll(page, 'row:0', 'scroll:guild.noble.scroll.r1c1')
    await expect(page.locator('[data-bench-area="noble"] [data-ghost]')).toHaveCount(1)
    await itemPress(page, 'row:0').click({ force: true })
    await settled(page)
    await expect(page.locator('[data-bench-area="noble"] [data-ghost]')).toHaveCount(1)
    await expect(place(page, 'row:0').locator('[data-refusal]')).not.toBeEmpty()
    await shot(page, 'knight-push')
})

test('S46 R-4.6.3 both beads lit, no press on them; "Draw a bead"; Send', async ({ page }) => {
    await openFunction(page, 'monkTrade', 'monk', /^\s*Trade/)
    await expect(bench(page).locator('[data-bench-role="lit"]')).toHaveCount(2)
    await expect(bench(page).locator('[data-bench-place] button')).toHaveCount(0)
    await expect(primary(page)).toHaveText("Draw a bead · can't be undone")
    await shot(page, 'monk-trade')
    await primary(page).click()
    await settled(page)
    await expect(bench(page)).toHaveCount(0)
})

test('S47 R-3.16.3 a Feast: the bench for the opponent’s push, its points, no reeve', async ({
    page
}) => {
    await openTable(page, 'feast')
    await pressGuildCard(page)
    await panel(page)
        .getByRole('button', { name: /^Feast/ })
        .first()
        .click()
    await settled(page)
    await page.locator('[data-board-surface] [data-pick="space:space.desert.1"]').click()
    await settled(page)
    await shot(page, 'feast-popup')
    await popupRow(page, /Merchant push/).click()
    await settled(page)
    await pressAll(page, 'good:wood', 'good:wood')
    await expect(result(page)).toContainText('+3 vp feast')
    await expect(page.locator('[data-bench-reeve]')).toHaveCount(0)
    await shot(page, 'feast-bench')
})

test('S48 R-4.4-H1 a Migrate short of food, with a tile: the primary covers; the tile’s row', async ({
    page
}) => {
    await openTable(page, 'migrateShort')
    await panel(page)
        .getByRole('button', { name: /^Migrate/ })
        .first()
        .click()
    await settled(page)
    await panel(page).locator('[data-rows] [data-row] button').first().click()
    await settled(page)
    await page.locator('[data-board-surface] [data-pick-role="lit"]').first().click()
    await settled(page)
    await popupRow(page, /Monk/).click()
    await settled(page)
    await expect(primary(page)).toHaveText('Cover with a tile')
    await expect(panel(page).locator('[data-row*=" tile: "]')).toContainText('food')
    await shot(page, 'migrate-cover')
})

test('S48 R-3.6, R-4.4-H1 a Migrate short of food, with no tile: dimmed, with its reason', async ({
    page
}) => {
    await openTable(page, 'migrateNoTile')
    await panel(page)
        .getByRole('button', { name: /^Migrate/ })
        .first()
        .click()
    await settled(page)
    const pawn = panel(page).locator('[data-row="Pawn from supply"]')
    await expect(pawn.locator('button')).toHaveAttribute('aria-disabled', 'true')
    await pawn.locator('button').click({ force: true })
    await expect(pawn.locator('[data-refusal]')).toContainText('needs 1 food')
    await shot(page, 'migrate-no-tile')
    await page.reload()
    await openTable(page, 'migrateNoPawn')
    await panel(page)
        .getByRole('button', { name: /^Migrate/ })
        .first()
        .click()
    await settled(page)
    await shot(page, 'migrate-no-pawn')
    await expect(panel(page)).toContainText('needs 1 food')
})

test('S48 R-4.6.2 a price short of shillings is dimmed with its reason, and no cover', async ({
    page
}) => {
    await openTable(page, 'shortOfShillings')
    await pressGuildCard(page)
    if ((await popup(page).count()) === 0) {
        await boardGuild(page, 'merchant').click()
    }
    const trade = popup(page).locator('[data-row]').first()
    await expect(trade).toContainText('Trade')
    await expect(trade.locator('button')).toHaveAttribute('aria-disabled', 'true')
    await expect(popup(page)).not.toContainText(/cover/i)
    await trade.locator('button').click({ force: true })
    await expect(trade.locator('[data-refusal]')).not.toContainText(/tile/i)
    await shot(page, 'short-of-shillings')
})

test('S48 R-3.4, R-4.3-H3 a Feast short of sulfur, with a tile: dimmed, and where to spend it', async ({
    page
}) => {
    await openTable(page, 'feastShort')
    await pressGuildCard(page)
    const feast = panel(page)
        .getByRole('button', { name: /^Feast/ })
        .first()
    await expect(feast).toHaveAttribute('aria-disabled', 'true')
    await feast.click({ force: true })
    await expect(panel(page).locator('[data-refusal]').first()).toContainText(
        'Undo, then spend a region tile.'
    )
    await shot(page, 'feast-short')
})

test('S70 R-4.6.3 full screen: the bench and its popup stand inside the dialog, and still send', async ({
    page
}) => {
    await openTable(page, 'knightTrade')
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    await settled(page)
    await pressGuildCard(page)
    if ((await popup(page).count()) === 0) {
        await boardGuild(page, 'knight').click()
    }
    await popupRow(page, /^\s*Trade/).click()
    await settled(page)
    await expect(page.locator('dialog:modal [data-bench]')).toBeVisible()
    await page.locator('[data-bench-button="row:seat"] button').click()
    await expect(page.locator('dialog:modal [data-board-popup]')).toBeVisible()
    await shot(page, 'full-screen-bench')
    await page.keyboard.press('Escape')
    await settled(page)
    await expect(page.locator('dialog:modal')).toHaveCount(0)
    await expect(bench(page)).toBeVisible()
    await popupRow(page, /^\s*No/).click()
    await settled(page)
    await expect(bench(page)).toHaveCount(0)
})
