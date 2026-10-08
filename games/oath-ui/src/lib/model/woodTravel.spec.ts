import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, assert, createAction } from '@tabletop/common'
import { ActionType, OathRevision, PowerQuestionKind, Region, Travel, isAnswerQuestion } from '@tabletop/oath'
import { disposeSessions, openSessionOn, played, tableOf } from '$lib/testing/sessionHarness.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { woodCommonCost, woodCostNote, woodCostNoteShort } from './woodTravel.js'

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
        expect(regions.map(woodCostNote)).toEqual(['Decadent: none into the Cradle', "the Wood's 2"])
        expect(regions.map(woodCostNoteShort)).toEqual(['Decadent', ''])
        expect(woodCommonCost(regions)).toBeUndefined()
    })

    it('with 3 Supply the Hinterland is listed at Decadent’s one more', () => {
        const regions = travellerSession(shroudedWoodState(3)).woodRegions ?? []
        expect(regions.map((r) => [r.region, r.cost])).toEqual([[Region.Cradle, 0], [Region.Provinces, 2], [Region.Hinterland, 3]])
        expect(woodCostNote(regions[2])).toBe('Decadent: one more into the Hinterland')
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
