import { GameEngine, PlayerStatus, type GameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './definition.js'
import { LowenherzRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(LowenherzRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, config: GameConfig) {
    return LowenherzRuntime.initializer.initializeGame(
        {
            id: 'lowenherz-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

describe.each([2, 3, 4])('Lowenherz tournaments with %i players', (count) => {
    describe.each([true, false])('playerPlacedCastles %s', (playerPlacedCastles) => {
        const openingState =
            count === 2 || playerPlacedCastles
                ? MachineState.PlacingCastles
                : MachineState.StartOfTurn

        it('seats players in the assigned order from the first turn', () => {
            const game = createGame(count, { playerPlacedCastles })
            const playerIds = game.players.map((player) => player.id)
            for (let offset = 0; offset < count; offset++) {
                const order = [...playerIds.slice(offset), ...playerIds.slice(0, offset)]
                const { initialState, startedGame } = engine.startGame(game, {
                    masterSeed,
                    startingPositions: { playerIds: order }
                })
                expect(startedGame.protectedInformation).toBe(true)
                expect(initialState.machineState).toBe(openingState)
                expect(initialState.turnManager.turnOrder).toEqual(order)
                expect(initialState.turnOrder).toEqual(order)
                expect(initialState.firstPlayerId).toBe(order[0])
                expect(initialState.players.map((player) => player.playerId)).toEqual(order)
                expect(initialState.activePlayerIds).toEqual([order[0]])
            }
        })

        it('keeps the seeded board, colors, and decks independent of the assigned order', () => {
            const game = createGame(count, { playerPlacedCastles })
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const normal = LowenherzRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized))
                .dehydrate()
            const sameOrder = LowenherzRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), {
                    playerIds: normal.turnManager.turnOrder
                })
                .dehydrate()
            expect(sameOrder).toEqual(normal)

            const reversedIds = normal.turnManager.turnOrder.toReversed()
            const reversed = LowenherzRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), {
                    playerIds: reversedIds
                })
                .dehydrate()
            expect(reversed.turnOrder).toEqual(reversedIds)
            expect(
                reversed.players.map((player) => [player.playerId, player.color]).toSorted()
            ).toEqual(normal.players.map((player) => [player.playerId, player.color]).toSorted())
            expect(reversed.neutralColor).toEqual(normal.neutralColor)
            expect(reversed.board).toEqual(normal.board)
            expect(reversed.actionDeck).toEqual(normal.actionDeck)
            expect(reversed.politicsCardPileA).toEqual(normal.politicsCardPileA)
            expect(reversed.politicsCardPileB).toEqual(normal.politicsCardPileB)
            expect(reversed.prng).toEqual(normal.prng)
            expect(reversed.protectedPrng).toEqual(normal.protectedPrng)
        })
    })
})
