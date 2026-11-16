import { describe, expect, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { ScenarioIds1822 } from './scenarioCatalog.js'

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Sweep = !!process.env.SWEEP

// 1822+ with each way of dealing its private companies, the tax haven variant (§6.1), and each
// scenario (§6.2.1).
const Options: Record<string, boolean | string>[] = [
    {},
    { plus: true },
    { plus: true, allPrivates: true, taxHavenShares: true },
    { plus: true, mixedPrivates: true },
    ...ScenarioIds1822.map((scenario) => ({ scenario }))
]

// A whole bot game takes most of a minute, so the ordinary run plays a few: the most and fewest
// players, 1822+ with every option, and one scenario of each kind. SWEEP=1 plays every option
// at every player count over thirty seeds.
const Games: readonly (readonly [number, number, Record<string, boolean | string>])[] = Sweep
    ? Array.from({ length: 30 }, (_, index) => index + 1).flatMap((seed) =>
          Options.flatMap((options) =>
              [3, 4, 5, 6, 7].map((players) => [players, seed, options] as const)
          )
      )
    : [
          [3, 1, {}],
          [7, 1, {}],
          [5, 1, { plus: true, allPrivates: true, taxHavenShares: true }],
          [4, 1, { scenario: 'small-regional' }],
          [4, 1, { scenario: 'mini-game' }]
      ]

describe('whole games', () => {
    it.each(Games)(
        'a %i-player game with seed %i and options %j reaches its end',
        (players, seed, options) => {
            const game = kit.table(players, seed, options)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        600_000
    )
})
