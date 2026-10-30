import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '../model/gameState.js'
import { reportGameProgress } from './gameProgression.js'

const state: GameState = {
    id: 'state-1',
    gameId: 'game-1',
    players: [],
    activePlayerIds: [],
    actionCount: 0,
    actionChecksum: 0,
    prng: { seed: 1, invocations: 0 },
    machineState: 'playing',
    turnManager: { series: [], turnOrder: [], turnCounts: {} },
    winningPlayerIds: []
}

describe('reportGameProgress', () => {
    it('reports nothing for a title without progression', () => {
        expect(reportGameProgress({}, state)).toBeUndefined()
    })

    it('keeps the fraction within the game and to three places', () => {
        const reported = (fraction: number) =>
            reportGameProgress(
                { progression: { progress: () => ({ fraction, label: 'x' }) } },
                state
            )
        expect(reported(1 / 3)).toEqual({ fraction: 0.333, label: 'x' })
        expect(reported(-0.2)?.fraction).toBe(0)
        expect(reported(1.4)?.fraction).toBe(1)
    })

    it('leaves progress unset when the title fails to report it', () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
        const failing = {
            progression: {
                progress: () => {
                    throw Error('Unknown phase')
                }
            }
        }
        expect(reportGameProgress(failing, state)).toBeUndefined()
        const invalid = { progression: { progress: () => ({ fraction: Number.NaN, label: '' }) } }
        expect(reportGameProgress(invalid, state)).toBeUndefined()
        expect(logged).toHaveBeenCalledTimes(2)
        logged.mockRestore()
    })
})
