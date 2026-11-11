import { expect, type Locator } from '@playwright/test'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's Board, panels and history scenarios S59 to S62, on the real table at both widths. */

const Forest2 = 'space:space.forest.2'
const Badlands1 = 'space:space.badlands.1'
const Charter = 'writ.charter.central-kingdom'

const enlarged = (table: ScenarioTable) => table.page.locator('[data-enlarged]')
const stackLayer = (table: ScenarioTable) => table.page.locator('[data-table-layer="stack"]')
const seatLayer = (table: ScenarioTable) => table.page.locator('[data-table-layer="seat"]')
const bright = (table: ScenarioTable) => table.page.locator('[data-board-surface] [data-bright]')
const trail = (table: ScenarioTable) => table.page.locator('[data-board-surface] [data-trail]')
const handRows = (table: ScenarioTable) => table.panel().locator('[data-cards="hand"] [data-row]')
const stepBack = (table: ScenarioTable) =>
    table.page.locator('button[aria-label="step backwards"]:visible')

/** What nothing but an Action changes: the seat's shown state, and the server's. */
const untouched = (table: ScenarioTable) =>
    table.page.evaluate(() =>
        JSON.stringify([
            window.feudumSession.gameState,
            window.feudumFixture.host.state,
            window.feudumFixture.host.actions.length
        ])
    )

/** A press that enlarges: it shows, and Escape closes it, leaving what was under it. */
async function expectEnlarges(table: ScenarioTable, target: Locator, kind: string) {
    await table.press(target)
    await expect(enlarged(table)).toHaveAttribute('data-enlarged', kind)
    await table.page.keyboard.press('Escape')
    await expect(enlarged(table)).toHaveCount(0)
}

/** A region stack, where the board shows it: the margin under the map, on the phone's Map view too. */
async function openStack(table: ScenarioTable) {
    await table.boardAtRest()
    await table.press(table.page.locator('[data-open-stack="forest"]'))
    await expect(stackLayer(table)).toBeVisible()
}

scenario('S59 R-3.1, R-4.4.4, R-1.2.4 Enlarge', 'writs-charter-held', async (table) => {
    const before = await untouched(table)

    const theirs = await table.seatPanel('p2')
    await expectEnlarges(table, theirs.locator('[data-enlarge="card back"]').first(), 'card')
    await table.closeSeatPanel()

    const own = await table.seatPanel('p1')
    await expectEnlarges(table, own.locator(`[data-writ-face="${Charter}"]`), 'writ')
    await table.closeSeatPanel()

    await openStack(table)
    await expectEnlarges(
        table,
        stackLayer(table).locator('[data-enlarge="tile back"]').first(),
        'tile'
    )
    await expect(stackLayer(table)).toBeVisible()
    await table.page.keyboard.press('Escape')
    await expect(stackLayer(table)).toHaveCount(0)

    expect(await untouched(table)).toBe(before)
})

scenario('S60 R-3.9, R-3.2 Hover preview', 'cards-improve-town', async (table) => {
    await expect(table.lit()).toHaveCount(0)
    await expect(bright(table)).toHaveCount(0)
    const brightened = async () =>
        (
            await bright(table).evaluateAll((all) =>
                all.map((pick) => pick.getAttribute('data-pick'))
            )
        )
            .map(String)
            .sort()

    if (table.phone) {
        // No hover on a phone and no preview path: the card's press lights the places, and Undo
        // takes them away.
        await expect(table.panel().locator('[data-preview="Improve"]')).toBeHidden()
        await table.press(table.card('Improve'))
        await expect.poll(() => table.lit().count()).toBeGreaterThan(0)
        await table.press(table.undo())
        await expect(table.lit()).toHaveCount(0)
        await expect(bright(table)).toHaveCount(0)
        return
    }
    await table.card('Improve').hover()
    await expect.poll(() => bright(table).count()).toBeGreaterThan(0)
    const shown = await brightened()
    await expect(table.lit()).toHaveCount(0)
    await table.page.mouse.move(5, 5)
    await expect(bright(table)).toHaveCount(0)
    await table.press(table.card('Improve'))
    expect(Object.keys(await table.litChips()).sort()).toEqual(shown)
})

scenario('S61 R-2.2, R-3.7.5 History View', 'voyage-repeat', async (table) => {
    await table.press(table.card('Repeat'))
    await table.pressPick(Forest2)
    await table.press(table.primary())
    await expect(table.panel()).toContainText('Place your voyage disc on space 1?')
    await table.press(table.row('Place'))

    // History opens on the latest Action, the disc's; a step back is the Move, and the seat was
    // then deciding where its voyage disc goes.
    const line = table.page.locator('[data-history-description] [data-action-line]')
    await table.press(stepBack(table))
    await expect(line).toHaveAttribute('data-action-line', /^You took voyage space 1/)
    await table.press(stepBack(table))
    await expect(table.panel()).toHaveCount(0)
    await expect(table.lit()).toHaveCount(0)
    await expect(table.pick('voyage:1')).toHaveAttribute('data-pick-role', 'being-decided')
    await expect(line).toHaveAttribute('data-action-line', /^You moved /)

    const before = await untouched(table)
    if (table.phone) {
        await table.press(table.page.locator('[data-seat-chip="p2"]'))
        await expect(seatLayer(table)).toBeVisible()
        await expectEnlarges(
            table,
            seatLayer(table).locator('[data-enlarge="card back"]').first(),
            'card'
        )
    } else {
        await expectEnlarges(table, table.page.locator('[data-enlarge="bead"]').first(), 'bead')
        await table.press(table.page.locator('[data-seat-column] [data-open-seat-of]').first())
        await expect(seatLayer(table)).toBeVisible()
    }
    await table.page.keyboard.press('Escape')
    await expect(seatLayer(table)).toHaveCount(0)
    expect(await untouched(table)).toBe(before)
    await expect(table.panel()).toHaveCount(0)
})

scenario(
    'S62 R-X.2, R-3.3, R-3.7.4 Undo through stages, then an Action',
    'undo-two-cards',
    async (table) => {
        // A Migrate, sent as the first of two cards, brings the second pawn the two steps need.
        await table.press(table.card('Migrate'))
        await table.press(table.row('Play two cards this turn'))
        await table.press(
            table
                .panel()
                .locator('[data-rows="flow"] [data-row^="Pawn"]')
                .first()
                .locator('button')
                .first()
        )
        await table.pressPick(Forest2)
        await table.press(table.popupRowStarting('Farmer, '))
        await expect(table.turnLine()).toHaveText('Your second card')
        expect(await table.piecesNamed('pawn:p1')).toHaveLength(2)

        await table.press(table.card('Move'))
        await table.pressPick('pawn:p1:1')
        await table.pressPick(Badlands1)
        await table.pressPick('pawn:p1:2')
        await table.pressPick(Badlands1)
        await table.pressPick('pilfer:space.badlands.1:space:food')
        await expect(table.primary()).toHaveText('Move · 2 steps · pilfer 1 food')
        await expect(trail(table)).toHaveCount(2)

        // The pilfer.
        await table.press(table.undo())
        expect(await table.litChips()).toEqual({ 'pilfer:space.badlands.1:space:food': 'food' })
        await expect(trail(table)).toHaveCount(2)
        // Step 2.
        await table.press(table.undo())
        await expect(trail(table)).toHaveCount(1)
        await expect(table.row('Stop moving')).toBeVisible()
        // Step 1.
        await table.press(table.undo())
        await expect(trail(table)).toHaveCount(0)
        expect(await table.litChips()).toEqual({ 'pawn:p1:1': '', 'pawn:p1:2': '' })
        // The card.
        await table.press(table.undo())
        await expect(table.lit()).toHaveCount(0)
        await expect(handRows(table)).toHaveCount(3)
        await expect(table.turnLine()).toHaveText('Your second card')
        // The Migrate, the Action before it.
        await table.press(table.undo())
        expect(await table.piecesNamed('pawn:p1')).toEqual(['pawn:p1:1'])
        await expect(handRows(table)).toHaveCount(4)
        await expect(table.turnLine()).toHaveText(/your 1st card of 4/)
        // Before it, the round's barrier: the hands were finalised, so Undo is gone.
        await expect(table.undo()).toHaveCount(0)
    }
)
