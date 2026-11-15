import { describe, expect, it } from 'vitest'
import { assertExists, GameEngine, validateGameResult } from '@tabletop/common'
import { botMove, Random } from '../test/bot.js'
import { kit } from '../test/kit.js'
import { Definition } from './definition/gameDefinition.js'
import { PrivateCatalog1849 } from './privates.js'

const runtime = Definition.runtime
const counts = [3, 4, 5]
// Every option that changes setup: the corporations in play and their order (§2.2), and the
// variants, whose E trains change the depot (§14).
const configs = [
    undefined,
    { fiveCorporations: true },
    { delayIft: true },
    { bonds: true },
    { buyStationTokens: true },
    { electricDreams: true }
]

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

// What a seat assignment rightly changes: the turn order, and who the auction waits for.
function withoutSeating(state: object, normal: { turnManager: object }) {
    return JSON.parse(
        JSON.stringify({ ...state, turnManager: normal.turnManager }, (key, value) =>
            key === 'nextPlayerId' || key === 'activePlayerIds' ? undefined : value
        )
    )
}

describe.each(counts)('1849 tournaments with %i players', (count) => {
    const ids = Array.from({ length: count }, (_, index) => `p${index + 1}`)

    it.each(configs)('seats each assigned order through the auction (%j)', (config) => {
        for (const order of rotations(ids)) {
            const game = kit.table(count, 7, config, () => order)
            expect(game.state.turnManager.turnOrder).toEqual(order)
            // Seat one buys the first private, and the others follow in their seats (§8).
            for (const [index, lot] of PrivateCatalog1849.privates.entries()) {
                expect(game.player).toBe(order[index % count])
                game.act('BuyAuctionLot', {
                    lotId: lot.id,
                    expectedPrice: PrivateCatalog1849.faceValue(lot.id)
                })
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

    it('scores every player from a finished game', { timeout: 120_000 }, () => {
        const game = kit.table(count, 1, { electricDreams: true }, () => [...ids].reverse())
        const random = new Random(1)
        for (let moves = 0; moves < 8000 && game.state.machineState !== 'GameOver'; moves++) {
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        expect(game.state.machineState).toBe('GameOver')
        expect(() => validateGameResult(game.hydrated)).not.toThrow()
        const scoring = runtime.scoring
        assertExists(scoring, 'The title reports final scores')
        expect(Object.keys(scoring.finalScores(game.state)).toSorted()).toEqual(ids.toSorted())
    })
})
