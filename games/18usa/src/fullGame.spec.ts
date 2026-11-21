import { describe, expect, it } from 'vitest'
import { validateGameResult } from '@tabletop/common'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Sweep = process.env.SWEEP
const Seeds = Sweep ? Array.from({ length: Number(Sweep) || 30 }, (_, i) => i + 1) : [1]

describe('whole games', () => {
    it.each(Seeds.flatMap((seed) => [2, 4, 7].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end with a valid result',
        (players, seed) => {
            const game = kit.table(players, seed)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
            expect(() => validateGameResult(game.state)).not.toThrow()
        },
        600_000
    )

    // Seed 4 once offered P20's token a second time; seed 18 asks P13 to save a train while a
    // train purchase after the run changes the phase.
    it.each([
        [7, 4],
        [4, 18]
    ])(
        'a %i-player game with seed %i reaches its end',
        (players, seed) => {
            const game = kit.table(players, seed)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        600_000
    )

    it('a 4-player game with no president limit and $300 start prices reaches its end', () => {
        const game = kit.table(4, 3, { noPresidentLimit: true, highStartPrices: true })
        playOut(game, 3)
        expect(game.state.machineState).toBe('GameOver')
        expect(() => validateGameResult(game.state)).not.toThrow()
    }, 600_000)
})
