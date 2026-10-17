import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, assert, createAction } from '@tabletop/common'
import {
    ActionType,
    AnswerQuestion,
    PowerQuestionKind,
    Suit,
    Travel,
    isTravel,
    type QuestionAnswer
} from '@tabletop/oath'
import { disposeSessions, openSessionOn, played, tableOf, type PlayedTable } from '$lib/testing/sessionHarness.js'
import {
    HOSPITALITY,
    TENTS,
    WOOD_SLOTS,
    travelCard,
    woodCardsState,
    woodHospitalityState
} from '$lib/testing/woodCardsTable.js'
import { ACTION_CARD_LINES } from './actionCards.js'
import { describeAction, rowActorOf } from './actionDescription.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const { wood, greatSlum, river, mountain } = WOOD_SLOTS
const declaredHospitality = { ...travelCard(HOSPITALITY), choices: [] }

type Session = ReturnType<typeof openSessionOn>

function travellerSession(table: PlayedTable): Session {
    const session = openSessionOn(table)
    session.chooseAction(ActionType.Travel)
    return session
}

const listedCards = (session: Session) => session.modifiers.listed.map((power) => power.cardId).sort()

async function sentModifiers(session: Session) {
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    await session.travelFromShroudedWood()
    const action = sent.mock.calls[0]?.[0]
    assert(action && isTravel(action), 'the Travel is sent')
    return action.modifiers
}

/** Dana sets out with Hospitality; Bea picks `siteId`; then each answer in `then`. */
function playedTo(siteId: string, then: { playerId: string; answer: QuestionAnswer }[] = []): PlayedTable {
    const table = tableOf(woodHospitalityState())
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    return played(table, [
        createAction(Travel, { ...envelope, playerId: 'Dana', modifiers: [declaredHospitality] }),
        createAction(AnswerQuestion, { ...envelope, playerId: 'Bea', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId } }),
        ...then.map(({ playerId, answer }) => createAction(AnswerQuestion, { ...envelope, playerId, answer }))
    ])
}

describe('R-11.7-H2 — Hospitality in the Wood’s Travel panel', () => {
    it('listed with the other Travel cards and today’s "+1 favor" line, in use from the start, no bank named', () => {
        const session = travellerSession(tableOf(woodHospitalityState()))
        expect(session.shroudedWoodChooser).toBe('Bea')
        expect(listedCards(session)).toContain(HOSPITALITY)
        expect(session.modifiers.isDeclared(travelCard(HOSPITALITY))).toBe(true)
        expect(ACTION_CARD_LINES[HOSPITALITY]).toBe('+1 favor')
        // It changes no price: the picks are those of a Travel without it.
        expect(session.woodRegions?.every((region) => region.foldedBy.length === 0)).toBe(true)
        expect(session.woodTravelReason).toBeUndefined()
    })

    it('sent with no bank; put down, it is not sent, and it can be put back', async () => {
        expect(await sentModifiers(travellerSession(tableOf(woodHospitalityState())))).toEqual([declaredHospitality])
        const down = travellerSession(tableOf(woodHospitalityState()))
        down.modifiers.declare(travelCard(HOSPITALITY), false)
        expect(listedCards(down)).toContain(HOSPITALITY)
        expect(down.woodTravelCards).toEqual([])
        down.modifiers.declare(travelCard(HOSPITALITY), true)
        expect(down.woodTravelCards).toEqual([declaredHospitality])
    })

    it('not listed or sent where no pick could give its favor (no Nomad card on the map, no other adviser)', async () => {
        const state = woodCardsState({ advisers: [HOSPITALITY] })
        state.denizensBySite = { ...state.denizensBySite, [greatSlum]: [] }
        const session = travellerSession(tableOf(state))
        expect(listedCards(session)).not.toContain(HOSPITALITY)
        expect(await sentModifiers(session)).toEqual([])
    })

    it('listed beside Tents, and sent with it', async () => {
        const state = woodHospitalityState()
        state.getPlayerState('Dana').advisers = [...state.getPlayerState('Dana').advisers, { cardId: TENTS, faceUp: true }]
        const session = travellerSession(tableOf(state))
        session.modifiers.declare(travelCard(TENTS), true)
        expect(listedCards(session)).toEqual(expect.arrayContaining([HOSPITALITY, TENTS]))
        expect(await sentModifiers(session)).toEqual([declaredHospitality, travelCard(TENTS)])
    })
})

describe('R-11.7-H2 — the bank question after Bea’s pick', () => {
    it('two banks at the River: Dana is asked, one button per bank; a tap sends that bank', async () => {
        const session = openSessionOn(playedTo(river))
        expect(session.question.mine).toMatchObject({ kind: PowerQuestionKind.HospitalityBank, askedPlayerId: 'Dana', banks: [Suit.Order, Suit.Nomad] })
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        await session.question.gainHospitalityFavor(Suit.Nomad)
        expect(sent.mock.calls[0]?.[0]).toMatchObject({ type: ActionType.AnswerQuestion, playerId: 'Dana', answer: { kind: PowerQuestionKind.HospitalityBank, suit: Suit.Nomad } })
    })

    it('one bank at the Mountain (Captains, Order): gained with no question', () => {
        const session = openSessionOn(playedTo(mountain))
        expect(session.question.open).toBeUndefined()
        expect(session.gameState.getPlayerState('Dana').favor).toBe(3)
    })
})

describe('R-11.7-H2 — the History of Hospitality out of the Wood', () => {
    const SITES: Record<string, string> = { [wood]: 'Shrouded Wood', [river]: 'River', [mountain]: 'Mountain' }
    const names = { player: (playerId: string) => playerId, site: (slotId: string) => SITES[slotId] ?? slotId, seats: ['Dana', 'Bea', 'Ann'] }

    it('two banks: the set-out row, the pick row, then Dana’s gain in today’s words', () => {
        const { actions } = playedTo(river, [{ playerId: 'Dana', answer: { kind: PowerQuestionKind.HospitalityBank, suit: Suit.Order } }])
        expect(actions.map((action) => [rowActorOf(action), describeAction(action, names, 'Ann')])).toEqual([
            ['Dana', 'set out from Shrouded Wood (Hospitality); Bea picks where'],
            ['Dana', "traveled from Shrouded Wood to River (Bea's pick), spending 2 Supply"],
            ['Dana', 'gained 1 favor from the Order bank (Hospitality)']
        ])
    })

    it('one bank: the gain closes the pick row, as on any Travel', () => {
        const { actions } = playedTo(mountain)
        expect(describeAction(actions[1], names, 'Ann')).toBe("traveled from Shrouded Wood to Mountain (Bea's pick), spending 2 Supply; gained 1 favor from the Order bank (Hospitality)")
    })

    it('no bank: the pick row says nothing more', () => {
        const { actions } = playedTo(WOOD_SLOTS.wastes)
        expect(describeAction(actions[1], { ...names, site: (slotId: string) => (slotId === WOOD_SLOTS.wastes ? 'Wastes' : (SITES[slotId] ?? slotId)) }, 'Ann')).toBe(
            "traveled from Shrouded Wood to Wastes (Bea's pick), spending 2 Supply"
        )
    })
})
