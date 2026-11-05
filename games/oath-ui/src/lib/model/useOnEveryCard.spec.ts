import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, MachineState, PlayerStatus, PowerTiming, powerIndexOf } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { actionCards } from './actionCards.js'
import { GRAND_SCEPTER, scepterActions } from './cardUses.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ENVOY = 'denizen.nomad.special-envoy'
const PLAYMATES = 'denizen.beast.animal-playmates'
const PRESSGANGS = 'denizen.order.pressgangs'
const WOLVES = 'denizen.beast.wolves'
const BLOOD_PACT = 'denizen.arcane.blood-pact'
const HOSPITALITY = 'denizen.nomad.hospitality'
const WAYSIDE_INN = 'denizen.hearth.wayside-inn'
const TENTS = 'denizen.nomad.tents'
const GARRISON = 'denizen.order.garrison'

const modifier = (cardId: string) => ({
    cardId,
    powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
})
const advisers = (...cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))

type Seat = Parameters<typeof testPlayer>[0]

/**
 * Dana's Act Phase at c1, with Rhys, the Chancellor, at c2; each seat's cards and the cards at
 * Dana's site as the case needs.
 */
function table(
    dana: Partial<Seat>,
    here: string[] = [],
    over: {
        tokens?: Record<string, { favor: number; secrets: number }>
        rhys?: Partial<Seat>
        mara?: Partial<Seat>
        turn?: string
        /** The cards at Rhys's site. */
        there?: string[]
    } = {}
) {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 5,
                favor: 5,
                secrets: 3,
                warbandsOnBoard: { Dana: 6 },
                ...dana
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                supply: 5,
                favor: 6,
                secrets: 2,
                ...over.rhys
            }),
            ...(over.mara
                ? [
                      testPlayer({
                          playerId: 'Mara',
                          color: Color.Yellow,
                          status: PlayerStatus.Exile,
                          siteId: 'p1',
                          ...over.mara
                      })
                  ]
                : [])
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Rhys',
            denizensBySite: { c1: here, c2: over.there ?? [], p1: [], h1: [] },
            cardTokens: over.tokens ?? {},
            discardPileCounts: { cradle: 3, provinces: 3, hinterland: 3 }
        }
    )
    const turn = over.turn ?? 'Dana'
    openTurn(state, turn)
    state.turnManager.turnOrder = [
        turn,
        ...state.players.map((p) => p.playerId).filter((id) => id !== turn)
    ]
    state.activePlayerIds = [turn]
    return state
}

async function sessionAt(state: ReturnType<typeof table>) {
    const session = await openSessionOn(tableOf(state))
    vi.spyOn(session, 'applyAction').mockResolvedValue()
    return session
}

/** At 0 Supply, Wolves already carries a favor; Pressgangs opens it and Animal Playmates pays the Supply. */
const pair = () =>
    table({ supply: 0, favor: 2, advisers: advisers(PLAYMATES, PRESSGANGS) }, [WOLVES], {
        tokens: { [WOLVES]: { favor: 1, secrets: 0 } }
    })

describe('R-7.4 — a Use on every card that changes or opens an action the seat can take now', () => {
    it('a modifier that changes an action wears one, beside an "Action:" power at the site', async () => {
        const session = await sessionAt(table({ advisers: advisers(ENVOY) }, [BLOOD_PACT]))
        expect([...session.useCards].sort()).toEqual([BLOOD_PACT, ENVOY].sort())
    })

    it('a free gain that only adds something after the action wears one: Hospitality on Travel', async () => {
        const state = table({ supply: 3, advisers: advisers(HOSPITALITY) }, [WAYSIDE_INN], {
            there: [TENTS]
        })
        expect(actionCards(state, 'Dana')).toContainEqual(
            expect.objectContaining({
                cardId: HOSPITALITY,
                action: ActionType.Travel,
                kind: 'changes'
            })
        )
        const session = await sessionAt(state)
        expect(session.useCards).toContain(HOSPITALITY)
    })

    it('a card with nothing to change has none: Animal Playmates with no beast at the site', async () => {
        const session = await sessionAt(table({ advisers: advisers(ENVOY, PLAYMATES) }))
        expect(session.useCards).toEqual([ENVOY])
    })

    it("another seat's cards wear none; the seat whose turn it is wears its own", async () => {
        const dana = await sessionAt(
            table({ advisers: advisers(ENVOY) }, [], { rhys: { advisers: advisers(TENTS) } })
        )
        expect(dana.useCards).not.toContain(TENTS)
        disposeSessions()
        const rhys = await sessionAt(
            table({ advisers: advisers(ENVOY) }, [], {
                rhys: { advisers: advisers(TENTS) },
                turn: 'Rhys'
            })
        )
        expect(rhys.useCards).not.toContain(ENVOY)
    })

    it("a modifier's Use opens its action with the card in use; a tap on its row puts it down", async () => {
        const session = await sessionAt(table({ advisers: advisers(ENVOY) }))
        session.useCard(ENVOY)
        expect(session.selection.action).toBe(ActionType.Travel)
        expect(session.modifiers.isDeclared(modifier(ENVOY))).toBe(true)
        session.modifiers.declare(modifier(ENVOY), false)
        expect(session.modifiers.isDeclared(modifier(ENVOY))).toBe(false)
        expect(session.selection.action).toBe(ActionType.Travel)
    })

    it('a pair wears a Use on both cards; either opens the action with both in use, neither put down', async () => {
        for (const tapped of [PLAYMATES, PRESSGANGS]) {
            const session = await sessionAt(pair())
            expect([...session.useCards].sort()).toEqual([PLAYMATES, PRESSGANGS].sort())
            session.useCard(tapped)
            expect(session.selection.action).toBe(ActionType.Muster)
            session.modifiers.declare(modifier(PLAYMATES), false)
            session.modifiers.declare(modifier(PRESSGANGS), false)
            expect(session.modifiers.isDeclared(modifier(PLAYMATES))).toBe(true)
            expect(session.modifiers.isDeclared(modifier(PRESSGANGS))).toBe(true)
            disposeSessions()
        }
    })

    it('an "Action:" power\'s Use opens Use a power on that card alone', async () => {
        const session = await sessionAt(table({ advisers: advisers(ENVOY) }, [BLOOD_PACT]))
        session.useCard(BLOOD_PACT)
        expect(session.selection.action).toBe(ActionType.UseActionPower)
        expect(session.actionPowers.card).toBe(BLOOD_PACT)
        expect(session.actionPowers.powers.map((power) => power.cardId)).toEqual([BLOOD_PACT])
    })

    it('every Use hides while an action is open, Use a power included', async () => {
        const session = await sessionAt(table({ advisers: advisers(ENVOY) }, [BLOOD_PACT]))
        session.useCard(BLOOD_PACT)
        expect(session.useCards).toEqual([])
        session.resetAction()
        session.useCard(ENVOY)
        expect(session.useCards).toEqual([])
        session.resetAction()
        session.chooseAction(ActionType.Trade)
        expect(session.useCards).toEqual([])
    })

    it("Undo after a modifier's Use returns to the grid with every Use as before", async () => {
        const session = await sessionAt(table({ advisers: advisers(ENVOY) }, [BLOOD_PACT]))
        const all = [...session.useCards].sort()
        session.useCard(ENVOY)
        await session.undo()
        expect(session.selection.action).toBeUndefined()
        expect([...session.useCards].sort()).toEqual(all)
    })

    it("Undo after a pair's Use returns to the grid, though the action's tile is dimmed", async () => {
        const session = await sessionAt(pair())
        session.useCard(PRESSGANGS)
        await session.undo()
        expect(session.selection.action).toBeUndefined()
    })

    it('a card with no Use opens nothing', async () => {
        const session = await sessionAt(table({ advisers: advisers(PLAYMATES) }))
        session.useCard(PLAYMATES)
        expect(session.selection.action).toBeUndefined()
    })

    it('outside the Act Phase, or while a free action is due, there is none', async () => {
        const rest = table({ advisers: advisers(ENVOY) }, [BLOOD_PACT])
        rest.machineState = MachineState.RestPhase
        expect((await sessionAt(rest)).useCards).toEqual([])
        disposeSessions()
        const due = table({ advisers: advisers(ENVOY), freeTravelAtAction: 0 }, [BLOOD_PACT])
        expect((await sessionAt(due)).useCards).toEqual([])
    })
})

describe('R-6.6.1, R-6.7, R-6.8 — the Grand Scepter wears one Use that opens a choice of its two', () => {
    /** Rhys, the Chancellor, holds the Scepter from setup; Mara is a Citizen and Dana an Exile. */
    const scepter = () =>
        table({}, [], {
            rhys: { relicIds: [GRAND_SCEPTER], advisers: advisers(GARRISON) },
            mara: { status: PlayerStatus.Citizen },
            turn: 'Rhys'
        })

    it('the Use opens Use a power on the Scepter, offering Offer Citizenship and Exile Citizen', async () => {
        const session = await sessionAt(scepter())
        expect(session.validActionTypes).toEqual(
            expect.arrayContaining([ActionType.OfferCitizenship, ActionType.ExileCitizen])
        )
        expect(session.useCards).toContain(GRAND_SCEPTER)
        session.useCard(GRAND_SCEPTER)
        expect(session.selection.action).toBe(ActionType.UseActionPower)
        expect(session.actionPowers.card).toBe(GRAND_SCEPTER)
        expect(scepterActions(session.validActionTypes)).toEqual([
            ActionType.OfferCitizenship,
            ActionType.ExileCitizen
        ])
        session.chooseAction(ActionType.ExileCitizen)
        expect(session.selection.action).toBe(ActionType.ExileCitizen)
        expect(session.selection.value('powerCard')).toBeUndefined()
    })

    it('one Undo from the choice returns to the grid', async () => {
        const session = await sessionAt(scepter())
        session.useCard(GRAND_SCEPTER)
        await session.undo()
        expect(session.selection.action).toBeUndefined()
        expect(session.useCards).toContain(GRAND_SCEPTER)
    })

    it('a Scepter taken this turn has none', async () => {
        const state = scepter()
        state.grandScepterTakenOnTurnStart = state.turnManager.currentTurn()?.start
        state.grandScepterTakenBy = ['Rhys']
        const session = await sessionAt(state)
        expect(session.validActionTypes).not.toContain(ActionType.OfferCitizenship)
        expect(session.useCards).not.toContain(GRAND_SCEPTER)
    })
})

describe('R-7.4 — a card that would make a dimmed action possible wears the ring on its Use', () => {
    it("both Uses of the pair are ringed while Muster's reason shows, and the ring clears with it", async () => {
        const session = await sessionAt(pair())
        expect(session.ringedUses).toEqual([])
        session.tapGridMajor(ActionType.Muster, 'reason-1')
        expect(session.refusedGridMajor).toBe(ActionType.Muster)
        expect([...session.ringedUses].sort()).toEqual([PLAYMATES, PRESSGANGS].sort())
        expect(session.useRingReason).toBe('reason-1')
        // A hover on another tile replaces the tapped reason: Trade's, which no card helps.
        session.hoverGridTile(ActionType.Trade, true, 'reason-1')
        expect(session.refusedGridMajor).toBe(ActionType.Trade)
        expect(session.ringedUses).toEqual([])
        expect(session.useRingReason).toBeUndefined()
    })

    it('a hovered dimmed major rings while the pointer is on it; a tapped one holds after it leaves', async () => {
        const session = await sessionAt(pair())
        session.hoverGridTile(ActionType.Muster, true, 'reason-1')
        expect([...session.ringedUses].sort()).toEqual([PLAYMATES, PRESSGANGS].sort())
        session.hoverGridTile(ActionType.Muster, false, 'reason-1')
        expect(session.ringedUses).toEqual([])

        session.hoverGridTile(ActionType.Muster, true, 'reason-1')
        session.tapGridMajor(ActionType.Muster, 'reason-1')
        session.hoverGridTile(ActionType.Muster, false, 'reason-1')
        expect(session.refusedGridMajor).toBe(ActionType.Muster)
        expect([...session.ringedUses].sort()).toEqual([PLAYMATES, PRESSGANGS].sort())
    })

    it('an action opened from a ringed Use ends the reason and the ring with the grid', async () => {
        const session = await sessionAt(pair())
        session.hoverGridTile(ActionType.Muster, true, 'reason-1')
        session.tapGridMajor(ActionType.Muster, 'reason-1')
        session.useCard(PRESSGANGS)
        expect(session.selection.action).toBe(ActionType.Muster)
        expect(session.refusedGridMajor).toBeUndefined()
        expect(session.hoveredGridAction).toBeUndefined()
    })

    it('an action no card makes possible rings none', async () => {
        const session = await sessionAt(pair())
        session.tapGridMajor(ActionType.Trade, 'reason-1')
        expect(session.ringedUses).toEqual([])
    })
})
