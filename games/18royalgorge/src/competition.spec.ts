import { describe, expect, it } from 'vitest'
import { assertExists, validateGameResult } from '@tabletop/common'
import { seatingTests } from '../../../libs/18xx/test/startingPositions.js'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'

// No Privates skips the auction for the first stock round; Alternate Prices draws more at setup.
const SetupConfigs = [{}, { noPrivates: true }, { alternatePrices: true }]

seatingTests(Definition, [2, 3, 4], { setupConfigs: SetupConfigs })

describe('18RoyalGorge competition results', () => {
    it.each(SetupConfigs)(
        'finishes a game from assigned seats with a valid result ranked by final scores (%o)',
        { timeout: 600_000 },
        (config) => {
            const seed = 1
            const game = kit.table(3, seed, config, (playerIds) => [...playerIds].reverse())
            expect(game.state.turnManager.turnOrder).toEqual(['p3', 'p2', 'p1'])
            playOut(game, seed)
            const state = game.state
            expect(state.machineState).toBe('GameOver')
            expect(() => validateGameResult(state)).not.toThrow()
            const scoring = Definition.runtime.scoring
            assertExists(scoring, '18RoyalGorge declares final scores')
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
