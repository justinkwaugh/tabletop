import { expect, type Locator } from '@playwright/test'
import { openFixture, scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's Conquer and Starve scenarios, on the real table at both widths. */

const AnaKnight = 'pawn:p1:1'
const AnaFeudum = 'feudum:space.forest.2'
const BramSerf = 'marker:space.forest.2:p2:serf'
const SerfWorld = '[data-world="marker:space.forest.2:serf"]'
const RulerWorld = '[data-world="marker:space.forest.2:ruler"]'
const DiscWorld = '[data-world="disc:space.forest.2"]'
const Flip = "Flip Defend · +1 defence · +1 vp · can't be undone"
const LetStand = "Let it stand · can't be undone"
const RoyalImmunity = "Royal Immunity · 1 food · can't be undone"
const LetGo = "Let it go · can't be undone"
const Sword = 'Use sword for free: +1 attack'

const answer = (table: ScenarioTable, label: string) =>
    table.panel().getByRole('button', { name: label, exact: true })

const addSaltpeter = (table: ScenarioTable) =>
    table.panel().getByRole('button', { name: 'Add saltpeter' })

const tallyTotal = (table: ScenarioTable): Locator =>
    table.panel().locator('[data-combat-tally] tbody tr').filter({ hasText: 'total' }).locator('td')

/** The seat's panel, as another seat's browser shows it: what it may see of a hand. */
async function defendCardsSeen(table: ScenarioTable, of: string): Promise<number> {
    const panel = await table.seatPanel(of)
    const seen = await panel.locator('[data-seat-card="defend"]').count()
    await table.closeSeatPanel()
    return seen
}

const scoreOf = async (table: ScenarioTable, of: string): Promise<string | null> => {
    const panel = await table.seatPanel(of)
    const score = await panel.locator('[data-seat-score]').getAttribute('data-seat-score')
    await table.closeSeatPanel()
    return score
}

scenario('S32 R-3.14.1 Conquer that asks', 'conquer-asks', async (table) => {
    await table.press(table.card('Conquer'))
    await expect(table.chip(AnaKnight)).toHaveText('3 vs 2')
    await table.pressPick(AnaKnight)
    await expect(table.primary()).toHaveText("Conquer Ana's knight · can't be undone")
    await expect(table.primary()).toHaveAccessibleName(
        "Conquer Ana's knight · Ana may answer · can't be undone"
    )
    await table.press(table.primary())
    expect(await table.activeSeats()).toEqual(['p1'])
    await expect(table.waitingLine()).toHaveText('Waiting on Ana.')
    await expect(table.undo()).toHaveCount(0)
    await expect(answer(table, Flip)).toHaveCount(0)

    await table.showSeat('p3')
    await expect(table.waitingLine()).toHaveText('Waiting on Ana.')
    await expect(table.undo()).toHaveCount(0)
    await expect(table.panel().getByRole('button')).toHaveCount(0)

    await table.showSeat('p1')
    await expect(answer(table, Flip)).toBeVisible()
    await expect(table.waitingLine()).toHaveCount(0)
})

scenario('S33 R-3.14.1 Defender with Defend', 'conquer-asked-defend', async (table) => {
    await expect(table.flowLine().first()).toHaveText(
        'Bram conquers your knight at Forest 2: 3 vs 2'
    )
    await expect(answer(table, Flip)).toBeVisible()
    await expect(answer(table, LetStand)).toBeVisible()
    await expect(tallyTotal(table)).toHaveText(['total', '3', '2'])

    await table.showSeat('p2')
    expect(await defendCardsSeen(table, 'p1')).toBe(0)
    await expect(table.panel()).not.toContainText('Flip Defend')
    await table.showSeat('p3')
    expect(await defendCardsSeen(table, 'p1')).toBe(0)
    await expect(table.panel()).not.toContainText('Flip Defend')

    await table.showSeat('p1')
    const scoreBefore = Number(await scoreOf(table, 'p1'))
    await table.press(answer(table, Flip))
    await expect(tallyTotal(table)).toHaveText(['total', '3', '3'])
    const own = await table.seatPanel('p1')
    await expect(own.locator('[data-seat-card="defend"][data-card-played]')).toHaveCount(1)
    await table.closeSeatPanel()
    expect(Number(await scoreOf(table, 'p1'))).toBe(scoreBefore + 1)

    await table.showSeat('p3')
    expect(await defendCardsSeen(table, 'p1')).toBe(1)

    await table.showSeat('p2')
    expect(await table.activeSeats()).toEqual(['p2'])
    await expect(tallyTotal(table)).toHaveText(['total', '3', '3'])
    await expect(addSaltpeter(table)).toBeVisible()
    await expect(table.primary()).toHaveText('Attack 3 vs 3: fails')
})

scenario(
    "S33 R-4.8-H5 Defender with Defend: an attacker who can't add resolves at once",
    'conquer-asked-defend-nothing-to-add',
    async (table) => {
        const scoreBefore = Number(await scoreOf(table, 'p1'))
        await table.press(answer(table, Flip))
        expect(await table.activeSeats()).not.toContain('p1')
        await expect(table.panel().locator('[data-combat-tally]')).toHaveCount(0)
        await table.showSeat('p2')
        await expect(table.panel().locator('[data-combat-tally]')).toHaveCount(0)
        await expect(addSaltpeter(table)).toHaveCount(0)
        await expect(table.page.locator('[data-world="pawn:p1:1"]')).toHaveCount(1)
        expect(Number(await scoreOf(table, 'p1'))).toBe(scoreBefore + 1)
    }
)

/** The page as a seat that isn't asked sees it: the whole of the markup, and the action area. */
async function outwardView(table: ScenarioTable, playerId: string) {
    await table.showSeat(playerId)
    await table.page.evaluate(() => document.fonts.ready)
    return {
        markup: await table.page.locator('div[data-game-ui]').innerHTML(),
        panel: await table.panel().screenshot({ animations: 'disabled' })
    }
}

scenario('S34 R-3.14.1 Defender without Defend', 'conquer-asked-no-defend', async (table) => {
    await expect(table.panel().locator('[data-note-line]')).toHaveCount(0)
    await expect(answer(table, Flip)).toHaveCount(0)
    await expect(answer(table, LetStand)).toBeVisible()
    await table.settled()
    expect(await table.activeSeats()).toEqual(['p1'])

    const without = {
        attacker: await outwardView(table, 'p2'),
        third: await outwardView(table, 'p3')
    }
    await table.showSeat('p1')
    await table.press(answer(table, LetStand))
    expect(await table.activeSeats()).toEqual(['p2'])

    await openFixture(table.page, 'conquer-asked-defend')
    const attacker = await outwardView(table, 'p2')
    const third = await outwardView(table, 'p3')
    expect(attacker.markup).toBe(without.attacker.markup)
    expect(third.markup).toBe(without.third.markup)
    expect(attacker.panel.equals(without.attacker.panel)).toBe(true)
    expect(third.panel.equals(without.third.panel)).toBe(true)
})

scenario('S35 R-3.14.1 Conquer that does not ask', 'conquer-no-ask', async (table) => {
    await table.press(table.card('Conquer'))
    await expect(table.chip(AnaKnight)).toHaveText('3 vs 2')
    await table.pressPick(AnaKnight)
    await expect(table.panel()).toContainText('Add to the attack')
    await expect(addSaltpeter(table)).toBeVisible()
    await expect(table.panel()).not.toContainText("can't be undone")
    await expect(table.primary()).toHaveText('Attack 3 vs 2: wins · +2 vp')
    await expect(table.undo()).toBeVisible()
    await table.press(table.undo())
    await expect(table.card('Conquer')).toBeVisible()
    await expect(table.panel().locator('[data-combat-tally]')).toHaveCount(0)
})

scenario('S36 R-4.8.2 CommitAttack', 'conquer-commit', async (table) => {
    await expect(tallyTotal(table)).toHaveText(['total', '3', '3'])
    await table.press(addSaltpeter(table))
    await expect(tallyTotal(table)).toHaveText(['total', '4', '3'])
    await table.press(table.row(Sword))
    await expect(tallyTotal(table)).toHaveText(['total', '5', '3'])
    await expect(table.primary()).toHaveText('Attack 5 vs 3: wins · +2 vp')

    await table.showSeat('p3')
    await expect(tallyTotal(table)).toHaveText(['total', '3', '3'])
    await expect(table.panel()).not.toContainText('sword')
    await table.showSeat('p2')

    await table.press(table.undo())
    await expect(tallyTotal(table)).toHaveText(['total', '4', '3'])
    await table.press(table.undo())
    await expect(tallyTotal(table)).toHaveText(['total', '3', '3'])

    await table.press(addSaltpeter(table))
    await table.press(table.row(Sword))
    const scoreBefore = Number(await scoreOf(table, 'p2'))
    const scoreMotion = await table.scoreMotion('p2')
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(
        expect.arrayContaining(["pawns: Ana's knight pawn", scoreMotion, 'goods: saltpeter'])
    )
    await table.settled()
    await expect(table.page.locator('[data-world="pawn:p1:1"]')).toHaveCount(0)
    expect(Number(await scoreOf(table, 'p2'))).toBe(scoreBefore + 2)
    await expect(table.panel()).toContainText('Service disc?')
})

scenario('S37 R-4.8.3 Feudum conquest', 'conquer-feudum', async (table) => {
    const disc = table.page.locator(DiscWorld)
    const ruler = table.page.locator(RulerWorld).locator('svg[aria-label]')
    const feudum = await disc.innerHTML()
    await expect(ruler).toHaveAttribute('aria-label', "Ana's influence marker")
    await expect(table.page.locator(SerfWorld).locator('svg[aria-label]')).toHaveAttribute(
        'aria-label',
        "Bram's influence marker"
    )
    await table.press(table.card('Conquer'))
    await table.pressPick(AnaFeudum)
    await table.press(table.primary())
    await table.showSeat('p1')
    await table.press(answer(table, LetStand))
    await table.showSeat('p2')
    await table.press(addSaltpeter(table))
    await expect(table.primary()).toHaveText('Attack 5 vs 4: wins · +4 vp')
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(
        expect.arrayContaining([
            'board: disc:space.forest.2',
            'board: marker:space.forest.2:ruler',
            "markers: Ana's influence marker"
        ])
    )
    await table.settled()
    expect(await disc.innerHTML()).not.toBe(feudum)
    await expect(table.page.locator(SerfWorld)).toHaveCount(0)
    await expect(ruler).toHaveAttribute('aria-label', "Bram's influence marker")
    await table.press(table.page.getByRole('tab', { name: 'History' }))
    const logged = await table.page
        .locator('[data-action-line]')
        .evaluateAll((lines) => lines.map((line) => line.getAttribute('data-action-line')))
    expect(logged).toContain(
        'You added 1 saltpeter · attack 5, defence 4: the attack won · +4 vp · the feudum at Forest 2 fell to an outpost · markers home: Ana 1 · You became ruler of the outpost · You became Knight master; Ana dropped to journeyman'
    )
})

scenario('S38 R-3.14.2 Starve with Royal Immunity', 'starve-asks', async (table) => {
    await table.press(table.card('Conquer'))
    await table.press(table.row('Starve the People'))
    await expect(table.pick(BramSerf).locator('[data-chip]')).toHaveText('starve')
    await table.pressPick(BramSerf)
    await expect(table.primary()).toHaveText("Starve Bram's serf · can't be undone")
    await expect(table.primary()).toHaveAccessibleName(
        "Starve Bram's serf · Bram may answer · can't be undone"
    )
    await table.press(table.primary())
    expect(await table.activeSeats()).toEqual(['p2'])
    await expect(answer(table, RoyalImmunity)).toHaveCount(0)
    expect(await defendCardsSeen(table, 'p2')).toBe(0)

    await table.showSeat('p3')
    await expect(answer(table, RoyalImmunity)).toHaveCount(0)
    expect(await defendCardsSeen(table, 'p2')).toBe(0)

    await table.showSeat('p2')
    await expect(answer(table, LetGo)).toBeVisible()
    const food = await table.goodsHeld('p2', 'food')
    const flights = await table.flightsOf(() => table.press(answer(table, RoyalImmunity)))
    expect(flights).toEqual(['goods: food', 'token: seal'])
    await table.settled()
    await expect(table.page.locator(SerfWorld)).toHaveCount(1)
    await expect(table.page.locator(SerfWorld).locator('[data-immune]')).toHaveCount(1)
    expect(await table.goodsHeld('p2', 'food')).toBe(food - 1)
    await table.showSeat('p1')
    await expect(table.page.locator(SerfWorld).locator('[data-immune]')).toHaveCount(1)
})

scenario(
    'S38 R-3.14.2 A sealed marker is unlit for later starves',
    'starve-sealed',
    async (table) => {
        await table.press(table.card('Conquer'))
        await table.press(table.row('Starve the People'))
        expect(await table.litChips()).toEqual({ 'marker:space.forest.3:p2:serf': 'starve' })
        await expect(table.pick(BramSerf)).toHaveAttribute('data-pick-role', 'dimmed')
    }
)

async function sealsHeld(table: ScenarioTable): Promise<number> {
    const panel = await table.seatPanel('p2')
    const seals = panel.locator('[data-seals]')
    const held = (await seals.count()) > 0 ? await seals.getAttribute('data-seals') : '0'
    await table.closeSeatPanel()
    return Number(held)
}

scenario('S39 R-3.14.2 Reclaim the seal', 'starve-reclaim', async (table) => {
    await expect(table.page.locator(SerfWorld).locator('[data-immune]')).toHaveCount(1)
    expect(await sealsHeld(table)).toBe(0)
    await table.press(table.row('Immunity 1'))
    expect(await table.litChips()).toEqual({ [BramSerf]: '' })
    const flights = await table.flightsOf(() => table.pressPick(BramSerf))
    expect(flights).toContain("seals: king's seal")
    await table.settled()
    await expect(table.page.locator(SerfWorld).locator('[data-immune]')).toHaveCount(0)
    await expect(table.row('Immunity 1')).toHaveCount(0)
    expect(await sealsHeld(table)).toBe(1)
})
