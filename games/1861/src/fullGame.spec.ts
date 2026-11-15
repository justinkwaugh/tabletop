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

    // The Grand Trunk options (§14), over fewer seeds.
    // eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
    const OptionSeeds = process.env.SWEEP ? Array.from({ length: 10 }, (_, i) => i + 1) : [1]
    it.each(
        (['trainExports', 'noPriceFloor', 'twoSpecialTrains'] as const).flatMap((option) =>
            OptionSeeds.map((seed) => [option, seed] as const)
        )
    )(
        'a game with %s and seed %i reaches its end',
        (option, seed) => {
            const config =
                option === 'twoSpecialTrains'
                    ? { unlimitedSpecialTrains: false }
                    : { [option]: true }
            const game = kit.table(4, seed, config)
            playOut(game, seed)
            expect(game.state.machineState).toBe('GameOver')
        },
        180_000
    )
})
