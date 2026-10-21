import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert, type GameAction } from '@tabletop/common'
import { ActionType, CURRENT_OATH_REVISION, MachineState, PowerQuestionKind, Suit, isTravel, type TravelFlip } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import {
    HOSPITALITY,
    PORTAL,
    WAY_STATION,
    WOOD_SLOTS,
    travelCard,
    woodCardsState,
    woodPortalBanksState
} from '$lib/testing/woodCardsTable.js'
import { chipWords, travelChip } from './travelOnTheMap.js'
import { waysToShow, type TravelChoice } from './travelRows.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const { greatSlum } = WOOD_SLOTS
const SECOND_WIND = 'denizen.discord.second-wind'

type Session = Awaited<ReturnType<typeof openSessionOn>>

async function travelling(state: Parameters<typeof tableOf>[0]) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Travel)
    return { session, sent }
}

/** Dana at Bea's Wood puts the Portal there in use: every site is 0 Supply, and Way Station's Great Slum also offers its favor way. */
async function throughThePortal(state = woodCardsState()) {
    const travel = await travelling(state)
    travel.session.modifiers.declare(travelCard(PORTAL), true)
    return travel
}

const waysAt = (session: Session, slotId: string): TravelChoice[] =>
    session.travelRows.find((row) => row.slotId === slotId)?.ways ?? []

/** The chip the map draws on a lit site, from the same offer the map reads. */
function chipAt(session: Session, slotId: string) {
    const offer = session.siteOffers.find((o) => o.slotId === slotId)
    assert(offer?.intent === 'travel', `${slotId} is lit for the Travel`)
    return travelChip(offer.ways)
}

function sentTravel(sent: { mock: { calls: [GameAction][] } }) {
    const action = sent.mock.calls[0]?.[0]
    assert(action !== undefined && isTravel(action), 'a Travel is sent')
    return action
}

const payment = (way: TravelChoice) => [way.cost, way.tolls, way.flipSecret, way.hospitality]

describe('a free way hides the dearer ways to the same site (R-7.1.4, R-11.12)', () => {
    it('the Portal’s free Travel beside Way Station’s favor: the Great Slum offers only the free way', async () => {
        const { session } = await throughThePortal()
        expect(session.shroudedWoodChooser).toBeUndefined()
        expect(waysAt(session, greatSlum).map(payment)).toEqual([[0, [], false, undefined]])
    })

    it('the map chip reads "0 Supply", as on a site with one way, and the lit site’s name says the same', async () => {
        const { session } = await throughThePortal()
        const chip = chipAt(session, greatSlum)
        expect(chip).toEqual({ words: '0 Supply' })
        assert(chip !== undefined, 'the Great Slum has a chip')
        expect(chipWords(chip)).toBe('0 Supply')
    })

    it('a tap on the map sends the free way at once: no toll, no favor, the Portal in use', async () => {
        const { session, sent } = await throughThePortal()
        await session.pickTravelSite(greatSlum)
        const action = sentTravel(sent)
        expect(action.siteId).toBe(greatSlum)
        expect(action.tolls).toBeUndefined()
        expect(action.flipSecret).toBeUndefined()
        expect(action.modifiers).toEqual([travelCard(PORTAL)])
    })

    it('the hidden way is not sent in its place: Way Station’s favor way is refused once the free way shows', async () => {
        const { session, sent } = await throughThePortal()
        const dearer = { ...waysAt(session, greatSlum)[0], tolls: [WAY_STATION], discountTolls: [WAY_STATION] }
        await session.travelTo(greatSlum, dearer)
        expect(sent).not.toHaveBeenCalled()
    })

    it('a gain is no cost: Hospitality’s two banks stay with the free way, on the chip and in the Travel row', async () => {
        const { session, sent } = await throughThePortal(woodPortalBanksState())
        const ways = waysAt(session, greatSlum)
        expect(ways.map(payment)).toEqual([
            [0, [], false, Suit.Order],
            [0, [], false, Suit.Nomad]
        ])
        const chip = chipAt(session, greatSlum)
        expect(chip).toEqual({ ways: [{ cost: 0, favor: 0, secrets: 0 }], banks: [Suit.Order, Suit.Nomad] })
        assert(chip !== undefined, 'the Great Slum has a chip')
        expect(chipWords(chip)).toBe('0 Supply, gain 1 favor from the Order or Nomad bank')

        // Two banks open the row; it holds the free way once per bank, and the one picked is sent.
        await session.pickTravelSite(greatSlum)
        expect(sent).not.toHaveBeenCalled()
        expect(session.travelWaysOpen?.ways.map(payment)).toEqual(ways.map(payment))
        const nomad = ways[1]
        assert(nomad !== undefined, 'the nomad way is offered')
        await session.travelTo(greatSlum, nomad)
        const action = sentTravel(sent)
        expect(action.tolls).toBeUndefined()
        expect(action.modifiers).toContainEqual(expect.objectContaining({ cardId: HOSPITALITY }))
    })

    it('Second Wind’s free Travel beside Way Station: the free way alone', async () => {
        const state = testState(
            [
                testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', supply: 3, favor: 3 }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'h1', favor: 3, warbandsOnBoard: { rhys: 2 } })
            ],
            {
                oathRevision: CURRENT_OATH_REVISION,
                machineState: MachineState.PowerQuestion,
                denizensBySite: { c1: [], c2: [WAY_STATION] },
                warbandsBySite: { c2: { rhys: 1 } }
            }
        )
        state.pendingQuestions = {
            queue: [{ kind: PowerQuestionKind.FreeActionOutOfTurn, cardId: SECOND_WIND, askedPlayerId: 'dana', action: ActionType.Travel }],
            askingPlayerId: 'rhys',
            resumeMachineState: MachineState.ActPhase
        }
        state.heldTurn = { queue: [], askingPlayerId: 'rhys', resumeMachineState: MachineState.ActPhase }
        openTurn(state, 'rhys')
        state.activePlayerIds = ['dana']
        const dana = state.getPlayerState('dana')
        dana.advisers = [{ cardId: SECOND_WIND, faceUp: true }]
        dana.freeTravelAtAction = state.actionCount
        const { session } = await travelling(state)
        expect(waysAt(session, 'c2').map(payment)).toEqual([[0, [], false, undefined]])
        expect(chipAt(session, 'c2')).toEqual({ words: '0 Supply' })
    })
})

describe('with no free way, every way shows as before', () => {
    it('Way Station beside 1 Supply: both ways, on the chip with "or" between them', async () => {
        const state = testState(
            [
                testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', supply: 3, favor: 3 }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'h1', favor: 3 })
            ],
            {
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [], c2: [WAY_STATION] },
                warbandsBySite: { c1: { dana: 1 }, c2: { rhys: 1 } }
            }
        )
        openTurn(state, 'dana')
        const { session } = await travelling(state)
        expect(waysAt(session, 'c2').map((way) => [way.cost, way.tolls])).toEqual([
            [1, []],
            [0, [WAY_STATION]]
        ])
        const chip = chipAt(session, 'c2')
        assert(chip !== undefined, 'c2 has a chip')
        expect(chipWords(chip)).toBe('1 Supply or 0 Supply + 1 favor')
    })

    it('the Buried Giant’s flip is a cost: "2 Supply" and "0 + [secret]" both stay', async () => {
        const state = testState(
            [
                testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', supply: 3, secrets: 1 }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'h1' })
            ],
            {
                machineState: MachineState.ActPhase,
                siteCards: { c1: 'site.buried-giant', c2: 'site.river' },
                warbandsBySite: { c1: { dana: 1 } }
            }
        )
        openTurn(state, 'dana')
        const { session } = await travelling(state)
        expect(waysAt(session, 'c2').map((way) => way.flipSecret)).toEqual([false, true])
        const chip = chipAt(session, 'c2')
        assert(chip !== undefined, 'c2 has a chip')
        expect(chipWords(chip)).toMatch(/ or 0 Supply \+ 1 secret$/)
    })
})

describe('waysToShow', () => {
    const way = (cost: number, tolls: string[] = [], flipSecret: TravelFlip = false) => ({
        cost,
        tolls,
        flipSecret,
        discountTolls: []
    })

    it('keeps only the ways that cost nothing where one does, in their order', () => {
        const free = way(0)
        expect(waysToShow([way(0, [WAY_STATION]), free, way(2)])).toEqual([free])
    })

    it('a toll or a flip is a cost: with no free way every way stays', () => {
        const ways = [way(2), way(0, [WAY_STATION]), way(0, [], true), way(0, [], 2)]
        expect(waysToShow(ways)).toEqual(ways)
    })
})
