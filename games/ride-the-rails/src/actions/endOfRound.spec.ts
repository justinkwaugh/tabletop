import { ActionSource, createAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { CityId } from '../data/boardMap.js'
import { PhaseName } from '../definition/phases.js'
import { RideTheRailsRuntime } from '../definition/runtime.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { turnOrderByMoney } from '../rules/endOfRound.js'
import { availableRailroads } from '../rules/supply.js'
import { buildState } from '../testing/fixtures.js'
import { EndRound, HydratedEndRound, isEndRound } from './endRound.js'

function endRound(state: HydratedRideTheRailsGameState): HydratedEndRound {
    const action = new HydratedEndRound(
        createAction(EndRound, {
            id: 'end-round',
            gameId: state.gameId,
            source: ActionSource.System
        })
    )
    action.apply(state)
    return action
}

function stateAtEndOf(round: number, money: Record<string, number>, playerCount = 3) {
    return buildState({ playerCount, round, phase: PhaseName.Ride, money })
}

describe('EndRound (R-2.5)', () => {
    describe('when it is accepted', () => {
        it('ends rounds 1 to 5 (R-2.5)', () => {
            for (const round of [1, 2, 3, 4, 5]) {
                expect(HydratedEndRound.canEndRound(stateAtEndOf(round, {}))).toBe(true)
            }
        })

        it('is refused after round 6, which ends the game instead (R-6.1)', () => {
            const state = stateAtEndOf(6, {})
            expect(HydratedEndRound.canEndRound(state)).toBe(false)
            expect(() => endRound(state)).toThrow('Round 6 ends the game instead (R-6.1)')
        })
    })

    describe('turn order (R-2.5.1)', () => {
        it('puts the lowest money first and the richest last', () => {
            const state = stateAtEndOf(1, { p1: 30, p2: 10, p3: 20 })
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p2', 'p3', 'p1'])
        })

        it('keeps an order that is already by money', () => {
            const state = stateAtEndOf(2, { p1: 4, p2: 9, p3: 15, p4: 22 }, 4)
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p1', 'p2', 'p3', 'p4'])
        })
    })

    describe('ties (R-2.5)', () => {
        it('swaps two tied players next to each other', () => {
            const state = stateAtEndOf(1, { p1: 10, p2: 10, p3: 5 })
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p3', 'p2', 'p1'])
        })

        it('swaps two tied players with another player between them', () => {
            const state = stateAtEndOf(1, { p1: 10, p2: 20, p3: 10 })
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p3', 'p1', 'p2'])
        })

        it('reverses three tied players as a block', () => {
            const state = stateAtEndOf(3, { p1: 12, p2: 12, p3: 12, p4: 3 }, 4)
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p4', 'p3', 'p2', 'p1'])
        })

        it('reverses the whole order when every player is tied', () => {
            const state = stateAtEndOf(1, { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 }, 5)
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p5', 'p4', 'p3', 'p2', 'p1'])
        })

        it('reverses each tied group on its own', () => {
            const state = stateAtEndOf(4, { p1: 8, p2: 15, p3: 8, p4: 15, p5: 8 }, 5)
            endRound(state)
            expect(state.turnManager.turnOrder).toEqual(['p5', 'p3', 'p1', 'p4', 'p2'])
        })

        it('reverses the order of the round just played, not the setup order', () => {
            const state = stateAtEndOf(2, { p1: 10, p2: 10, p3: 10 })
            state.turnManager.turnOrder = ['p2', 'p3', 'p1']
            expect(turnOrderByMoney(state)).toEqual(['p1', 'p3', 'p2'])
        })
    })

    describe('round and railroads (R-2.5.2, R-2.5.3)', () => {
        it('ends the round and starts the next (R-2.5.2)', () => {
            const state = stateAtEndOf(2, {})
            endRound(state)
            expect(state.roundManager.series[1].end).toBeDefined()
            expect(state.roundManager.currentRound?.number).toBe(3)
        })

        it.each([
            [1, 'railroad.orange'],
            [2, 'railroad.yellow'],
            [3, 'railroad.purple'],
            [4, 'railroad.black']
        ] as const)(
            'makes the next railroad available after round %i (R-2.5.3)',
            (round, railroadId) => {
                const state = stateAtEndOf(round, {})
                expect(availableRailroads(state)).not.toContain(railroadId)
                const action = endRound(state)
                expect(availableRailroads(state)).toContain(railroadId)
                expect(action.metadata?.railroadId).toBe(railroadId)
            }
        )

        it('makes no railroad available after round 5 (R-2.5.3)', () => {
            const state = stateAtEndOf(5, {})
            const before = availableRailroads(state)
            const action = endRound(state)
            expect(availableRailroads(state)).toEqual(before)
            expect(action.metadata).not.toHaveProperty('railroadId')
        })
    })

    describe('metadata', () => {
        it('records the round, the new order, each player’s money and the railroad', () => {
            const state = stateAtEndOf(1, { p1: 30, p2: 10, p3: 20 })
            const action = endRound(state)
            expect(action.metadata).toEqual({
                round: 1,
                turnOrder: ['p2', 'p3', 'p1'],
                money: [
                    { playerId: 'p2', money: 10 },
                    { playerId: 'p3', money: 20 },
                    { playerId: 'p1', money: 30 }
                ],
                railroadId: 'railroad.orange'
            })
        })

        it('round-trips through the hydrator with its metadata', () => {
            const state = stateAtEndOf(1, { p1: 30, p2: 10, p3: 20 })
            const action = endRound(state)
            const hydrated = RideTheRailsRuntime.hydrator.hydrateAction(action.dehydrate())
            expect(isEndRound(hydrated)).toBe(true)
            expect(hydrated.dehydrate()).toEqual(action.dehydrate())
        })

        it('changes no money, shares or track', () => {
            const state = buildState({
                round: 2,
                phase: PhaseName.Ride,
                money: { p1: 7, p2: 3, p3: 5 },
                shares: { p1: { 'railroad.red': 2 } },
                track: { 'hex.usa.6-60': ['railroad.red'] }
            })
            const players = structuredClone(state.dehydrate().players)
            endRound(state)
            expect(state.dehydrate().players).toEqual(players)
            expect(state.track).toEqual({ 'hex.usa.6-60': ['railroad.red'] })
        })
    })
})

describe('France (R-8.4): Paris Travels', () => {
    function franceAtEndOf(round: number, passengers: CityId[]) {
        return buildState({ mapId: 'map.fr', round, phase: PhaseName.Ride, passengers })
    }

    it('places a passenger in Paris at the end of the round when it has none', () => {
        const state = franceAtEndOf(2, ['city.fr.lille', 'city.fr.lyon'])
        const action = endRound(state)
        expect(state.passengers).toEqual(['city.fr.lille', 'city.fr.lyon', 'city.fr.paris'])
        expect(action.metadata?.passengerPlacedIn).toBe('city.fr.paris')
    })

    it('places none while Paris still holds its passenger', () => {
        const state = franceAtEndOf(2, ['city.fr.lyon', 'city.fr.paris'])
        const action = endRound(state)
        expect(state.passengers).toEqual(['city.fr.lyon', 'city.fr.paris'])
        expect(action.metadata).not.toHaveProperty('passengerPlacedIn')
    })

    it('round-trips the placed passenger through the hydrator', () => {
        const action = endRound(franceAtEndOf(3, []))
        const hydrated = RideTheRailsRuntime.hydrator.hydrateAction(action.dehydrate())
        expect(hydrated.dehydrate()).toEqual(action.dehydrate())
    })
})
