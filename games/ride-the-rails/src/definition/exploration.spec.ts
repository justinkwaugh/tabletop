import { describe, expect, it } from 'vitest'
import type { RideTheRailsGameState } from '../model/gameState.js'
import { buildState, createGame } from '../testing/fixtures.js'
import { PhaseName } from './phases.js'
import { RideTheRailsRuntime } from './runtime.js'

const { exploration, hydrator, canonicalStateValidator } = RideTheRailsRuntime

function midGame(): RideTheRailsGameState {
    return buildState({
        round: 3,
        phase: PhaseName.Build,
        money: { p1: 14, p2: 9, p3: 21 },
        shares: { p1: { 'railroad.red': 2 }, p2: { 'railroad.blue': 1 } },
        track: { 'hex.usa.6-60': ['railroad.red'], 'hex.usa.6-58': ['railroad.red'] },
        building: { placed: 1, usedMountain: false }
    }).dehydrate()
}

// R-5: nothing is hidden, so either source is the whole state and exploration copies it.
describe('exploration (R-5)', () => {
    const sources = {
        canonical: (state: RideTheRailsGameState) => exploration.createFromCanonicalState(state),
        projected: (state: RideTheRailsGameState) =>
            exploration.createFromProjectedState({
                game: createGame(state.players.length),
                state,
                actions: [],
                perspective: { kind: 'player', playerId: 'p2' },
                random: () => 0.5
            })
    }

    it.each(Object.entries(sources))('starts from a copy of the %s state', (_, explore) => {
        const source = midGame()
        const before = structuredClone(source)
        const explored = explore(source)
        expect(explored).toEqual(source)
        expect(explored).not.toBe(source)
        explored.players[0].money += 50
        explored.track['hex.usa.6-60']?.push('railroad.blue')
        expect(source).toEqual(before)
    })

    it.each(Object.entries(sources))('gives a %s copy the hydrator accepts', (_, explore) => {
        const explored = explore(midGame())
        expect(canonicalStateValidator.Check(explored)).toBe(true)
        expect(hydrator.hydrateState(explored).dehydrate()).toEqual(explored)
    })
})
