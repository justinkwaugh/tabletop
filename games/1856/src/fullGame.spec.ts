import { describe, expect, it } from 'vitest'
import { expectReplayableRecord } from '../../../libs/18xx/test/replayableRecord.js'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Seeds = process.env.SWEEP ? Array.from({ length: 30 }, (_, i) => i + 1) : [1, 2]

describe('whole games', () => {
    it.each(Seeds.flatMap((seed) => [3, 4, 6].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end',
        (players, seed) => {
            const game = kit.table(players, seed)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        180_000
    )

    // This game closes a corporation whose own earnings take its price to zero.
    it('leaves a record History Navigation can replay', () => {
        const game = kit.table(5, 3)
        playOut(game, 3)
        expectReplayableRecord(game, game.initialState)
    }, 600_000)
})
