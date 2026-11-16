import { describe, expect, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Seeds = process.env.SWEEP ? Array.from({ length: 30 }, (_, i) => i + 1) : [1, 2]

describe('whole games', () => {
    it.each(Seeds.flatMap((seed) => [2, 3, 4, 6].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end',
        (players, seed) => {
            const game = kit.table(players, seed)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        180_000
    )
})

describe('whole Off the Rails games', () => {
    it.each(Seeds.flatMap((seed) => [2, 4, 6].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end',
        (players, seed) => {
            const game = kit.table(players, seed, { offTheRails: true })
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        180_000
    )
})
