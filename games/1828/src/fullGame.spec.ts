import { describe, expect, it } from 'vitest'
import { validateGameResult } from '@tabletop/common'
import { expectReplayableRecord } from '../../../libs/18xx/test/replayableRecord.js'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Sweep = process.env.SWEEP
const Seeds = Sweep ? Array.from({ length: Number(Sweep) || 30 }, (_, i) => i + 1) : [1, 2]

describe('whole games', () => {
    it.each(Seeds.flatMap((seed) => [3, 4, 5].map((players) => [players, seed])))(
        'a %i-player game with seed %i reaches its end with a valid result',
        (players, seed) => {
            const game = kit.table(players, seed)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
            expect(() => validateGameResult(game.state)).not.toThrow()
            const scores = Definition.runtime.scoring?.finalScores(game.state) ?? {}
            const highest = Math.max(...Object.values(scores))
            expect(Object.keys(scores).filter((id) => scores[id] === highest)).toEqual(
                game.state.winningPlayerIds
            )
        },
        300_000
    )
    it('leaves a record History Navigation can replay', () => {
        const game = kit.table(4, 1)
        playOut(game, 1)
        expectReplayableRecord(game, game.initialState)
    }, 300_000)
})
