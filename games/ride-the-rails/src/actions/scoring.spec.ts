import { ActionSource, GameResult, createAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { PhaseName } from '../definition/phases.js'
import { RideTheRailsRuntime } from '../definition/runtime.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { richestPlayerIds } from '../rules/scoring.js'
import { buildState } from '../testing/fixtures.js'
import { EndGame, HydratedEndGame, isEndGame } from './endGame.js'

function endGame(state: HydratedRideTheRailsGameState): HydratedEndGame {
    const action = new HydratedEndGame(
        createAction(EndGame, {
            id: 'end-game',
            gameId: state.gameId,
            source: ActionSource.System
        })
    )
    action.apply(state)
    return action
}

function finalState(money: Record<string, number>, playerCount = 3) {
    return buildState({ playerCount, round: 6, phase: PhaseName.Ride, money })
}

describe('EndGame (R-6)', () => {
    describe('when it is accepted (R-6.1)', () => {
        it('ends the game after round 6', () => {
            expect(HydratedEndGame.canEndGame(finalState({}))).toBe(true)
        })

        it('is refused before round 6', () => {
            for (const round of [1, 2, 3, 4, 5]) {
                const state = buildState({ round, phase: PhaseName.Ride })
                expect(HydratedEndGame.canEndGame(state)).toBe(false)
                expect(() => endGame(state)).toThrow('The game ends only after round 6 (R-6.1)')
            }
        })
    })

    describe('applied (R-6.1)', () => {
        it('ends round 6 and starts no other', () => {
            const state = finalState({})
            endGame(state)
            expect(state.roundManager.series).toHaveLength(6)
            expect(state.roundManager.series[5].end).toBeDefined()
            expect(state.roundManager.currentRound).toBeUndefined()
        })

        it('does not reorder the players by money', () => {
            const state = finalState({ p1: 40, p2: 10, p3: 25 })
            endGame(state)
            expect(state.turnManager.turnOrder).toEqual(['p1', 'p2', 'p3'])
        })
    })

    describe('winners (R-6.2)', () => {
        it('names the player with the most money as the winner (R-6.2)', () => {
            const state = finalState({ p1: 40, p2: 52, p3: 25 })
            endGame(state)
            expect(state.winningPlayerIds).toEqual(['p2'])
            expect(state.result).toBe(GameResult.Win)
        })

        it('shares the win between two players tied for the most money (R-6.2)', () => {
            const state = finalState({ p1: 52, p2: 30, p3: 52 })
            endGame(state)
            expect(state.winningPlayerIds).toEqual(['p1', 'p3'])
            expect(state.result).toBe(GameResult.Draw)
        })

        it('shares the win among every tied player, with no tie-break (R-6.2)', () => {
            const state = buildState({
                playerCount: 4,
                round: 6,
                phase: PhaseName.Ride,
                money: { p1: 61, p2: 61, p3: 20, p4: 61 },
                shares: { p1: { 'railroad.red': 9 }, p2: { 'railroad.blue': 1 } }
            })
            endGame(state)
            expect(state.winningPlayerIds).toEqual(['p1', 'p2', 'p4'])
            expect(state.result).toBe(GameResult.Draw)
        })

        it('reads money only: shares and track are worth nothing (R-6.2)', () => {
            const state = buildState({
                round: 6,
                phase: PhaseName.Ride,
                money: { p1: 30, p2: 31, p3: 0 },
                shares: { p1: { 'railroad.red': 12, 'railroad.black': 5 } }
            })
            expect(richestPlayerIds(state)).toEqual(['p2'])
        })
    })

    describe('metadata', () => {
        it('records each player’s final money and the winners', () => {
            const state = finalState({ p1: 52, p2: 30, p3: 52 })
            const action = endGame(state)
            expect(action.metadata).toEqual({
                money: [
                    { playerId: 'p1', money: 52 },
                    { playerId: 'p2', money: 30 },
                    { playerId: 'p3', money: 52 }
                ],
                winningPlayerIds: ['p1', 'p3']
            })
        })

        it('round-trips through the hydrator with its metadata', () => {
            const state = finalState({ p1: 52, p2: 30, p3: 41 })
            const action = endGame(state)
            const hydrated = RideTheRailsRuntime.hydrator.hydrateAction(action.dehydrate())
            expect(isEndGame(hydrated)).toBe(true)
            expect(hydrated.dehydrate()).toEqual(action.dehydrate())
        })
    })

    describe('final scores (R-6.2)', () => {
        it('scores each player their money', () => {
            const state = finalState({ p1: 52, p2: 30, p3: 41 })
            expect(RideTheRailsRuntime.scoring.finalScores(state.dehydrate())).toEqual({
                p1: 52,
                p2: 30,
                p3: 41
            })
        })
    })
})
