import { afterEach, describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    ActionType,
    HydratedOathGameState,
    HydratedUseActionPower,
    MachineState,
    OathVisibility,
    PlayerStatus,
    PowerTiming,
    Suit,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { cardsWithListedPower, listedActionPowers } from './phaseDrafts.js'
import { emptyPicks } from './powerChoices.js'

afterEach(() => {
    disposeSessions()
})

const RHYS = 'rhys'
const DANA = 'dana'
const ORACLE = 'denizen.nomad.oracle'
const ALCHEMIST = 'denizen.arcane.alchemist'
const ALCHEMIST_USE = { cardId: ALCHEMIST, powerIndex: powerIndexOf(ALCHEMIST, PowerTiming.Action) }
const BIRDSONG = 'denizen.beast.birdsong'
const IVORY_EYE = 'relic.ivory-eye'
const TUTOR = 'denizen.arcane.tutor'

const BANKS: Record<Suit, number> = {
    [Suit.Discord]: 2,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 3,
    [Suit.Beast]: 1,
    [Suit.Nomad]: 0
}

/**
 * Rhys, an Exile, stands with Oracle at the first Cradle site, holds Alchemist and Birdsong as advisers and
 * the Ivory Eye, with 2 secrets to pay for either; Dana, the Chancellor, holds Tutor facedown
 * unless `facedown` is false, and the fixture's own sites are all faceup with no relic at any.
 */
function table(
    over: { machineState?: MachineState; facedown?: boolean; freeTravelAtAction?: number } = {}
) {
    const { machineState = MachineState.ActPhase, facedown = true, freeTravelAtAction } = over
    const state = testState(
        [
            testPlayer({
                playerId: RHYS,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 5,
                advisers: [
                    { cardId: ALCHEMIST, faceUp: true },
                    { cardId: BIRDSONG, faceUp: true }
                ],
                relicIds: [IVORY_EYE],
                ...(freeTravelAtAction === undefined ? {} : { freeTravelAtAction })
            }),
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                advisers: facedown ? [{ cardId: TUTOR, faceUp: false }] : []
            })
        ],
        {
            machineState,
            chancellorPlayerId: DANA,
            favorBank: BANKS,
            denizensBySite: { c1: [ORACLE], c2: [], h1: [] }
        }
    )
    openTurn(state, RHYS)
    state.turnManager.turnOrder = [RHYS, DANA]
    return state
}

const sorted = (ids: readonly string[]) => [...ids].sort()

/** R-6.2, R-7.3.2 — a "Use" badge on each card whose "Action:" power Use a power lists now. */
describe('the Use badge on a card', () => {
    it('each card Use a power lists carries one: a card at the site, an adviser and a relic', async () => {
        const session = await openSessionOn(tableOf(table()))
        const listed = listedActionPowers(session.gameState, RHYS).map((use) => use.cardId)
        expect(sorted(listed)).toEqual(sorted([ORACLE, ALCHEMIST, IVORY_EYE]))
        expect(sorted(session.powerBadgeCards)).toEqual(sorted([ORACLE, ALCHEMIST, IVORY_EYE]))
        expect(session.powerBadgeCards).not.toContain(BIRDSONG)
        expect(session.powerBadgeCards).not.toContain(TUTOR)
    })

    it('a power the engine allows with nothing it can pick has none: the Ivory Eye with nothing facedown', async () => {
        const session = await openSessionOn(tableOf(table({ facedown: false })))
        const legal = HydratedUseActionPower.legalActionPowers(session.gameState, RHYS)
        expect(legal.map((use) => use.cardId)).toContain(IVORY_EYE)
        expect(sorted(session.powerBadgeCards)).toEqual(sorted([ORACLE, ALCHEMIST]))
    })

    it('outside the seat’s Act Phase there is none', async () => {
        const session = await openSessionOn(
            tableOf(table({ machineState: MachineState.RestPhase }))
        )
        expect(listedActionPowers(session.gameState, RHYS)).not.toEqual([])
        expect(session.powerBadgeCards).toEqual([])
    })

    it('while a free action is due there is none, as Use a power is not offered', async () => {
        const session = await openSessionOn(tableOf(table({ freeTravelAtAction: 0 })))
        expect(session.validActionTypes).not.toContain(ActionType.UseActionPower)
        expect(listedActionPowers(session.gameState, RHYS)).not.toEqual([])
        expect(session.powerBadgeCards).toEqual([])
    })

    it('with another action staged there is none; with Use a power open they stay', async () => {
        const session = await openSessionOn(tableOf(table()))
        const all = sorted(session.powerBadgeCards)
        expect(all).toHaveLength(3)
        session.chooseAction(ActionType.Trade)
        expect(session.powerBadgeCards).toEqual([])
        session.resetAction()
        session.chooseAction(ActionType.UseActionPower)
        expect(sorted(session.powerBadgeCards)).toEqual(all)
    })

    it('a badge opens Use a power on its card alone; one Undo returns to the grid with the badges as before', async () => {
        const session = await openSessionOn(tableOf(table()))
        const all = sorted(session.powerBadgeCards)
        session.openCardPower(ORACLE)
        expect(session.selection.action).toBe(ActionType.UseActionPower)
        expect(session.actionPowers.card).toBe(ORACLE)
        expect(session.actionPowers.powers.map((power) => power.cardId)).toEqual([ORACLE])
        expect(sorted(session.powerBadgeCards)).toEqual(all)

        // Another card's badge, with the panel open, opens that card's power instead, with no picks.
        session.openCardPower(ALCHEMIST)
        session.actionPowers.setPicks(ALCHEMIST_USE, { ...emptyPicks(), count: [1] })
        expect(session.hasManualDraft).toBe(true)
        session.openCardPower(IVORY_EYE)
        expect(session.actionPowers.powers.map((power) => power.cardId)).toEqual([IVORY_EYE])
        expect(session.actionPowers.picksOf(ALCHEMIST_USE)).toEqual(emptyPicks())

        await session.undo()
        expect(session.selection.action).toBeUndefined()
        expect(session.hasManualDraft).toBe(false)
        expect(sorted(session.powerBadgeCards)).toEqual(all)

        // The chip lists every power again.
        session.chooseAction(ActionType.UseActionPower)
        expect(session.actionPowers.card).toBeUndefined()
        expect(sorted(session.actionPowers.powers.map((power) => power.cardId))).toEqual(all)
    })

    it('a card with no badge opens nothing', async () => {
        const session = await openSessionOn(tableOf(table()))
        session.openCardPower(BIRDSONG)
        expect(session.selection.action).toBeUndefined()
    })

    it("reads the same on Rhys's own view as on the table, nothing hidden read", () => {
        const me: Visibility.Perspective = { kind: 'player', playerId: RHYS }
        const own = (state: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(state, me)), me)
        for (const state of [table(), table({ facedown: false })]) {
            expect(cardsWithListedPower(own(state), RHYS)).toEqual(
                cardsWithListedPower(state, RHYS)
            )
        }
        expect(cardsWithListedPower(own(table()), RHYS)).toContain(IVORY_EYE)
    })
})
