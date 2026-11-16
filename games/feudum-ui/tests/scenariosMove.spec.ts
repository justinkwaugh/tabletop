import { expect } from '@playwright/test'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's Move scenarios, on the real table at both widths. */

const Forest1 = 'space:space.forest.1'
const Forest2 = 'space:space.forest.2'
const Forest3 = 'space:space.forest.3'
const Desert1 = 'space:space.desert.1'
const Desert2 = 'space:space.desert.2'
const Desert5 = 'space:space.desert.5'
const Badlands1 = 'space:space.badlands.1'
const Badlands3 = 'space:space.badlands.3'
const Sea3 = 'space:space.sea.3'
const Mountain2 = 'space:space.mountain.2'

const trailOf = (table: ScenarioTable, step: number) =>
    table.page.locator(`[data-board-surface] [data-trail="${step}"]`)

scenario('S25 R-3.7.1 Steps and trail', 'move-trail', async (table) => {
    await table.press(table.card('Move'))
    await table.pressPick('pawn:p1:1')
    await expect(table.pick('pawn:p1:1')).toHaveAttribute('data-pick-role', 'picked')
    await expect(await table.litChips()).toMatchObject({
        [Desert1]: 'road',
        'space:space.desert.4': 'road'
    })
    await table.pressPick(Desert1)
    await expect(trailOf(table, 1)).toHaveText('1')
    await expect(table.flowLine()).toHaveText('2 of 3 steps left')
    await expect(table.pick('pawn:p1:1')).toHaveAttribute('data-pick-role', 'picked')
    expect(await table.litChips()).toMatchObject({ [Badlands3]: 'place your ship' })
    await table.pressPick(Badlands3)
    await expect(trailOf(table, 2)).toHaveText('2')
    await expect(table.flowLine()).toHaveText('1 of 3 steps left')
    await table.press(table.undo())
    await expect(trailOf(table, 2)).toHaveCount(0)
    await expect(trailOf(table, 1)).toHaveText('1')
    await expect(table.flowLine()).toHaveText('2 of 3 steps left')
    await table.press(table.undo())
    await expect(trailOf(table, 1)).toHaveCount(0)
    await expect(table.flowLine()).toHaveText('3 of 3 steps left')
})

scenario('S26 R-4.2 Way popup: a road and a flying machine', 'move-way-popup', async (table) => {
    await table.press(table.card('Move'))
    await table.pressPick('pawn:p1:2')
    await table.pressPick(Mountain2)
    await expect(table.popupRow('Road')).toBeVisible()
    await expect(table.popupRow('Place your flying machine')).toBeVisible()
    await table.press(table.popupRow('Road'))
    await expect(table.popup()).toHaveCount(0)
    await expect(trailOf(table, 1)).toHaveText('1')
})

scenario(
    'S26 R-4.2.3 Way popup: a ferry runs, once no vessel is for sale',
    'move-ferry',
    async (table) => {
        await table.press(table.card('Move'))
        const ferry = table.pick(Desert5)
        await expect(ferry).toHaveAttribute('data-pick-role', 'lit')
        await expect(ferry.locator('[data-chip="rose"]')).toHaveText('ferry · 2s')
        await table.pressPick(Desert5)
        await expect(trailOf(table, 1)).toHaveText('1')
        await expect(table.primary()).toHaveText('Move · 1 step')
    }
)

scenario(
    'S26 R-4.2.3 With a vessel for sale, the ferry is absent',
    'move-vessel-for-sale',
    async (table) => {
        await table.press(table.card('Move'))
        await expect(table.pick(Forest3)).toHaveAttribute('data-pick-role', 'lit')
        await expect(table.pick(Desert5)).not.toHaveAttribute('data-pick-role', 'lit')
        expect(Object.values(await table.litChips())).not.toContain('ferry · 2s')
    }
)

const shipsHeld = async (table: ScenarioTable) => {
    const panel = await table.seatPanel('p1')
    // A vessel the seat holds none of stands nowhere on the panel.
    const ship = panel.locator('[data-supply-vessel="ship"]')
    const ships = (await ship.count()) === 0 ? '0' : (await ship.innerText()).trim()
    await table.closeSeatPanel()
    return ships
}

const riding = (table: ScenarioTable) => table.page.locator('[data-world="pawn:p1:1"] [data-rides]')

scenario('S27 R-4.2.2 Vessels: a ship in supply at a port', 'move-port', async (table) => {
    await table.press(table.card('Move'))
    const chips = await table.litChips()
    expect(chips[Badlands3]).toBe('place your ship')
    expect(Object.values(chips)).not.toContain('board the submersible')
    await table.pressPick(Badlands3)
    await expect(trailOf(table, 1)).toHaveText('1')
    await expect(table.primary()).toHaveText('Move · 1 step')
    await expect(riding(table)).toHaveCount(0)
    expect(await shipsHeld(table)).toBe('1')
    await table.press(table.primary())
    await table.settled()
    await expect(riding(table)).toHaveCount(1)
    expect(await shipsHeld(table)).toBe('0')
})

scenario(
    'S27 R-4.2.2 Vessels: an abandoned submersible adds its boarding',
    'move-port-abandoned',
    async (table) => {
        const abandoned = table.page.locator('[data-world="vessel:space.desert.1:submersible"]')
        await expect(abandoned).toHaveCount(1)
        await table.press(table.card('Move'))
        const chips = await table.litChips()
        expect(chips[Badlands3]).toBe('place your ship')
        expect(chips[Sea3]).toBe('board the submersible')
        await table.pressPick(Sea3)
        await expect(table.primary()).toHaveText('Move · 1 step')
        await expect(abandoned).toHaveCount(1)
        await table.press(table.primary())
        await table.settled()
        await expect(abandoned).toHaveCount(0)
        await expect(riding(table)).toHaveCount(1)
        expect(await shipsHeld(table)).toBe('1')
    }
)

scenario(
    'S27 R-4.2.2 Vessels: both reach one space, and the choice is a step',
    'move-port-abandoned',
    async (table) => {
        await table.press(table.card('Move'))
        await table.pressPick(Desert2)
        await expect(table.popupRow('Place your ship')).toBeVisible()
        await expect(table.popupRow('Board the submersible')).toBeVisible()
        await table.press(table.popupRow('Board the submersible'))
        await expect(trailOf(table, 1)).toHaveText('1')
        await expect(table.primary()).toHaveText('Move · 1 step')
    }
)

scenario('S28 R-4.2.4 Pinned', 'move-pinned', async (table) => {
    await table.press(table.card('Move'))
    const pinned = table.pick('pawn:p1:1')
    await expect(pinned).not.toHaveAttribute('data-pick-role', 'lit')
    await expect(pinned.locator('[data-chip="rose"]')).toHaveText('pinned')
    await expect(table.pick('pawn:p1:2')).toHaveAttribute('data-pick-role', 'lit')
    await expect(table.pick('pawn:p1:3')).toHaveAttribute('data-pick-role', 'lit')
})

scenario('S29 R-3.7.3 R-3.7.4 Godspeed and pilfer', 'move-godspeed', async (table) => {
    const before = await Promise.all(
        ['pawn:p1:1', 'pawn:p1:2', 'pawn:p1:3'].map((piece) => table.placeOf(piece))
    )
    const ironOnTown = table.page.locator('[data-world^="good:space.desert.1:iron"]')
    await expect(ironOnTown).toHaveCount(1)
    await table.press(table.card('Move'))
    await table.pressPick('pawn:p1:2')
    await table.pressPick(Desert1)
    await table.pressPick('pawn:p1:3')
    await table.pressPick(Forest1)
    await table.press(table.row('Stop moving'))
    await expect(table.pick('pawn:p1:1')).toHaveAttribute('data-pick-role', 'lit')
    await expect(table.pick('pawn:p1:2')).not.toHaveAttribute('data-pick-role', 'lit')
    await expect(table.pick('pawn:p1:3')).not.toHaveAttribute('data-pick-role', 'lit')
    await expect(table.row('No Godspeed')).toBeVisible()
    await table.pressPick('pawn:p1:1')
    await table.pressPick(Forest3)
    await expect(trailOf(table, 3)).toHaveText('3')
    await expect(trailOf(table, 3)).toHaveAttribute('opacity', '0.6')
    await expect(trailOf(table, 2)).not.toHaveAttribute('opacity', '0.6')

    await expect(table.pick('pilfer:space.desert.1:space:iron')).toHaveCount(1)
    expect(await table.litChips()).toEqual({
        'pilfer:space.forest.3:landscape:targets': 'target',
        'pilfer:space.desert.1:space:iron': 'iron'
    })
    await expect(
        table.page.locator('[data-board-surface] [data-pick^="pilfer:space.forest.1:"]')
    ).toHaveCount(0)

    await table.pressPick('pilfer:space.desert.1:space:iron')
    await expect(table.primary()).toHaveText('Move · 3 steps · pilfer 1 iron')
    await table.press(table.primary())
    await table.settled()
    await expect(ironOnTown).toHaveCount(0)
    expect(await table.goodsHeld('p1', 'iron')).toBe(2)
    await expect(table.placeOf('pawn:p1:2')).resolves.not.toBe(before[1])

    await table.press(table.undo())
    await table.settled()
    await expect(ironOnTown).toHaveCount(1)
    expect(await table.goodsHeld('p1', 'iron')).toBe(1)
    expect(
        await Promise.all(
            ['pawn:p1:1', 'pawn:p1:2', 'pawn:p1:3'].map((piece) => table.placeOf(piece))
        )
    ).toEqual(before)
    await expect(table.undo()).toHaveCount(0)
    await expect(table.card('Move')).toBeVisible()
})

scenario(
    'S30 R-3.7.3 Allowance spent: Godspeed opens by itself',
    'move-last-step-monk',
    async (table) => {
        await table.press(table.card('Move'))
        await table.pressPick(Forest3)
        await expect(table.row('No Godspeed')).toBeVisible()
        await expect(table.row('Stop moving')).toHaveCount(0)
        await expect(table.pick('pawn:p1:1')).toHaveAttribute('data-pick-role', /lit|picked/)
    }
)

scenario(
    'S30 R-3.7.4 Allowance spent: the pilfer opens by itself',
    'move-last-step-farmer',
    async (table) => {
        await table.press(table.card('Move'))
        await table.pressPick(Badlands1)
        await expect(table.row('No pilfer')).toBeVisible()
        await expect(table.row('Stop moving')).toHaveCount(0)
        expect(await table.litChips()).toEqual({ 'pilfer:space.badlands.1:space:food': 'food' })
    }
)

scenario(
    'S31 R-3.7.5 Second successful move: the voyage question',
    'voyage-repeat',
    async (table) => {
        const disc = table.page.locator('[data-world="voyage:p1"]')
        await expect(disc).toHaveCount(0)
        await table.press(table.card('Repeat'))
        await table.pressPick(Forest2)
        await table.press(table.primary())
        await table.settled()
        await expect(table.panel()).toContainText('Voyage space 1?')
        await expect(table.panel()).toContainText('3/3 discs free')
        await table.press(table.row('Place'))
        await table.settled()
        await expect(disc).toHaveCount(1)
        await expect(table.panel()).not.toContainText('Voyage space')
    }
)

scenario(
    'S31 R-3.7.5 With a disc on 1, the second space draws',
    'voyage-advance',
    async (table) => {
        await expect(table.page.locator('[data-world="voyage:p1"]')).toHaveCount(1)
        await table.press(table.card('Repeat'))
        await table.pressPick(Forest2)
        await table.press(table.primary())
        await table.settled()
        await expect(table.panel()).toContainText("To 2? +2 writs · can't be undone")
        await expect(table.row('Advance to 2')).toHaveText('Advance')
        await table.press(table.row('Advance to 2'))
        await expect(table.primary()).toHaveText("Advance to 2 · can't be undone")
        await table.press(table.primary())
        await expect(table.panel()).toContainText('Keep 1 of 2')
        await expect(table.panel().locator('[data-writs]')).toHaveCount(1)
        await table.showSeat('p2')
        await expect(table.panel()).not.toContainText('Keep 1 of 2')
        await expect(table.panel().locator('[data-writs]')).toHaveCount(0)
    }
)
