import { expect, test, type Locator } from '@playwright/test'
import { openFixture, scenario, ScenarioTable } from './scenarioTable.js'

/**
 * The contract's scenario S75 on the real table: the guild standings head the Players tab on a
 * desk, and on a phone the seat strip's Guilds chip opens them as a bottom sheet.
 */

/** Contract, Phone layout: the seat strip's height. */
const StripHeight = 44

const standingsIn = (scope: Locator) => scope.locator('[data-guild-standings]')
const guildsLayer = (table: ScenarioTable) => table.page.locator('[data-table-layer="guilds"]')

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

/** The standings as a seat reads them: the Merchant's three places and its Others, the Farmer's. */
async function expectStandings(standings: Locator) {
    await expect(standings.locator('[data-standing-row]')).toHaveCount(6)
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
    await expect(
        standings.locator('[data-standing-row="farmer"] [data-standing-place="journeyman"]')
    ).toHaveAccessibleName('Farmer journeyman: vacant')
    await expect(standings.locator('[data-badge]')).toHaveCount(0)
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

scenario(
    'S75 R-4.5, R-4.7 Guild standings head the Players tab; a phone opens them from the Guilds chip',
    'standings-five-seats',
    async (table) => {
        if (!table.phone) {
            const column = table.page.locator('[data-seat-column]')
            const first = column.locator(':scope > *').first()
            await expect(first).toHaveAttribute('data-guild-standings', '')
            await expect(first.getByRole('heading', { name: 'Guild standings' })).toBeVisible()
            const standings = standingsIn(column)
            await expectStandings(standings)
            const head = await rect(standings)
            const seat = await rect(column.locator('[data-seat-panel]').first())
            expect(head.y + head.height).toBeLessThanOrEqual(seat.y)
            await expect(table.page.locator('[data-guilds-chip]')).toHaveCount(0)
            return
        }
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
        await expect(said).toHaveText('press a place for names')
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
