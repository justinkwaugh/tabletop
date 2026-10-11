import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, assert, createAction } from '@tabletop/common'
import { ActionType, OathRevision, PowerQuestionKind, Region, Travel, isAnswerQuestion } from '@tabletop/oath'
import { disposeSessions, openSessionOn, played, tableOf } from '$lib/testing/sessionHarness.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { woodCommonCost, woodCostNoteShort } from './woodTravel.js'
import { gridRefusal, refusalWords } from './actionAvailability.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const DECADENT = 'reliquary.decadent'

function travellerSession(state: ReturnType<typeof shroudedWoodState>) {
    const session = openSessionOn(tableOf(state))
    session.chooseAction(ActionType.Travel)
    return session
}

describe('R-11.7 — the traveller leaving a Shrouded Wood an enemy rules', () => {
    it('lists only the regions the ruler can pick, each with what the pick costs', () => {
        const session = travellerSession(shroudedWoodState(2))
        expect(session.shroudedWoodChooser).toBe('Cole')
        const regions = session.woodRegions
        expect(regions).toEqual([
            { region: Region.Cradle, cost: 0, base: 2, foldedBy: [DECADENT], siteIds: ['c1', 'c2'] },
            { region: Region.Provinces, cost: 2, base: 2, foldedBy: [], siteIds: ['p2', 'p3'] }
        ])
        assert(regions !== undefined, 'the Travel pays at the pick')
        expect(regions.map(woodCostNoteShort)).toEqual(['Decadent', ''])
        expect(woodCommonCost(regions)).toBeUndefined()
    })

    it('with 3 Supply the Hinterland is listed at Decadent’s one more', () => {
        const regions = travellerSession(shroudedWoodState(3)).woodRegions ?? []
        expect(regions.map((r) => [r.region, r.cost])).toEqual([[Region.Cradle, 0], [Region.Provinces, 2], [Region.Hinterland, 3]])
        expect(woodCostNoteShort(regions[2])).toBe('Decadent')
    })

    it('one cost for every region listed, or a free Travel, is said once', () => {
        const cradleWood = travellerSession(shroudedWoodState(2, { inCradle: true })).woodRegions ?? []
        expect(cradleWood.map((r) => [r.region, r.cost])).toEqual([[Region.Cradle, 2], [Region.Provinces, 2]])
        expect(woodCommonCost(cradleWood)).toBe(2)

        const state = shroudedWoodState(0)
        state.getPlayerState('Jacob').freeTravelAtAction = state.actionCount
        const session = travellerSession(state)
        expect(session.woodTravelIsFree).toBe(true)
        expect(session.woodRegions?.map((r) => r.region)).toEqual([Region.Cradle, Region.Provinces, Region.Hinterland])
        expect(woodCommonCost(session.woodRegions ?? [])).toBe(0)
    })

    it('a game created before the revision keeps the old panel', () => {
        const session = travellerSession(shroudedWoodState(2, { oathRevision: OathRevision.EngineFixes2 }))
        expect(session.shroudedWoodChooser).toBe('Cole')
        expect(session.woodRegions).toBeUndefined()
    })
})

describe('R-11.7 — the ruler picks where the traveller goes', () => {
    function rulerSession(supply: number) {
        const state = shroudedWoodState(supply)
        const table = played(tableOf(state), [createAction(Travel, { gameId: state.gameId, source: ActionSource.User, playerId: 'Jacob' })])
        const session = openSessionOn(table)
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        return { session, sent }
    }

    it('is offered only the sites the traveller can pay for, by region with the cost', async () => {
        const { session, sent } = rulerSession(2)
        expect(session.myPlayer?.id).toBe('Cole')
        expect(session.question.woodDestinations).toEqual(['c1', 'c2', 'p2', 'p3'])
        expect(session.question.woodRegions.map((r) => [r.region, r.cost, r.siteIds])).toEqual([
            [Region.Cradle, 0, ['c1', 'c2']],
            [Region.Provinces, 2, ['p2', 'p3']]
        ])

        await session.question.sendThrough('h1')
        expect(sent).not.toHaveBeenCalled()
        await session.question.sendThrough('p2')
        const answer = sent.mock.calls[0][0]
        assert(isAnswerQuestion(answer), 'the pick is sent')
        expect(answer.answer).toEqual({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'p2' })
    })
})

describe('R-11.7, Toll Roads — the ruler’s pick into a site whose ruler holds Toll Roads', () => {
    const TOLL_ROADS = 'denizen.order.toll-roads'

    /** Cole also rules p2, which holds Toll Roads; Jacob has `favor`. */
    function tollState(favor: number, oathRevision: number = OathRevision.UiBatch1) {
        const state = shroudedWoodState(2, { oathRevision })
        state.denizensBySite = { ...state.denizensBySite, p2: [TOLL_ROADS] }
        state.warbandsBySite = { ...state.warbandsBySite, p2: { Cole: 1 } }
        state.getPlayerState('Jacob').favor = favor
        return state
    }

    function rulerSession(state: ReturnType<typeof shroudedWoodState>) {
        const table = played(tableOf(state), [createAction(Travel, { gameId: state.gameId, source: ActionSource.User, playerId: 'Jacob' })])
        return openSessionOn(table)
    }

    it('marks the toll site among the picks', () => {
        const session = rulerSession(tollState(1))
        expect(session.question.woodDestinations).toEqual(['c1', 'c2', 'p2', 'p3'])
        expect(session.question.woodDestinations.filter((siteId) => session.question.woodTollAt(siteId))).toEqual(['p2'])
    })

    it('does not offer a toll site the traveller has no favor for', () => {
        const session = rulerSession(tollState(0))
        expect(session.question.woodDestinations).toEqual(['c1', 'c2', 'p3'])
    })

    it('a game created before the revision asks no toll, so marks none', () => {
        const session = rulerSession(tollState(1, OathRevision.EngineFixes2))
        expect(session.question.woodTollAt('p2')).toBe(false)
    })

    it('when every site takes a favor the traveller does not have, the grid says the favor', () => {
        const state = tollState(0)
        state.warbandsBySite = Object.fromEntries(Object.keys(state.siteCards).map((siteId) => [siteId, { Cole: 1 }]))
        const session = openSessionOn(tableOf(state))
        const refusal = gridRefusal(session.gameState, 'Jacob', ActionType.Travel)
        expect(refusal).toEqual({ cause: 'favor', has: 0 })
        expect(refusal && refusal.cause !== 'engine' ? refusalWords(refusal) : undefined).toBe('Needs 1 favor; you have 0.')
    })
})
