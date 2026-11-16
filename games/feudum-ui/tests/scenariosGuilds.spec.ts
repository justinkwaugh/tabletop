import { expect, type Locator } from '@playwright/test'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's Guild scenarios, on the real table at both widths. */

const Desert3 = 'space:space.desert.3'

const bench = (table: ScenarioTable) => table.page.locator('[data-bench]')
const header = (table: ScenarioTable) => table.page.locator('[data-bench-header]')
const result = (table: ScenarioTable) => table.page.locator('[data-bench-result]')
/** The bench's primary: in the panel at the desktop, in the bench's footer on the phone (S68). */
const benchPrimary = (table: ScenarioTable) => table.page.locator('[data-primary]')
const ghostsIn = (table: ScenarioTable, area: string) =>
    table.page.locator(`[data-bench-area="${area}"] [data-ghost]`)

/** A bench place or button, by its id: what a seat presses on the bench. */
const benchItem = (table: ScenarioTable, id: string): Locator =>
    table.page
        .locator(`[data-bench-place="${id}"] button, [data-bench-button="${id}"] button`)
        .first()

async function pressBench(table: ScenarioTable, ...ids: readonly string[]) {
    for (const id of ids) {
        await table.press(benchItem(table, id))
    }
}

/** R-3.16 The Guild card, the guild's area on the board, then a function of its popup. */
async function openFunction(table: ScenarioTable, guild: string, fn: string) {
    await table.press(table.card('Guild'))
    await table.pressPick(`guild:${guild}`)
    await table.press(table.popupRowStarting(fn))
}

const scoreOf = async (table: ScenarioTable, of: string): Promise<number> => {
    const panel = await table.seatPanel(of)
    const score = await panel.locator('[data-seat-score]').getAttribute('data-seat-score')
    await table.closeSeatPanel()
    return Number(score)
}

const Guilds = ['guild:alchemist', 'guild:knight', 'guild:merchant', 'guild:monk', 'guild:noble']

scenario('S40 R-3.16.1 Guild pick and functions', 'guild-pick', async (table) => {
    await table.press(table.card('Guild'))
    expect(Object.keys(await table.litChips()).sort()).toEqual(Guilds)
    await table.pressPick('guild:merchant')
    // The pull the seat holds no rank for is not drawn.
    const rows = table.popup().locator('[data-row]')
    await expect(rows).toHaveText([/Trade\s+from 1s/, /Push · up to 5 vp/])
    await expect(table.popupRowStarting('Trade')).not.toHaveAttribute('aria-disabled', 'true')
    await table.press(table.undo())
    await expect(table.popup()).toHaveCount(0)
    expect(Object.keys(await table.litChips()).sort()).toEqual(Guilds)
    await table.press(table.undo())
    await expect(table.lit()).toHaveCount(0)
    await expect(table.panel().locator('[data-cards] [data-row][data-picked]')).toHaveCount(0)
})

scenario('S40 R-3.16.2 a guild used this round is unlit', 'guild-pick-repeat', async (table) => {
    await table.press(table.card('Repeat'))
    expect(Object.keys(await table.litChips()).sort()).toEqual(
        Guilds.filter((guild) => guild !== 'guild:alchemist')
    )
})

scenario('S41 R-4.6.4 Merchant pull with count', 'guild-merchant-pull', async (table) => {
    await openFunction(table, 'merchant', 'Pull')
    const barn = table.page.locator('[data-bench-area="farmer"]')
    const market = table.page.locator('[data-bench-area="merchant"]')
    const [left, right] = [await barn.boundingBox(), await market.boundingBox()]
    // The two upright areas stand side by side, on a desk and in a phone's sheet.
    expect((left?.x ?? 0) + (left?.width ?? 0)).toBeLessThanOrEqual(right?.x ?? 0)

    await pressBench(table, 'good:iron', 'good:iron', 'good:wood')
    await expect(ghostsIn(table, 'merchant')).toHaveCount(3)
    await expect(table.page.locator('[data-bench-moved]')).toHaveText('3 goods · 1 row, 2 columns')
    const toggle = table.page.locator('[data-bench-count-toggle] [data-row]')
    await expect(toggle).toHaveText(['Rows (1)', 'Columns (2)'])
    await expect(toggle.nth(1)).toHaveAttribute('data-picked', '')
    await expect(result(table)).toHaveText("3 vp · 2 writs, keep 1 · can't be undone")

    await table.press(table.undo())
    await expect(ghostsIn(table, 'merchant')).toHaveCount(2)
    await pressBench(table, 'good:wood')
    const flights = await table.flightsOf(() => table.press(benchPrimary(table)))
    expect(flights).toContain('token: good')
    await expect(bench(table)).toHaveCount(0)
    await expect(table.panel()).toContainText('Keep 1 of 2')
})

scenario('S42 R-4.6.4, R-4.7-H1 Below threshold', 'guild-below-threshold', async (table) => {
    await openFunction(table, 'merchant', 'Pull')
    await pressBench(table, 'good:iron')
    await expect(ghostsIn(table, 'merchant')).toHaveCount(1)
    await expect(result(table)).toHaveText('0 vp · no writ')
    await expect(benchPrimary(table)).toHaveText('Move 1 good')
    await table.press(benchPrimary(table))
    await expect(bench(table)).toHaveCount(0)
    await expect(table.panel()).toContainText('Reeve in Merchant?')
})

scenario(
    'S43 R-4.6.5, R-4.6.6 Alchemist push inventions',
    'guild-alchemist-push',
    async (table) => {
        await openFunction(table, 'alchemist', 'Push')
        await pressBench(table, 'invention:ship', 'invention:krud-barrel')
        await expect(
            table.page.locator('[data-bench-area="alchemist"] [data-ghost-at="vessel-space"]')
        ).toHaveCount(1)
        await expect(ghostsIn(table, 'knight')).toHaveCount(4)
        const flights = await table.flightsOf(() => table.press(benchPrimary(table)))
        expect(flights).toEqual(expect.arrayContaining(['token: good', 'token: marker']))
        await expect(bench(table)).toHaveCount(0)
    }
)

scenario('S44 R-4.6.3, R-4.2.4 Knight trade and tame', 'guild-knight-trade', async (table) => {
    await openFunction(table, 'knight', 'Trade')
    const take = table.page.locator('[data-trade-buy="row:seat"] button')
    await expect(take).toHaveText('Buy')
    await expect(table.page.locator('[data-trade-card="row:seat"]')).toHaveAccessibleName(
        "Your row's markers: 3s → 4 markers"
    )
    await table.press(take)
    await table.press(table.popupRowStarting('Tame the behemoth'))
    await expect(bench(table)).toHaveCount(0)
    await expect(header(table)).toHaveText('Pick a space.')
    await expect(table.lit()).not.toHaveCount(0)

    await table.press(table.undo())
    await expect(bench(table)).toBeVisible()
    await expect(table.popup()).toBeVisible()
    await table.press(table.popupRowStarting('Tame the behemoth'))
    const [deploy] = Object.keys(await table.litChips())
    const flights = await table.flightsOf(() => table.pressPick(deploy ?? ''))
    expect(flights.filter((flight) => flight === "markers: Ana's influence marker")).toHaveLength(3)
    expect(flights).toContain('board: knight:blue:4')
    await expect(header(table)).toHaveCount(0)
    await expect(
        table.page.locator('[data-board-surface]').getByRole('img', { name: "Ana's behemoth" })
    ).toHaveCount(1)
})

scenario('S45 R-4.6.5, R-5-H1 Noble pull picks', 'guild-noble-pull', async (table) => {
    await openFunction(table, 'noble', 'Pull')
    await pressBench(
        table,
        'row:0',
        'row:1',
        'scroll:guild.noble.scroll.r1c2',
        'scroll:guild.noble.scroll.r2c1'
    )
    const seals = ghostsIn(table, 'noble')
    await expect(seals).toHaveCount(2)
    // A used row stays picked, with no press and no line.
    await expect(bench(table).locator('[data-bench-place="row:0"]')).toHaveAttribute(
        'data-bench-role',
        'picked'
    )
    await expect(benchItem(table, 'row:0')).toHaveCount(0)
    await expect(seals.getByRole('img', { name: "king's seal" })).toHaveCount(2)
    await expect(result(table)).toHaveText("3 vp · 2 writs, keep 1 · can't be undone")
})

scenario('S46 R-4.6.3 Monk trade', 'guild-monk-trade', async (table) => {
    await openFunction(table, 'monk', 'Trade')
    await expect(bench(table).locator('[data-bench-role="lit"]')).toHaveCount(2)
    await expect(benchPrimary(table)).toHaveText("Draw a bead · can't be undone")
    const rosary = table.page.locator('[data-board-surface] [data-motion^="bead:"]')
    const beads = await rosary.count()
    const flights = await table.flightsOf(() => table.press(benchPrimary(table)))
    expect(flights).toEqual(expect.arrayContaining(['seals: bead +2', 'seals: bead +5']))
    await expect(table.panel()).toContainText('kept bead +2')
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-supply-bead]')).toHaveAttribute('data-supply-bead', '2')
    await table.closeSeatPanel()
    await expect(rosary).toHaveCount(beads - 1)
})

scenario('S47 R-3.16.3 Feast', 'guild-feast', async (table) => {
    await table.press(table.card('Guild'))
    await table.press(table.row('Feast · 1 barrel sulfur'))
    await expect(table.popup().locator('[data-row]')).toContainText(['Ana · Merchant push'])
    await table.press(table.popupRowStarting('Ana · Merchant push'))
    await expect(bench(table)).toContainText('Merchant push')
    await pressBench(table, 'good:food', 'good:food')
    await expect(result(table)).toContainText('+3 vp feast')
    await expect(table.page.locator('[data-bench-reeve]')).toHaveCount(0)
})

scenario('S48 R-4.4-H1 Short payment covered with a tile', 'short-with-tile', async (table) => {
    await table.press(table.card('Migrate'))
    await table.pressPick(Desert3)
    await table.press(table.popupRowStarting('Monk'))
    await expect(table.primary()).toHaveText('Cover with a tile')
    await expect(table.panel().locator('[data-row*=" tile: "]')).toContainText('food')
})

scenario('S48 R-3.6, R-4.4-H1 Short payment with no tile', 'short-no-tile', async (table) => {
    await table.press(table.card('Migrate'))
    // No space can take the pawn in supply, so the line says why; the one on the map may still go off.
    await expect(table.flowLine()).toHaveText('Migrating onto the board needs 1 food.')
    await expect(table.panel().locator('[data-refusal]')).toHaveCount(0)
    expect(Object.values(await table.litChips())).toEqual(['off'])
})

scenario(
    'S48 R-4.6.2 a guild price short of shillings is not drawn, and offers no cover',
    'short-with-tile',
    async (table) => {
        await table.press(table.card('Guild'))
        await expect(table.popup()).toBeVisible()
        await expect(table.popup().locator('[data-row^="Trade"]')).toHaveCount(0)
        await expect(table.popup()).not.toContainText(/cover/i)
    }
)

scenario(
    'S48 R-3.4, R-4.3-H3 a Feast short of sulfur, with a tile, is not drawn',
    'short-with-tile',
    async (table) => {
        await table.press(table.card('Guild'))
        await expect(table.panel().getByRole('button', { name: /^Feast/ })).toHaveCount(0)
        await expect(table.panel().locator('[data-refusal], [data-reason]')).toHaveCount(0)
    }
)

async function scoringPush(table: ScenarioTable) {
    await openFunction(table, 'merchant', 'Push')
    await pressBench(table, 'good:food', 'good:food', 'good:sulfur', 'good:sulfur')
    await expect(result(table)).toContainText('5 vp')
    await table.press(benchPrimary(table))
    await expect(table.panel()).toContainText('Reeve in Merchant?')
}

/** The guild standings hold every seat's places, reeves too: in the strip at a desk, a phone's chip opens them. */
const reeveOf = async (table: ScenarioTable) => {
    if (table.phone) {
        await table.press(table.page.locator('[data-guilds-chip]'))
    }
    const scope = table.phone
        ? table.page.locator('[data-table-layer="guilds"]')
        : table.page.locator('[data-guild-strip]')
    const reeves = await scope
        .locator('[data-standing-row="merchant"] [data-standing-holder="p1"][data-reeve]')
        .count()
    if (table.phone) {
        await table.page.keyboard.press('Escape')
    }
    return reeves
}

scenario('S49 R-4.7 Reeve offer: Place', 'reeve-offer', async (table) => {
    await scoringPush(table)
    const before = await scoreOf(table, 'p1')
    await table.press(table.row('Place'))
    expect(await reeveOf(table)).toBe(1)
    expect(await scoreOf(table, 'p1')).toBe(before + 1)
})

scenario('S49 R-4.7 Reeve offer: Keep the disc', 'reeve-offer', async (table) => {
    await scoringPush(table)
    const before = await scoreOf(table, 'p1')
    await table.press(table.row('Keep the disc'))
    expect(await reeveOf(table)).toBe(0)
    expect(await scoreOf(table, 'p1')).toBe(before)
})
