import { describe, expect, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Seeds = process.env.SWEEP ? Array.from({ length: 40 }, (_, i) => i + 1) : [1, 2, 3]

describe('whole games', () => {
    it.each(Seeds.flatMap((seed) => [3, 4, 5].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end',
        (players, seed) => {
            const game = kit.table(players, seed, seed % 2 ? { fiveCorporations: true } : {})
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        120_000
    )

    it('ends a game in which every corporation closes and no one can start one again', () => {
        const game = kit.table(3, 39, { fiveCorporations: true })
        playOut(game, 39)
        expect(game.state.machineState).toBe('GameOver')
        expect(game.state.gameEnding?.reason).toBe('No corporation can start')
    }, 120_000)
})
