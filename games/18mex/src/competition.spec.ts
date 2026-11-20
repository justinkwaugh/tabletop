import { describe, expect, it } from 'vitest'
import { assertExists, validateGameResult } from '@tabletop/common'
import { seatingTests } from '../../../libs/18xx/test/startingPositions.js'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'

// No option changes the setup or the first player; the all-options table shows it.
const SetupConfigs = [
    {},
    { threeYellowLays: true, earlyKcmo: true, delayedMinorClose: true, hardRust: true }
]

seatingTests(Definition, [3, 4, 5], { setupConfigs: SetupConfigs })

describe('18MEX competition results', () => {
    it(
        'finishes a game from assigned seats with a valid result ranked by final scores',
        {
            timeout: 600_000
        },
        () => {
            const seed = 1
            const game = kit.table(4, seed, {}, (playerIds) => [...playerIds].reverse())
            expect(game.state.turnManager.turnOrder).toEqual(['p4', 'p3', 'p2', 'p1'])
            playOut(game, seed)
            const state = game.state
            expect(state.machineState).toBe('GameOver')
            expect(() => validateGameResult(state)).not.toThrow()
            const scoring = Definition.runtime.scoring
            assertExists(scoring, '18MEX declares final scores')
            const scores = scoring.finalScores(state)
            const highest = Math.max(...Object.values(scores))
            expect(
                Object.keys(scores)
                    .filter((playerId) => scores[playerId] === highest)
                    .sort()
            ).toEqual([...(state.winningPlayerIds ?? [])].sort())
        }
    )
})
