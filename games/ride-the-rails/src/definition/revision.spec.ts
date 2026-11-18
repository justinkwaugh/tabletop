import { describe, expect, it } from 'vitest'
import { isPlaceLocomotive } from '../actions/placeLocomotive.js'
import type { HexId } from '../data/hexes.js'
import { cityById } from '../data/boardMaps.js'
import { CURRENT_RIDE_THE_RAILS_REVISION } from '../model/gameState.js'
import { placementTest } from '../rules/placement.js'
import { buildState, hydrated, runAction } from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { PhaseName } from './phases.js'

// R-X.3: a recorded game replays under the rules of its revision. These pin how revision 1 plays
// two rules a reader might take another way; a change to either needs a new revision, with the old
// behaviour kept for games created under revision 1.
describe('revision 1 (R-X.3)', () => {
    it('is the revision new games are created under', () => {
        expect(CURRENT_RIDE_THE_RAILS_REVISION).toBe(1)
    })

    it('R-1.1, R-3.1: refuses a share and track from an empty supply', () => {
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

    it('R-4.2.3: lets Yellow start once, in Chicago or a westernmost city, not in both', () => {
        const chicago = cityById('city.usa.chicago').hexId
        const seattle = cityById('city.usa.seattle').hexId
        const before = buildState({
            phase: PhaseName.Build,
            shares: { p1: { 'railroad.yellow': 1 } },
            track: { [seattle]: ['railroad.purple'] }
        })
        const placeYellow = (hexId: HexId) => ({
            type: ActionType.PlaceLocomotive,
            playerId: 'p1',
            railroadId: 'railroad.yellow',
            hexId
        })
        for (const [first, second] of [
            [chicago, seattle],
            [seattle, chicago]
        ]) {
            const { after, processed } = runAction(before, placeYellow(first))
            expect(isPlaceLocomotive(processed[0]) && processed[0].metadata?.isStart).toBe(true)
            expect(placementTest(hydrated(after), 'p1', 'railroad.yellow', second)).toEqual({
                legal: false,
                reason: 'not-adjacent-or-start'
            })
            expect(() => runAction(hydrated(after), placeYellow(second))).toThrow()
        }
    })
})
