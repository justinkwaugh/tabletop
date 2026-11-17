import { describe, expect, it } from 'vitest'
import { assertExists, GameEngine, validateGameResult } from '@tabletop/common'
import { privateTerms1867 } from '../privates.js'
import { playOut } from '../../test/bot.js'
import { kit } from '../../test/kit.js'
import { Definition } from './gameDefinition.js'

const runtime = Definition.runtime
const counts = [2, 3, 4, 5, 6]
const configs = [
    undefined,
    { unlimitedSpecialTrains: false },
    { noPriceFloor: true },
    { longGame: true },
    { proposerOrder: true }
]

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

// What a seat assignment rightly changes: the turn order, and who the auction waits for.
function withoutSeating(state: object, normal: { turnManager: object }) {
    return JSON.parse(
        JSON.stringify({ ...state, turnManager: normal.turnManager }, (key, value) =>
            key === 'nextPlayerId' || key === 'activePlayerIds' || key === 'nominatorId'
                ? undefined
                : value
        )
    )
}

describe.each(counts)('1867 tournaments with %i players', (count) => {
    const ids = Array.from({ length: count }, (_, index) => `p${index + 1}`)

    it.each(configs)('seats each assigned order through the private auction (%j)', (config) => {
        for (const order of rotations(ids)) {
            const game = kit.table(count, 7, config, () => order)
            expect(game.state.turnManager.turnOrder).toEqual(order)
            // Each private goes to its nominator, so either turn-order option passes the
            // next nomination to the following seat (GTG §5.2, §14).
            for (let index = 0; game.state.selectionAuction?.remainingLotIds.length; index++) {
                const [lotId] = game.state.selectionAuction.remainingLotIds
                expect(game.player).toBe(order[index % count])
                game.act('NominateLot', { lotId, amount: privateTerms1867(lotId).minimumBid })
                while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
            }
        }
    })

    it.each(configs)('leaves ordinary setup otherwise unchanged (%j)', (config) => {
        const game = kit.table(count, 7, config).game
        const engine = new GameEngine(runtime)
        const uninitialized = engine.generateUninitializedState(
            game,
            '0123456789abcdef0123456789abcdef'
        )
        const initialize = (playerIds?: string[]) =>
            runtime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(withoutSeating(assigned, normal)).toEqual(withoutSeating(normal, normal))
        }
    })

    it('scores every player from a finished game', () => {
        const game = kit.table(count, 1)
        playOut(game, 1)
        expect(game.state.machineState).toBe('GameOver')
        expect(() => validateGameResult(game.hydrated)).not.toThrow()
        const scoring = runtime.scoring
        assertExists(scoring, 'The title reports final scores')
        expect(Object.keys(scoring.finalScores(game.state)).toSorted()).toEqual(ids.toSorted())
    }, 180_000)
})
