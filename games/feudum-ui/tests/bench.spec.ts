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
        .locator(
            `[data-bench-place="${id}"] button, [data-bench-button="${id}"] button, [data-trade-card="${id}"] button`
        )
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
    // A function the seat can't perform is not drawn.
    const rows = popup(page).locator('[data-row]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Trade')
    await expect(rows.nth(1)).toContainText('Pull')
    await expect(popup(page).locator('[data-row^="Push"]')).toHaveCount(0)
    await expect(popup(page).locator('[data-refusal]')).toHaveCount(0)
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
    expect(left?.height ?? 0).toBeGreaterThan(left?.width ?? 0)
    expect(right?.width).toBe(left?.width)
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

const picker = (page: Page) => page.locator('[data-trade-picker]')
const tradeCard = (page: Page, id: string) => picker(page).locator(`[data-trade-card="${id}"]`)
const upright = (page: Page) => picker(page).locator('[data-upright-guild]')

/** Contract, The trade picker: the guild's board stands upright, taller than wide, its offers ringed. */
async function expectUpright(page: Page, height: number) {
    const box = await upright(page).boundingBox()
    expect(box).not.toBeNull()
    expect(Math.abs((box?.height ?? 0) - height)).toBeLessThanOrEqual(2)
    expect(box?.height ?? 0).toBeGreaterThan(box?.width ?? 0)
}

test('S74 R-4.6.2 a Merchant trade: a bin per good, each priced; the basket adds up; one send', async ({
    page
}) => {
    await openFunction(page, 'merchantTrade', 'merchant', /^\s*Trade/)
    await expect(picker(page)).toBeVisible()
    await expect(page.locator('[data-bench-area]')).toHaveCount(0)
    await expectUpright(page, 310)
    await expect(upright(page).locator('[data-bench-role="lit"]')).not.toHaveCount(0)
    await expect(tradeCard(page, 'good:iron').locator('button')).toHaveAccessibleName(
        /^Iron: \d+s → iron$/
    )
    await expect(picker(page).locator('[data-trade-basket]')).toContainText('empty · up to 3')
    await pressAll(page, 'good:iron', 'good:wood')
    await expect(picker(page).locator('[data-basket-pick]')).toHaveCount(2)
    const send = picker(page).locator('[data-bench-send] [data-primary]')
    await expect(send).toHaveText(/^Buy 2 goods · \d+s$/)
    const [, total] = /· (\d+)s/.exec(await send.innerText()) ?? []
    await expect(picker(page).locator('[data-basket-total]')).toContainText(total ?? '-')
    await expect(primary(page)).toHaveCount(1)
    await shot(page, 'merchant-trade')
    await undo(page).click()
    await settled(page)
    await expect(picker(page).locator('[data-basket-pick]')).toHaveCount(1)
    await primary(page).click()
    await settled(page)
    await expect(picker(page)).toHaveCount(0)
})

test('R-4.6.3, R-4.10.2 a Merchant basket holding sulfur offers it into the barrel inside the picker', async ({
    page
}) => {
    await openFunction(page, 'merchantTrade', 'merchant', /^\s*Trade/)
    await pressAll(page, 'good:sulfur')
    const rows = picker(page).locator('[data-bench-rows] button')
    await expect(rows).toHaveText(['Keep it', 'Into the barrel: 1'])
    await rows.nth(1).click()
    await settled(page)
    await expect(picker(page).locator('[data-bench-rows] [data-row]').nth(1)).toHaveAttribute(
        'data-picked',
        ''
    )
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
    await expectUpright(page, 310)
    await expect(upright(page).locator('[data-bench-role="lit"]')).toHaveCount(2)
    await expect(upright(page).locator('button')).toHaveCount(0)
    const ship = tradeCard(page, 'vessel:ship')
    await expect(ship).toHaveAccessibleName('Ship: 3s → ship')
    await expect(ship.locator('[data-trade-buy] button')).toHaveText('Buy · 3s')
    await expect(ship.locator('[data-trade-buy] button')).toHaveAccessibleName('Buy ship · 3s')
    await expect(picker(page).locator('[data-trade-card]')).toHaveCount(2)
    await expect(picker(page).locator('[data-purse]')).toHaveText(/^you have .*9$/)
    await expect(picker(page).locator('[data-bench-send]')).toHaveCount(0)
    await shot(page, 'alchemist-trade')
    await pressAll(page, 'vessel:ship')
    await expect(picker(page)).toHaveCount(0)
    await undo(page).click()
    await settled(page)
    await expect(
        panel(page)
            .getByRole('button', { name: /^Guild/ })
            .first()
    ).toBeVisible()
})

test('S44 R-4.6.3, R-4.2.4 the row’s price; the popup; the header over the map; the deploy; Undo', async ({
    page
}) => {
    await openFunction(page, 'knightTrade', 'knight', /^\s*Trade/)
    await expect(tradeCard(page, 'row:seat')).toHaveAccessibleName(
        "Your row's markers: 3s → 4 markers"
    )
    await expect(tradeCard(page, 'row:seat').locator('[data-trade-buy] button')).toHaveText(
        'Buy · 3s'
    )
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
    // R-4.3 The tile shows its art; its name stays the button's name.
    const cover = panel(page).locator('[data-row*=" tile: "] button').first()
    await expect(cover).toHaveAccessibleName(/^[A-Z][a-z]+ I{1,3}V? tile: food$/)
    await expect(cover.locator('svg[role="img"]')).toBeVisible()
    await expect(cover.locator('span.beside-art')).toHaveText('for food')
    await shot(page, 'migrate-cover')
})

test('S48 R-3.6, R-4.4-H1 a Migrate short of food, with no tile: the supply pawn is not drawn', async ({
    page
}) => {
    await openTable(page, 'migrateNoTile')
    await panel(page)
        .getByRole('button', { name: /^Migrate/ })
        .first()
        .click()
    await settled(page)
    await expect(panel(page).locator('[data-row="Pawn from supply"]')).toHaveCount(0)
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

test('S48 R-4.6.2 a price short of shillings is not drawn, and no cover', async ({ page }) => {
    await openTable(page, 'shortOfShillings')
    await pressGuildCard(page)
    if ((await popup(page).count()) === 0) {
        await boardGuild(page, 'merchant').click()
    }
    await expect(page.locator('[data-row^="Trade"]')).toHaveCount(0)
    await expect(page.locator('[data-action-panel]')).not.toContainText(/cover/i)
    await shot(page, 'short-of-shillings')
})

test('S48 R-3.4, R-4.3-H3 a Feast short of sulfur, with a tile, is not drawn', async ({ page }) => {
    await openTable(page, 'feastShort')
    await pressGuildCard(page)
    await expect(panel(page).getByRole('button', { name: /^Feast/ })).toHaveCount(0)
    await expect(panel(page).locator('[data-refusal], [data-reason]')).toHaveCount(0)
    await shot(page, 'feast-short')
})

test('S74 R-3.16.3 a trade open, the control row stands above it; a Feast short of sulfur is not drawn', async ({
    page
}) => {
    await openFunction(page, 'feastShortTrade', 'knight', /^\s*Trade/)
    const controls = page.locator('[data-card-tray] [data-tray-controls]')
    await expect(controls.locator('[data-row^="Feast"]')).toHaveCount(0)
    await expect(controls.locator('[data-rows="card"]')).toContainText('Forfeit')
    await expect(picker(page)).toBeVisible()
    const above = await controls.boundingBox()
    const board = await picker(page).boundingBox()
    expect((above?.y ?? 0) + (above?.height ?? 0)).toBeLessThanOrEqual((board?.y ?? 0) + 1)
    await shot(page, 'feast-short-trade')
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
    await page.locator('[data-trade-buy="row:seat"] button').click()
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

/**
 * R-1.2.3 The quarter turn the browser draws: +1 clockwise, -1 counter-clockwise. The print lies on
 * its side with its top toward the board's nearer edge, so a west guild turns clockwise to stand
 * upright and an east guild counter-clockwise.
 */
async function turnOf(turned: Locator): Promise<number> {
    const matrix = await turned.evaluate((element) => getComputedStyle(element).transform)
    const [a, b] = (/matrix\(([^)]*)\)/.exec(matrix)?.[1] ?? '').split(',').map(Number)
    expect(Math.abs(a ?? 1)).toBeLessThan(1e-6)
    return Math.round(b ?? 0)
}

const UprightTurn = {
    alchemist: 1,
    merchant: 1,
    farmer: 1,
    knight: -1,
    noble: -1,
    monk: -1
} as const

test('R-1.3 an enlarged guild area stands its print upright: a west guild turned clockwise, an east one counter-clockwise', async ({
    page
}) => {
    await openTable(page, 'guildPick')
    for (const [guild, turn] of Object.entries(UprightTurn)) {
        const name = `${guild.charAt(0).toUpperCase()}${guild.slice(1)} guild`
        await page.locator(`[data-board-surface] [data-enlarge="${name}"]`).click()
        const turned = page.locator(`[data-enlarged-upright="${guild}"] > div`)
        await expect(turned).toBeVisible()
        expect(await turnOf(turned), guild).toBe(turn)
        await page.keyboard.press('Escape')
        await expect(turned).toHaveCount(0)
    }
})

test('R-4.6.3 the trade picker stands an east guild upright, its rings turned with it', async ({
    page
}) => {
    await openFunction(page, 'knightTrade', 'knight', /^\s*Trade/)
    const turned = upright(page).locator('> div')
    expect(await turnOf(turned)).toBe(UprightTurn.knight)
    const area = await upright(page).boundingBox()
    const rings = upright(page).locator('[data-bench-place]')
    expect(await rings.count()).toBeGreaterThan(0)
    for (let index = 0; index < (await rings.count()); index++) {
        const ring = await rings.nth(index).boundingBox()
        expect(ring && area && ring.x >= area.x - 1 && ring.y >= area.y - 1).toBe(true)
        expect(
            ring &&
                area &&
                ring.x + ring.width <= area.x + area.width + 1 &&
                ring.y + ring.height <= area.y + area.height + 1
        ).toBe(true)
    }
})

test('R-4.6.2 the trade picker stands a west guild upright', async ({ page }) => {
    await openFunction(page, 'merchantTrade', 'merchant', /^\s*Trade/)
    expect(await turnOf(upright(page).locator('> div'))).toBe(UprightTurn.merchant)
})

/** The net turn, in degrees, the browser draws this element at: its own and every ancestor's. */
async function netTurn(element: Locator): Promise<number> {
    return element.evaluate((start) => {
        let radians = 0
        for (let node: Element | null = start; node; node = node.parentElement) {
            if (node instanceof SVGGraphicsElement) {
                const matrix = node.transform.baseVal.consolidate()?.matrix
                if (matrix) {
                    radians += Math.atan2(matrix.b, matrix.a)
                }
            } else {
                const style = getComputedStyle(node)
                if (style.transform && style.transform !== 'none') {
                    const matrix = new DOMMatrix(style.transform)
                    radians += Math.atan2(matrix.b, matrix.a)
                }
                if (style.rotate && style.rotate !== 'none') {
                    radians += (parseFloat(style.rotate) * Math.PI) / 180
                }
            }
        }
        return (Math.round((radians * 180) / Math.PI) + 720) % 360
    })
}

/**
 * R-1.2.3 Every piece and every word of ours on a turned area reads upright: net turn 0. The
 * print's words, and the drawn panel and rank lines that stand in for it, turn with the print.
 */
async function expectLevel(scope: Locator) {
    const pieces = scope.locator(
        '[data-world] svg, [data-guild] text:not(svg[aria-label$="guild panel"] text, [data-print-stand-in]), [data-bench-note], [data-bench-count]'
    )
    for (let index = 0; index < (await pieces.count()); index++) {
        const piece = pieces.nth(index)
        const name = await piece.evaluate(
            (node) =>
                node.closest('[data-world]')?.getAttribute('data-world') ??
                node.getAttribute('data-bench-note') ??
                'label'
        )
        expect(await netTurn(piece), name).toBe(0)
    }
}

test('R-4.6.5 a push bench stands both areas upright, a west and an east guild, side by side in the board’s room', async ({
    page
}) => {
    await openFunction(page, 'merchantPush', 'merchant', /^\s*Push/)
    const areas = bench(page).locator('[data-bench-area]')
    await expect(areas).toHaveCount(2)
    for (const guild of ['merchant', 'alchemist'] as const) {
        const area = bench(page).locator(`[data-bench-area="${guild}"]`)
        expect(await turnOf(area.locator('[data-upright-turned]')), guild).toBe(UprightTurn[guild])
        const box = await area.locator('[data-upright-turned]').boundingBox()
        expect(box?.height ?? 0).toBeGreaterThan(box?.width ?? 0)
        await expectLevel(area)
    }
    await expect(bench(page).locator('[data-bench-area="merchant"] [data-world]')).not.toHaveCount(
        0
    )
    const [left, right] = await Promise.all([
        areas.nth(0).boundingBox(),
        areas.nth(1).boundingBox()
    ])
    expect(left?.y).toBe(right?.y)
    const holder = bench(page).locator('[data-bench-areas]')
    const room = await holder.evaluate((node) => node.scrollHeight - node.clientHeight)
    expect(room).toBeLessThanOrEqual(0)
    await shot(page, 'merchant-push-upright')
})

test('R-4.7 on a turned area the reeve stands upright at the marker’s size', async ({ page }) => {
    await openFunction(page, 'merchantPush', 'merchant', /^\s*Push/)
    const area = bench(page).locator('[data-bench-area="merchant"]')
    const reeve = area.locator('[data-world^="reeve:"] svg').first()
    const marker = area.locator('[data-world^="rank:"] svg').first()
    await expect(reeve).toHaveCount(1)
    expect(await reeve.getAttribute('width')).toBe(await marker.getAttribute('width'))
    const disc = await reeve.locator('[data-piece-shadow]').boundingBox()
    const hexagon = await marker.locator('[data-piece-shadow]').boundingBox()
    expect(disc?.height ?? 0).toBeGreaterThanOrEqual((hexagon?.height ?? 0) * 0.9)
    expect(await netTurn(area.locator('[data-world^="reeve:"] svg').first())).toBe(0)
})

test('R-4.6.4 a press on a turned bench space picks that space', async ({ page }) => {
    await openFunction(page, 'merchantPull', 'merchant', /^\s*Pull/)
    const places = bench(page).locator('[data-bench-area="farmer"] [data-bench-place] button')
    expect(await places.count()).toBeGreaterThan(0)
    for (let index = 0; index < (await places.count()); index++) {
        const press = places.nth(index)
        const id = await press.evaluate(
            (node) => node.closest('[data-bench-place]')?.getAttribute('data-bench-place') ?? ''
        )
        const box = await press.boundingBox()
        const hit = await page.evaluate(
            ([x, y]) =>
                document
                    .elementFromPoint(x, y)
                    ?.closest('[data-bench-place]')
                    ?.getAttribute('data-bench-place'),
            [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2]
        )
        expect(hit).toBe(id)
    }
    await pressAll(page, 'good:iron')
    await expect(bench(page).locator('[data-bench-area="merchant"] [data-ghost]')).toHaveCount(1)
    await expectLevel(bench(page).locator('[data-bench-area="merchant"]'))
})

test('R-1.3 the enlarged and the picked guild areas keep their pieces upright', async ({
    page
}) => {
    await openTable(page, 'merchantPush')
    await page.locator('[data-board-surface] [data-enlarge="Merchant guild"]').click()
    await expectLevel(page.locator('[data-enlarged-upright="merchant"]'))
    await page.keyboard.press('Escape')
    await openFunction(page, 'monkTrade', 'monk', /^\s*Trade/)
    await expectLevel(upright(page))
})

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('R-4.6.5 the push bench’s sheet holds both upright areas whole, side by side', async ({
        page
    }) => {
        await openFunction(page, 'merchantPush', 'merchant', /^\s*Push/)
        const areas = bench(page).locator('[data-bench-area]')
        await expect(areas).toHaveCount(2)
        const [left, right] = await Promise.all([
            areas.nth(0).boundingBox(),
            areas.nth(1).boundingBox()
        ])
        expect(left?.y).toBe(right?.y)
        expect((right?.x ?? 0) + (right?.width ?? 0)).toBeLessThanOrEqual(390)
        const holder = bench(page).locator('[data-bench-areas]')
        expect(
            await holder.evaluate((node) => node.scrollHeight - node.clientHeight)
        ).toBeLessThanOrEqual(0)
        await expectLevel(areas.nth(0))
        await shot(page, 'merchant-push-phone')
    })
})

test('R-4.6 a push lists its staged moves in the tray, each with its take-back', async ({
    page
}) => {
    await openFunction(page, 'merchantPush', 'merchant', /^\s*Push/)
    await pressAll(page, 'good:sulfur', 'good:sulfur', 'good:iron')
    const staged = panel(page).locator('[data-card-tray] [data-staged]')
    await expect(staged.locator('[data-staged-line]')).toHaveCount(2)
    await expect(staged.locator('[data-staged-line]').first()).toContainText(
        '2 sulfur · Merchant → Alchemist'
    )
    await expect(staged.locator('[data-staged-tally]')).toHaveText('3 of 4 moved')
    // R-X.2 Short of the push's count, no send is drawn.
    await expect(primary(page)).toHaveCount(0)
    await shot(page, 'push-staged')
    await staged
        .getByRole('button', { name: 'Take back 2 sulfur from the Merchant to the Alchemist' })
        .click()
    await settled(page)
    await expect(staged.locator('[data-staged-line]')).toHaveCount(1)
    await expect(bench(page).locator('[data-bench-area="alchemist"] [data-ghost]')).toHaveCount(1)
})

test.describe('the staged moves on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('R-4.6 the push’s staged moves stand in the sheet’s footer, with no send short of the count', async ({
        page
    }) => {
        await openFunction(page, 'merchantPush', 'merchant', /^\s*Push/)
        await pressAll(page, 'good:sulfur', 'good:iron')
        const footer = bench(page).locator('[data-bench-footer]')
        const staged = footer.locator('[data-staged]')
        await expect(staged.locator('[data-staged-line]')).toHaveCount(2)
        const [lines, foot] = await Promise.all([staged.boundingBox(), footer.boundingBox()])
        expect((lines?.y ?? 0) + (lines?.height ?? 0)).toBeLessThanOrEqual(
            (foot?.y ?? 0) + (foot?.height ?? 0) + 1
        )
        // R-X.2 Two of four moved: the send is not drawn until the push is whole.
        await expect(bench(page).locator('[data-bench-send]')).toHaveCount(0)
        await shot(page, 'push-staged-phone')
    })
})
