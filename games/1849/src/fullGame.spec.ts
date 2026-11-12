import { isAdvancePhase } from '@tabletop/18xx'
import { describe, expect, it } from 'vitest'
import { messinaEarthquakeOf } from './operating.js'
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

    it('records the Messina earthquake on the phase change to the first 12H only (§12)', () => {
        const game = kit.table(4, 1)
        playOut(game, 1)
        const phaseChanges = game.actions.filter(isAdvancePhase)
        const quakes = phaseChanges.filter((action) => messinaEarthquakeOf(action))
        expect(quakes.map((action) => action.metadata?.event.toPhaseId)).toEqual(['12H'])
    }, 120_000)
})
