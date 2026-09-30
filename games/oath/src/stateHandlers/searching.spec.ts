import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { machineContext, buildAction } from '../testing/actions.js'
import { ActPhaseStateHandler } from './actPhase.js'
import { SearchingStateHandler } from './searching.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { OathHydrator } from '../definition/hydrator.js'
import { Region } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'

const ORDER = 'denizen.order.wrestlers'
const BEAST = 'denizen.beast.rangers'

function searchAction() {
    return new HydratedSearch(
        buildAction(Search, {
            playerId: 'p1',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        })
    )
}

function resolveAction() {
    return new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId: 'p1',
            keptCardId: ORDER,
            discardOrder: [BEAST],
            play: SearchPlay.Discard
        })
    )
}

describe('the Search machine transition (R-4.2, R-5.1)', () => {
    it('sends a Search into Searching, not back to the Act Phase', () => {
        const state = testState([testPlayer({ siteId: 'c1' })])
        expect(new ActPhaseStateHandler().onAction(searchAction(), machineContext(state))).toBe(
            MachineState.Searching
        )
    })

    it('offers Search when a source is available', () => {
        const state = testState([testPlayer({ siteId: 'c1', supply: 7 })], {
            discardPileCounts: {
                [Region.Cradle]: 2,
                [Region.Provinces]: 0,
                [Region.Hinterland]: 0
            }
        })
        expect(
            new ActPhaseStateHandler().validActionsForPlayer('p1', machineContext(state))
        ).toContain(ActionType.Search)
    })

    it('offers nothing but finishing the Search while Searching (R-4.2)', () => {
        const state = testState([testPlayer({ siteId: 'c1', handIds: [ORDER, BEAST] })])
        const handler = new SearchingStateHandler()

        expect(handler.validActionsForPlayer('p1', machineContext(state))).toEqual([
            ActionType.SearchResolve
        ])
        expect(handler.isValidAction(searchAction(), machineContext(state))).toBe(false)
        expect(handler.isValidAction(resolveAction(), machineContext(state))).toBe(true)
    })

    it('returns to the Act Phase once the Search is resolved', () => {
        const state = testState([testPlayer({ siteId: 'c1', handIds: [ORDER, BEAST] })])
        expect(new SearchingStateHandler().onAction(resolveAction(), machineContext(state))).toBe(
            MachineState.ActPhase
        )
    })

    it('does not change the active player mid-Search', () => {
        const state = testState([
            testPlayer({ playerId: 'p1', siteId: 'c1' }),
            testPlayer({ playerId: 'p2', siteId: 'c2' })
        ])
        const before = [...state.activePlayerIds]
        new SearchingStateHandler().enter(machineContext(state))
        expect(state.activePlayerIds).toEqual(before)
    })
})

describe('action hydration', () => {
    it('hydrates every registered action type', () => {
        const hydrator = new OathHydrator()
        for (const action of [searchAction().dehydrate(), resolveAction().dehydrate()]) {
            expect(hydrator.hydrateAction(action).type).toBe(action.type)
        }
    })

    it('rejects an unknown action type', () => {
        expect(() =>
            new OathHydrator().hydrateAction({
                id: 'a1',
                gameId: 'game-1',
                source: ActionSource.User,
                type: 'nonsense',
                playerId: 'p1'
            })
        ).toThrow(/Unknown action type/)
    })
})
