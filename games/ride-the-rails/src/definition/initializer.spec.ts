import { describe, expect, it } from 'vitest'
import { USA_CITIES } from '../data/usaMap.js'
import { CURRENT_RIDE_THE_RAILS_REVISION } from '../model/gameState.js'
import { fixturePlayerIds, freshState } from '../testing/fixtures.js'
import { PhaseName } from './phases.js'
import { MachineState } from './states.js'

describe('initialization', () => {
    it('records the revision the game was created under (R-X.3)', () => {
        expect(CURRENT_RIDE_THE_RAILS_REVISION).toBe(1)
        expect(freshState().rideTheRailsRevision).toBe(CURRENT_RIDE_THE_RAILS_REVISION)
    })

    it('plays the USA map, the only map of this release (R-8-H1)', () => {
        expect(freshState().mapId).toBe('map.usa')
    })

    it('puts one passenger on every city, in id order (R-1.3.2, R-1.3-H1)', () => {
        const { passengers } = freshState()
        expect(passengers).toHaveLength(51)
        expect(new Set(passengers)).toEqual(new Set(USA_CITIES.map((city) => city.id)))
        expect(passengers).toEqual([...passengers].sort())
    })

    it('gives every player $0 and no shares (R-1.3.6, R-2.4)', () => {
        for (const player of freshState(5).players) {
            expect(player.money).toBe(0)
            expect(player.shares).toEqual({})
        }
    })

    it('opens round 1 with Take a Share (R-1.3.8, R-2.1)', () => {
        const state = freshState()
        expect(state.machineState).toBe(MachineState.TakingShares)
        expect(state.roundManager.currentRound?.number).toBe(1)
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.TakeShare)
    })

    it('starts with an empty map, Yellow unstarted and no bonus claimed (R-1.3)', () => {
        const state = freshState()
        expect(state.track).toEqual({})
        expect(state.yellow).toEqual({ startedInChicago: false })
        expect(state.transcontinental).toBeUndefined()
        expect(state.building).toBeUndefined()
    })

    it('keeps the turn order in the turn manager, the players in that order (R-1.3.7)', () => {
        const state = freshState(4)
        expect([...state.turnManager.turnOrder].sort()).toEqual(fixturePlayerIds(4))
        expect(state.players.map((player) => player.playerId)).toEqual(state.turnManager.turnOrder)
    })
})
