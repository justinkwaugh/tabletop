import { describe, expect, it } from 'vitest'
import { assertExists, validateGameResult } from '@tabletop/common'
import { seatingTests } from '../../../libs/18xx/test/startingPositions.js'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'
import type { State1860 } from './state.js'

// The all-options table changes the train roster and the rules written into the state; no
// option changes the first player.
const SetupConfigs = [
    {},
    {
        insolvency: 'simplified',
        noSkippingTowns: true,
        reenterHexes: true,
        unoperatedFullValue: true,
        twoSevenFourTrains: true
    }
]

/** The ordinary setup seated as assigned: seat one also opens the initial auction. */
function seated(ordinary: Omit<State1860, 'id'>, playerIds: readonly string[]) {
    const seatOne = playerIds[0]
    assertExists(ordinary.choiceAuction, 'The game opens with the initial auction')
    return {
        ...ordinary,
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        },
        choiceAuction: { ...ordinary.choiceAuction, starterId: seatOne }
    }
}

seatingTests(Definition, [2, 3, 4], { setupConfigs: SetupConfigs, seated })

describe('1860 competition results', () => {
    it('finishes a game from assigned seats with a valid result ranked by final scores', () => {
        const seed = 1
        const game = kit.table(4, seed, {}, (playerIds) => [...playerIds].reverse())
        expect(game.state.turnManager.turnOrder).toEqual(['p4', 'p3', 'p2', 'p1'])
        expect(game.state.choiceAuction?.starterId).toBe('p4')
        playOut(game, seed)
        const state = game.state
        expect(state.machineState).toBe('GameOver')
        expect(() => validateGameResult(state)).not.toThrow()
        const scoring = Definition.runtime.scoring
        assertExists(scoring, '1860 declares final scores')
        const scores = scoring.finalScores(state)
        const highest = Math.max(...Object.values(scores))
        expect(
            Object.keys(scores)
                .filter((playerId) => scores[playerId] === highest)
                .sort()
        ).toEqual([...(state.winningPlayerIds ?? [])].sort())
    }, 120_000)
})
