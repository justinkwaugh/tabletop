import { describe, expect, it } from 'vitest'
import { isPlaceLocomotive } from '../actions/placeLocomotive.js'
import { usaCity } from '../data/usaMap.js'
import { CURRENT_RIDE_THE_RAILS_REVISION } from '../model/gameState.js'
import { placementTest } from '../rules/placement.js'
import { buildState, hydrated, runAction } from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { PhaseName } from './phases.js'

// R-X.3: a recorded game replays under the rules of its revision. These pin the provisional
// rulings as revision 1 plays them; a ruling that changes needs a new revision, with the old
// behaviour kept for games created under revision 1.
describe('revision 1 (R-X.3)', () => {
    it('is the revision new games are created under', () => {
        expect(CURRENT_RIDE_THE_RAILS_REVISION).toBe(1)
    })

    it('R-1.1-H1: refuses a share and track from an empty supply', () => {
        const sharing = buildState({ shares: { p1: { 'railroad.red': 27 } } })
        expect(() =>
            runAction(sharing, {
                type: ActionType.TakeShare,
                playerId: 'p3',
                railroadId: 'railroad.red'
            })
        ).toThrow(/empty-supply/)

        const building = buildState({
            phase: PhaseName.Build,
            shares: { p1: { 'railroad.red': 26 } },
            track: { 'hex.usa.6-60': ['railroad.red'] }
        })
        expect(placementTest(building, 'p1', 'railroad.red', 'hex.usa.6-58')).toEqual({
            legal: false,
            reason: 'empty-supply'
        })
        expect(() =>
            runAction(building, {
                type: ActionType.PlaceLocomotive,
                playerId: 'p1',
                railroadId: 'railroad.red',
                hexId: 'hex.usa.6-58'
            })
        ).toThrow()
    })

    it('R-4.2.3-H1: lets Yellow start in Chicago and again in a westernmost city', () => {
        const chicago = usaCity('city.usa.chicago').hexId
        const seattle = usaCity('city.usa.seattle').hexId
        const before = buildState({
            phase: PhaseName.Build,
            shares: { p1: { 'railroad.yellow': 1 } },
            track: { [seattle]: ['railroad.purple'] }
        })
        const first = runAction(before, {
            type: ActionType.PlaceLocomotive,
            playerId: 'p1',
            railroadId: 'railroad.yellow',
            hexId: chicago
        })
        const second = runAction(hydrated(first.after), {
            type: ActionType.PlaceLocomotive,
            playerId: 'p1',
            railroadId: 'railroad.yellow',
            hexId: seattle
        })
        const starts = [first, second].map(({ processed: [action] }) =>
            isPlaceLocomotive(action) ? action.metadata?.isStart : undefined
        )
        expect(starts).toEqual([true, true])
        expect(second.after.yellow).toEqual({
            westernmost: ['city.usa.seattle'],
            startedInChicago: true,
            westStartCityId: 'city.usa.seattle'
        })
    })
})
