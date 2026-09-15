import { describe, expect, it } from 'vitest'
import { GameResult, validateGameResult } from './gameResult.js'
import { createPrivateHandGame } from '../visibility/tests/privateHandGame.js'

function finalState(result: GameResult, winningPlayerIds: string[]) {
    return { ...createPrivateHandGame().state, result, winningPlayerIds, activePlayerIds: [] }
}

describe('game result validation', () => {
    it.each([
        { result: GameResult.Win, winners: ['p1'] },
        { result: GameResult.Win, winners: ['p1', 'p2'] },
        { result: GameResult.Draw, winners: ['p1', 'p2'] },
        { result: GameResult.Abandoned, winners: [] }
    ])(
        'accepts $result with declared winners $winners without changing the state',
        ({ result, winners }) => {
            const state = finalState(result, winners)
            const before = structuredClone(state)
            expect(() => validateGameResult(state)).not.toThrow()
            expect(state).toEqual(before)
        }
    )

    it.each([
        { result: GameResult.Win, winners: [] },
        { result: GameResult.Draw, winners: [] },
        { result: GameResult.Win, winners: ['p1', 'p1'] },
        { result: GameResult.Win, winners: ['outsider'] },
        { result: GameResult.Abandoned, winners: ['p1'] }
    ])('rejects inconsistent $result with winners $winners', ({ result, winners }) => {
        expect(() => validateGameResult(finalState(result, winners))).toThrow()
    })

    it('rejects a result that is still pending', () => {
        expect(() =>
            validateGameResult({ ...finalState(GameResult.Draw, []), result: undefined })
        ).toThrow('no final result')
    })
})
