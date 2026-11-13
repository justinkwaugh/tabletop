import { describe, expect, it } from 'vitest'
import { validateGameResult } from '@tabletop/common'
import { expectReplayableRecord } from '../../../libs/18xx/test/replayableRecord.js'
import { playOut } from '../test/bot.js'
import { table } from '../test/kit.js'

describe('1862 whole games', () => {
    for (const [players, seed] of [
        [2, 12],
        [3, 11],
        [4, 12],
        [5, 13],
        [6, 16],
        [7, 17],
        [8, 18]
    ] as const)
        it(`plays a ${players}-player game to its end (seed ${seed})`, { timeout: 600_000 }, () => {
            const game = table(players, seed)
            const moves = playOut(game, seed, 6000)
            expect(game.state.machineState, `after ${moves} moves`).toBe('GameOver')
            expect(game.state.gameEnding?.reason).toBeDefined()
            expect(game.state.winningPlayerIds?.length).toBeGreaterThan(0)
            expect(() => validateGameResult(game.state)).not.toThrow()
        })

    it('leaves a new game’s record open to History Navigation', { timeout: 120_000 }, () => {
        const game = table(4, 12)
        expect(game.state.turnManager.seriesKeeps).toBe('latest')
        playOut(game, 12, 250)
        expectReplayableRecord(game, game.initialState)
    })
})
