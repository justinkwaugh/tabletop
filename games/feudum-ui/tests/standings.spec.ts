import { expect, test, type Locator } from '@playwright/test'
import { openFixture, scenario, ScenarioTable } from './scenarioTable.js'

/**
 * The contract's scenario S75 on the real table: the guild standings stand in one strip under the
 * board on a desk, spelled out; on a phone a guild view carries its rails, and the seat strip's
 * Guilds chip opens the table as a bottom sheet.
 */

/** Contract, Phone layout: the seat strip's height. */
const StripHeight = 44

const standingsIn = (scope: Locator) => scope.locator('[data-guild-standings]')
const railsOf = (table: ScenarioTable) => table.page.locator('[data-guild-rails]')
const stripOf = (table: ScenarioTable) => table.page.locator('[data-guild-strip]')
const guildsLayer = (table: ScenarioTable) => table.page.locator('[data-table-layer="guilds"]')

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

/** The standings as a seat reads them: the Merchant's three places and its Others, the Farmer's master. */
async function expectPlaces(standings: Locator, rows: number) {
    await expect(standings.locator('[data-standing-row]')).toHaveCount(rows)
    const merchant = standings.locator('[data-standing-row="merchant"]')
    for (const name of [
        'Merchant master: Ana, 1 star',
        'Merchant journeyman: Cleo, 1 star',
        'Merchant apprentice: Dov, 1 star'
    ]) {
        await expect(merchant.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await expect(
        merchant.getByRole('button', { name: 'Merchant master: Ana, 1 star' })
    ).toHaveAttribute('data-lead', '')
    const other = merchant.getByRole('button', {
        name: 'Merchant, no place: Esme, 1 star, outranked'
    })
    await expect(other).toHaveAttribute('title', 'Esme, 1 star, outranked')
    await expect(
        standings.locator('[data-standing-row="farmer"] [data-standing-place="master"]')
    ).toHaveAccessibleName('Farmer master: Bram, 1 star')
    await expect(standings.locator('[data-badge]')).toHaveCount(0)
}

/** The sheet's table: every place has a cell, the Farmer's empty journeyman named "vacant". */
async function expectStandings(standings: Locator) {
    await expectPlaces(standings, 6)
    await expect(
        standings.locator('[data-standing-row="farmer"] [data-standing-place="journeyman"]')
    ).toHaveAccessibleName('Farmer journeyman: vacant')
}

/** Each rail stands level with its guild's area, on the side the guild stands. */
async function expectRailsLevel(table: ScenarioTable, guilds: readonly string[]) {
    for (const guild of guilds) {
        const rail = await rect(table.page.locator(`[data-guild-rail="${guild}"]`))
        const area = await rect(table.page.locator(`[data-board-surface] [data-guild="${guild}"]`))
        expect(rail.y).toBeGreaterThanOrEqual(area.y - 4)
        expect(rail.y + rail.height).toBeLessThanOrEqual(area.y + area.height + 4)
    }
}

/** Nothing on the page scrolls sideways, the sheet's body and table least of all. */
async function expectSheetFits(table: ScenarioTable) {
    const sheet = guildsLayer(table).locator('[data-sheet]')
    await expect(sheet).toBeVisible()
    const { across, right, page } = await sheet.evaluate((element) => ({
        across: Math.max(
            ...[element, ...element.querySelectorAll('[data-guild-standings], table')].map(
                (each) => each.scrollWidth - each.clientWidth
            )
        ),
        right: element.getBoundingClientRect().right - window.innerWidth,
        page: document.documentElement.scrollWidth - window.innerWidth
    }))
    expect(across).toBeLessThanOrEqual(0)
    expect(right).toBeLessThanOrEqual(0)
    expect(page).toBeLessThanOrEqual(0)
}

/** The strip's rails left to right, each whole, none clipped. */
async function expectStripInOrder(table: ScenarioTable) {
    const guilds = ['alchemist', 'merchant', 'farmer', 'knight', 'noble', 'monk']
    const strip = await rect(stripOf(table))
    let left = strip.x - 1
    for (const guild of guilds) {
        const rail = table.page.locator(`[data-guild-rail="${guild}"]`)
        const box = await rect(rail)
        expect(box.x, guild).toBeGreaterThan(left)
        expect(box.y + box.height, guild).toBeLessThanOrEqual(strip.y + strip.height + 1)
        left = box.x + box.width
        const clipped = await rail
            .locator('[data-standing-row]')
            .evaluate((section) => section.scrollHeight - section.clientHeight)
        expect(clipped, guild).toBeLessThanOrEqual(0)
    }
    expect(left).toBeLessThanOrEqual(strip.x + strip.width + 1)
}

scenario(
    'S75 R-4.5, R-4.7 Guild standings stand in a strip under the map on a desk; a phone opens them from the Guilds chip',
    'standings-five-seats',
    async (table) => {
        if (!table.phone) {
            const column = table.page.locator('[data-seat-column]')
            await expect(column.locator('[data-guild-standings], [data-guild-rail]')).toHaveCount(0)
            await expect(column.locator('[data-seat-panel]').first()).toBeVisible()
            await expect(railsOf(table)).toHaveCount(0)
            await expectPlaces(stripOf(table), 6)
            // The map takes the column's width between the guild buttons, or the height it has; the
            // strip stands under it, as wide.
            const surface = await rect(table.page.locator('[data-board-surface]'))
            const view = await rect(table.page.locator('[data-board-view]'))
            const strip = await rect(stripOf(table))
            expect(surface.width).toBeLessThanOrEqual(view.width - 2 * (45 + 4) + 2)
            expect(Math.abs(surface.x - view.x - (45 + 4))).toBeLessThan(1)
            expect(strip.y).toBeGreaterThanOrEqual(surface.y + surface.height)
            expect(strip.y - (surface.y + surface.height)).toBeLessThan(24)
            expect(Math.abs(strip.x - surface.x)).toBeLessThan(2)
            expect(Math.abs(strip.width - surface.width)).toBeLessThan(2)
            await expectStripInOrder(table)
            // Spelled out, no hover: every holder by name, the lower places lettered, the placeless with their reason.
            const merchant = table.page.locator('[data-guild-rail="merchant"]')
            await expect(merchant.locator('[data-standing-name]')).toHaveText([
                'Ana',
                'Cleo',
                'Dov',
                'Esme'
            ])
            await expect(merchant.locator('[data-standing-rank]')).toHaveText(['J', 'A'])
            await expect(merchant.locator('[data-standing-reason]')).toHaveText(['outranked'])
            await expect(merchant.locator('[data-standing-name]').first()).toBeVisible()
            // Only what exists: the Farmer's empty journeyman is not drawn.
            await expect(
                table.page.locator('[data-guild-rail="farmer"] [data-standing-place="journeyman"]')
            ).toHaveCount(0)
            // An open master is its empty outline, with no words.
            const open = table.page.locator('[data-guild-rail="knight"] [data-no-master]')
            await expect(open.locator('svg')).toBeVisible()
            await expect(open).not.toContainText('no master yet')
            const said = merchant.locator('[data-standings-said]')
            await table.press(merchant.locator('[data-standing-other="p5"]'))
            await expect(said).toHaveText('Merchant, no place: Esme, 1 star, outranked')
            await expect(table.page.locator('[data-guilds-chip]')).toHaveCount(0)
            return
        }
        await expect(railsOf(table)).toHaveCount(0)
        await table.press(table.page.locator('[data-focus-chip="west"]'))
        await expect(railsOf(table).locator('[data-guild-rail]')).toHaveCount(3)
        await expect(table.page.locator('[data-guild-rail="merchant"]')).toBeInViewport()
        await expectRailsLevel(table, ['alchemist', 'merchant', 'farmer'])
        await table.press(table.page.locator('[data-focus-chip="map"]'))
        await expect(railsOf(table)).toHaveCount(0)
        const chip = table.page.locator('[data-seat-strip] > *').last()
        await expect(chip).toHaveAttribute('data-guilds-chip', '')
        // As tall as a seat's chip: the strip's whole height under its top rule.
        const seatChip = await rect(table.page.locator('[data-seat-chip]').first())
        expect((await rect(chip)).height).toBe(seatChip.height)
        expect(seatChip.height).toBeGreaterThanOrEqual(StripHeight - 1)
        await table.press(chip)
        await expectSheetFits(table)
        const standings = standingsIn(guildsLayer(table))
        await expectStandings(standings)
        const said = standings.locator('[data-standings-said]')
        await expect(said).toHaveText('')
        // No hover on a phone: a press says the place's words.
        await table.press(standings.locator('[data-standing-other="p5"]'))
        await expect(said).toHaveText('Merchant, no place: Esme, 1 star, outranked')
        await table.page.keyboard.press('Escape')
        await expect(guildsLayer(table)).toHaveCount(0)
    }
)

test.describe('phone 390 x 844', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    test('S75 R-4.5 the Guilds sheet fits a 390 px phone with no sideways scroll', async ({
        page
    }) => {
        await openFixture(page, 'standings-five-seats')
        const table = new ScenarioTable(page, true)
        await table.press(page.locator('[data-guilds-chip]'))
        await expectSheetFits(table)
        await expectStandings(standingsIn(guildsLayer(table)))
    })
})

scenario(
    'S75 R-4.5.3 at the desk a rail holds every seat’s place: five Merchants, three placed and two outranked, none clipped',
    'standings-crowded',
    async (table) => {
        const merchant = table.page.locator('[data-guild-rail="merchant"]')
        await expect(merchant.locator('[data-standing-name]')).toHaveCount(5)
        await expect(merchant.locator('[data-standing-reason]')).toHaveText([
            'outranked',
            'outranked'
        ])
        await expectStripInOrder(table)
    },
    ['desktop']
)
