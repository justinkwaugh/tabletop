import { describe, expect, it } from 'vitest'
import { validateGameResult } from '@tabletop/common'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Sweep = process.env.SWEEP
const Seeds = Sweep ? Array.from({ length: Number(Sweep) || 30 }, (_, i) => i + 1) : [1]

describe('whole games', () => {
    it.each(Seeds.flatMap((seed) => [2, 3, 4].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end with a valid result',
        (players, seed) => {
            const game = kit.table(players, seed)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
            expect(() => validateGameResult(game.state)).not.toThrow()
        },
        600_000
    )
})
