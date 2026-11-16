import { expect, type Locator } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import { scenario } from './scenarioTable.js'

/** The contract's card play scenarios, on the real table at both widths. */

const Forest2 = 'space:space.forest.2'
const Forest3 = 'space:space.forest.3'
const Desert3 = 'space:space.desert.3'
const StartingSpaces = [
    Forest2,
    Forest3,
    Desert3,
    'space:space.desert.4',
    'space:space.badlands.1',
    'space:space.badlands.4'
]

/** A played card in a seat's panel, which carries its mark. */
function playedMark(panel: Locator, kind: string): Locator {
    return panel.locator('[data-card-mark]', {
        has: panel.page().locator(`[data-seat-card="${kind}"][data-card-played]`)
    })
}

scenario('S10 R-3.8.3 Card modes', 'cards-merchant-under-marker', async (table) => {
    await table.press(table.card('Influence'))
    const space = table.pick(Forest2)
    await expect(space.locator('[data-chip="rose"]')).toHaveText('Money is Influence · 1s')
    await expect(table.primary()).toHaveText('Influence')
    await table.pressPick(Forest2)
    await expect(table.primary()).toHaveText('Influence at Forest 2')
    await expect(table.primary()).toHaveAccessibleName('Influence · Money is Influence at Forest 2')
    await table.press(table.undo())
    await expect(table.primary()).toHaveText('Influence')
    await table.press(table.undo())
    await expect(table.primary()).toHaveCount(0)
    await expect(table.picked()).toHaveCount(0)
})

scenario('S11 R-3.13-H1 Forfeit only', 'cards-last-conquer', async (table) => {
    await expect(table.panel().locator('[data-rows="card"] [data-row]')).toHaveCount(1)
    await expect(table.primary()).toHaveCount(0)
    await expect(table.panel().locator('[data-refusal-line]')).toHaveText("Can't be played last.")
    await table.press(table.row('Forfeit'))
    const panel = await table.seatPanel('p1')
    await expect(playedMark(panel, 'conquer')).toHaveAttribute('data-card-mark', 'forfeited')
    await table.closeSeatPanel()
})

scenario('S12 R-3.3 Two cards', 'cards-sulfur-pouch', async (table) => {
    await table.press(table.card('Tax'))
    await expect(table.primary()).toHaveText('Tax · +2s')
    await expect(table.row('Play two cards this turn')).toContainText('2 cards')
    await expect(table.row('Play two cards this turn')).toHaveAccessibleName(
        'Play two cards this turn'
    )
    await table.press(table.row('Play two cards this turn'))
    await expect(
        table.panel().locator('[data-row="Play two cards this turn"][data-picked]')
    ).toHaveCount(1)
    await table.press(table.primary())
    await expect(table.turnLine()).toHaveText('2nd card')
    await expect(table.panel().locator('[data-cards="hand"] [data-row]')).toHaveCount(2)
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-pouch][data-pouch-spent]')).toHaveCount(1)
    await table.closeSeatPanel()
})

scenario('S13 R-3.6 Migrate onto the board', 'cards-migrate', async (table) => {
    await table.press(table.card('Migrate'))
    const pawns = table.panel().locator('[data-rows="flow"] [data-row^="Pawn"]')
    await table.press(pawns.first().locator('button').first())
    expect(await table.litChips()).toEqual({ [Forest2]: '1 food' })
    await expect(table.pick(Forest2).locator('[data-chip] [aria-label="food"]')).toHaveCount(1)

    await table.press(table.row('Distant Kin'))
    expect(await table.litChips()).toEqual(
        Object.fromEntries(StartingSpaces.map((space) => [space, 'Distant Kin']))
    )
    await table.pressPick(Desert3)
    await expect(table.popup()).toBeVisible()
    expect(await table.piecesNamed('rank:guild.monk')).toEqual([])
    await expect(table.popup().locator('[data-popup-dice] [data-die]')).toHaveCount(6)
    const flights = await table.flightsOf(() => table.press(table.popupRowStarting('Monk, ')))
    expect(flights).toContain("pawns: Ana's monk pawn")
    expect(await table.piecesNamed('rank:guild.monk')).toEqual(['rank:guild.monk.track.master'])
    await expect(table.undo()).toBeVisible()
    await table.press(table.undo())
    expect(await table.piecesNamed('rank:guild.monk')).toEqual([])
    await expect(table.panel().locator('[data-cards="hand"] [data-row]')).toHaveCount(4)
    expect(await table.piecesNamed('pawn:p1')).toHaveLength(1)
})

scenario('S14 R-3.6 Migrate off', 'cards-migrate', async (table) => {
    await table.press(table.card('Migrate'))
    expect(await table.litChips()).toEqual({ 'pawn:p1:1': 'off' })
    const flights = await table.flightsOf(() => table.pressPick('pawn:p1:1'))
    expect(flights).toContain("pawns: Ana's alchemist pawn")
    expect(await table.piecesNamed('pawn:p1')).toEqual([])
    await expect(table.panel().locator('[data-cards="hand"] [data-row]')).toHaveCount(0)
})

scenario('S15 R-3.9 Improve to a feudum', 'cards-improve-town', async (table) => {
    await table.press(table.card('Improve'))
    expect(await table.litChips()).toEqual({ [Forest3]: 'town to feudum · 1 seal' })
    await table.pressPick(Forest3)
    await expect(table.popup().locator('[data-row]')).toHaveCount(6)
    await table.press(table.popupRow('Noble'))
    await expect(table.primary()).toHaveText("Improve Forest 3 to feudum · can't be undone")
    const disc = await table.scoreShown('p1')
    const scoreMotion = await table.scoreMotion('p1')
    const before = await table.page.locator(`[data-world="disc:space.forest.3"]`).innerHTML()
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(
        expect.arrayContaining([
            'board: disc:space.forest.3',
            scoreMotion,
            'tiles: forest tile, epoch I'
        ])
    )
    expect(await table.page.locator(`[data-world="disc:space.forest.3"]`).innerHTML()).not.toBe(
        before
    )
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-supply-tile]')).toHaveCount(1)
    await table.closeSeatPanel()
    expect(await table.scoreShown('p1')).not.toBe(disc)
})

scenario('S15a R-3.9-H1 Improve a farm: which town disc', 'cards-improve-farm', async (table) => {
    await table.press(table.card('Improve'))
    const chips = await table.litChips()
    const [farm] = Object.keys(chips)
    expect(chips).toEqual({ [farm]: 'farm to town · 1 iron' })
    await table.pressPick(farm)
    await expect(table.popup().locator('[data-popup-heading]')).toHaveText('Which disc?')
    for (const back of ['farm', 'outpost']) {
        const choice = table.popupRow(`Town disc, back: ${back}`)
        await expect(choice).toHaveAccessibleName(`Town disc, back: ${back}`)
        await expect(choice).toContainText(`back: ${back}`)
        expect(await choice.locator('svg').count()).toBeGreaterThanOrEqual(2)
    }
})

scenario(
    'S16 R-4.3.2 Improve with a prohibited tile, epoch I',
    'cards-tile-gone-epoch-1',
    async (table) => {
        await table.press(table.card('Improve'))
        await expect(table.flowLine()).toHaveText('Pick a place.')
        expect(await table.litChips()).toEqual({ [Forest3]: 'town to feudum · 1 seal' })
        await expect(table.stacksLit()).toHaveCount(0)
        await table.pressPick(Forest3)
        const flights = await table.flightsOf(() => table.press(table.popupRow('Monk')))
        expect(flights).toContain('board: disc:space.forest.3')
        expect(flights.filter((flight) => flight.startsWith('tiles:'))).toEqual([])
        await expect(table.undo()).toBeVisible()
        const panel = await table.seatPanel('p1')
        await expect(panel.locator('[data-supply-tile]')).toHaveCount(0)
        await table.closeSeatPanel()
    }
)

scenario(
    'S16 R-4.3.2 Improve with a prohibited tile, epoch III',
    'cards-tile-gone-epoch-3',
    async (table) => {
        await table.press(table.card('Improve'))
        await expect(table.flowLine()).toHaveText('Pick a place.')
        await table.pressPick(Forest3)
        await table.press(table.popupRow('Monk'))
        await expect(table.flowLine()).toHaveText('Pick an earlier tile.')
        expect(await table.litChips()).toEqual({
            'stack:desert': 'no vp',
            'stack:badlands': 'no vp',
            'stack:mountain': 'no vp'
        })
        await expect(table.primary()).toHaveCount(0)
        await table.pressPick('stack:desert')
        await expect(table.primary()).toHaveText("Improve Forest 3 to feudum · can't be undone")
        const flights = await table.flightsOf(() => table.press(table.primary()))
        expect(flights.filter((flight) => flight.startsWith('tiles:'))).toHaveLength(1)
    }
)

scenario('S17 R-3.9.3 TendLandscape', 'cards-tend-landscape', async (table) => {
    await table.press(table.card('Improve'))
    // Improve has nothing to improve here, so it is not drawn and Tend Landscape opens alone.
    await expect(table.panel().locator('[data-rows="modes"]')).toHaveCount(0)
    await table.press(table.rowIn('flow', 'Orchard tile'))
    expect(Object.keys(await table.litChips())).toEqual([Forest2])
    const seatFood = await table.goodsHeld('p2', 'food')
    const rulerFood = await table.goodsHeld('p1', 'food')
    await table.pressPick(Forest2)
    const flights = await table.flightsOf(() =>
        table.press(table.popupRow('Collect 3 food · 1 to the ruler'))
    )
    expect(flights.filter((flight) => flight === 'goods: food')).toHaveLength(3)
    expect(flights).toContain('tiles: orchard')
    expect(await table.piecesNamed('landscape:')).toEqual(['landscape:space.forest.2'])
    await expect(
        table.page.locator('[data-world="landscape:space.forest.2"] [aria-label="orchard"]')
    ).toBeAttached()
    expect(await table.goodsHeld('p2', 'food')).toBe(seatFood + 2)
    expect(await table.goodsHeld('p1', 'food')).toBe(rulerFood + 1)
    await expect(
        table
            .panel()
            .getByText(
                'You tended the orchard at Forest 2 · filled 3 · +2 vp · collected: kept 2, paid Ana 1'
            )
    ).toBeVisible()
})

scenario('S18 R-4.4.1 Explore and keep', 'cards-explore', async (table) => {
    await table.press(table.card('Explore'))
    // The deck's count is the Supply card's; the press says it in full to a screen reader.
    await expect(table.primary()).toHaveText("Draw 3 · can't be undone")
    await expect(table.primary()).toHaveAccessibleName(
        /^Explore: draw 3 of \d+ writs · can't be undone$/
    )
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights.filter((flight) => flight.startsWith('writs:'))).toHaveLength(3)
    expect(flights).not.toContain('writs: Writ back')
    const writs = table.panel().locator('[data-writs] [data-row]')
    await expect(writs).toHaveCount(3)
    await expect(table.undo()).toHaveCount(0)
    await table.press(writs.last().locator('button').first())
    await expect(table.primaryNamed('Keep 1 · 2 under the deck')).toBeVisible()
    await expect(
        table.primaryNamed("Keep, then Shovels & Swords · 1 iron · draw 2 more · can't be undone")
    ).toBeVisible()
    const under = await table.flightsOf(() =>
        table.press(table.primaryNamed('Keep 1 · 2 under the deck'))
    )
    expect(under.filter((flight) => flight === 'writs: Writ back')).toHaveLength(2)
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-deck-note]')).toHaveAttribute(
        'data-deck-note',
        'you know 2 under the deck'
    )
    await table.closeSeatPanel()

    await table.showSeat('p2')
    const seen = await table.seatPanel('p1')
    await expect(seen.locator('[data-writ-back]')).toHaveCount(1)
    await expect(seen.locator('[data-writ-face]')).toHaveCount(0)
    await expect(seen.locator('[data-deck-note]')).toHaveCount(0)
    await table.closeSeatPanel()
})

scenario('S18 R-4.4.1 Explore: others see three backs', 'cards-explore', async (table) => {
    await table.showSeat('p2')
    const flights = await table.flightsOf(() =>
        table.another('p1', { type: ActionType.Explore, revealsInfo: true })
    )
    expect(flights.filter((flight) => flight.startsWith('writs:'))).toEqual([
        'writs: Writ back',
        'writs: Writ back',
        'writs: Writ back'
    ])
    await expect(table.panel().locator('[data-writs]')).toHaveCount(0)
    await expect(table.waitingLine()).toContainText('Waiting on')
    await expect(table.waitingLine().locator('[data-seat-chip]')).toHaveCount(1)
})

scenario('S19 R-3.10.2 Shovels & Swords', 'cards-explore', async (table) => {
    await table.press(table.card('Explore'))
    await table.press(table.primary())
    const writs = table.panel().locator('[data-writs] [data-row]')
    await table.press(writs.last().locator('button').first())
    await table.press(table.primaryNamed('Keep, then Shovels & Swords'))
    await expect(writs).toHaveCount(2)
    await table.press(writs.last().locator('button').first())
    await expect(table.primary()).toHaveText('Keep 1 · 1 under the deck')
    await table.press(table.primary())
    await expect(table.panel().locator('[data-writs]')).toHaveCount(0)
})

scenario('S20 R-3.11 Harvest with favours', 'cards-harvest-beads', async (table) => {
    await table.press(table.card('Harvest'))
    expect(await table.litChips()).toEqual({ [Desert3]: '9 goods' })
    await table.pressPick(Desert3)
    const favours = table.popup().locator('[data-row="Favours: 6 here, 3 to you"]')
    await expect(favours.locator('button').first()).toContainText('6 here · 3 to you')
    await expect(favours.locator('[data-note="cost"]')).toHaveText('2 beads turn to seals')
    await table.press(table.popupRow('Favours: 6 here, 3 to you'))
    await expect(table.primary()).toHaveText("Favours at Desert 3 · can't be undone")
    const before = await table.seatPanel('p1')
    await expect(before.locator('[data-supply-bead]')).toHaveCount(2)
    await table.closeSeatPanel()
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights.filter((flight) => flight === 'token: good')).toHaveLength(6)
    expect(flights.filter((flight) => /^goods: /.test(flight))).toHaveLength(3)
    expect(flights.filter((flight) => flight === 'seals: bead +2')).toHaveLength(2)
    // One piece per kind on the plate, its badge counting more than one.
    const left = await table.page
        .locator('[data-world^="good:space.desert.3:"]')
        .evaluateAll((pieces) =>
            pieces.map((piece) =>
                Number(piece.querySelector('[data-good-count] text')?.textContent ?? 1)
            )
        )
    expect(left.reduce((sum, count) => sum + count, 0)).toBe(6)
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-supply-bead]')).toHaveCount(0)
    await expect(panel.locator('[data-seals]')).toHaveAttribute('data-seals', '2')
    await table.closeSeatPanel()
})

scenario('S21 R-3.11.3 Inspect the harvest, and take', 'cards-harvest-farmer', async (table) => {
    await table.press(table.card('Harvest'))
    await table.pressPick(Desert3)
    await table.press(table.popupRow('Inspect the harvest'))
    await expect(table.primary()).toHaveText("Inspect the harvest at Desert 3 · can't be undone")
    await table.press(table.primary())
    await expect(table.flowLine().first()).toHaveText('Take 2')
    await expect(table.undo()).toHaveCount(0)
    const goods = table.panel().locator('[data-rows="goods"] [data-row] button')
    await table.press(goods.nth(0))
    await table.press(table.undo())
    await expect(table.undo()).toHaveCount(0)
    await table.press(goods.nth(0))
    await table.press(goods.nth(1))
    await expect(table.primary()).toHaveText('Take 2')
    await table.press(table.primary())
    await expect(table.panel().locator('[data-rows="answer"]')).toHaveCount(0)
})

scenario('S21 R-3.11.3 Inspect the harvest, No favours', 'cards-harvest-farmer', async (table) => {
    await table.press(table.card('Harvest'))
    await table.pressPick(Desert3)
    await table.press(table.popupRow('Inspect the harvest'))
    await table.press(table.primary())
    await table.press(table.rowIn('answer', 'No favours'))
    await expect(table.panel().locator('[data-rows="answer"]')).toHaveCount(0)
})

scenario(
    'S22 R-3.12.1, R-3.12-H1 Tax with Reinforcements, asked',
    'cards-tax-knight',
    async (table) => {
        await table.press(table.card('Tax'))
        // R-X.2 No send until Reinforcements is answered.
        await expect(table.primary()).toHaveCount(0)
        await expect(table.row('Decline Reinforcements')).toHaveText('Skip')
        await table.press(table.rowIn('flow', 'Collect Reinforcements · +1 marker'))
        await expect(table.primary()).toHaveText('Tax · +4s · Reinforcements +1 marker')
        await table.press(table.primary())
        await expect(table.undo()).toBeVisible()
        await expect(table.panel().locator('[data-cards="hand"] [data-row="Tax"]')).toHaveCount(0)
    }
)

scenario('S23 R-3.15 Repeat and Deja Vu', 'cards-repeat', async (table) => {
    await table.press(table.card('Repeat'))
    await expect(table.panel().locator('[data-rows="replays"] [data-row]')).toHaveCount(2)
    const replays = table.panel().locator('[data-rows="replays"]')
    await expect(replays.locator('[data-row="Move"] [data-note]')).toHaveCount(0)
    await expect(replays.locator('[data-row="Explore"] [data-note="cost"]')).toHaveText(
        'Déjà Vu · 1 saltpeter'
    )
    await expect(replays.locator('[data-row="Conquer"]')).toHaveCount(0)
    await expect(replays.locator('[data-row="Defend"]')).toHaveCount(0)
    await table.press(table.rowIn('replays', 'Move'))
    await expect(table.flowLine().first()).toHaveText('1 of 1 steps left')
    // The lone monk's next spaces are its steps and its Godspeed alike: the press asks which.
    expect(await table.litChips()).toEqual({ [Forest3]: 'Godspeed', [Desert3]: 'Godspeed' })
    await table.pressPick(Desert3)
    await table.press(table.popupRow('Step'))
    await table.press(table.row('No Godspeed'))
    await expect(table.primary()).toHaveText('Move · 1 step')
    await table.press(table.primary())
    const panel = await table.seatPanel('p1')
    await expect(playedMark(panel, 'repeat')).toHaveAttribute('data-card-mark', 'replayed Move')
    await table.closeSeatPanel()
})

scenario('S24 R-3.14.1 PlayDefend in turn', 'cards-defend', async (table) => {
    await table.press(table.card('Defend'))
    await expect(table.primary()).toHaveText('Play Defend · +1 vp')
    const before = await table.scoreShown('p1')
    await table.press(table.primary())
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-seat-score]')).toHaveAttribute('data-seat-score', '1')
    await expect(panel.locator('[data-seat-card="defend"][data-card-played]')).toContainText(
        'Defend'
    )
    await table.closeSeatPanel()
    expect(await table.scoreShown('p1')).not.toBe(before)
})
