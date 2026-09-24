import { ActionSource, GameEngine, PlayerStatus, assert } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import { SantiagoRuntime } from './runtime.js'
import { SantiagoGameStateValidator } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import type { PlaceSpring } from '../actions/placeSpring.js'
import type { PlaceBid } from '../actions/placeBid.js'

const engine = new GameEngine(SantiagoRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, randomizeSpring: boolean) {
    return SantiagoRuntime.initializer.initializeGame(
        {
            id: 'santiago-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { randomizeSpring },
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

describe.each([3, 4, 5])('Santiago tournament initialization with %i players', (count) => {
    it.each([true, false])('honors assigned positions with random spring %s', (randomizeSpring) => {
        const game = createGame(count, randomizeSpring)
        const ids = game.players.map((player) => player.id)
        for (let offset = 0; offset < count; offset++) {
            const order = [...ids.slice(offset), ...ids.slice(0, offset)]
            const { startedGame, initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            let state = initialState
            expect(state.seatOrder).toEqual(order)
            expect(state.turnManager.turnOrder).toEqual(order)
            if (!randomizeSpring) {
                expect(state.machineState).toBe(MachineState.SpringPlacement)
                expect(state.canalOverseerId).toBe(order[0])
                expect(state.activePlayerIds).toEqual([order[0]])
                const action: PlaceSpring = {
                    id: 'place-spring',
                    gameId: game.id,
                    source: ActionSource.User,
                    playerId: order[0],
                    type: ActionType.PlaceSpring,
                    col: 2,
                    row: 1
                }
                state = engine.executeCanonicalAction({
                    game: startedGame,
                    state,
                    action
                }).updatedState
            }
            const biddingOrder = [...order.slice(1), order[0]]
            expect(state.machineState).toBe(MachineState.Bidding)
            expect(state.biddingOrder).toEqual(biddingOrder)
            expect(state.activePlayerIds).toEqual([order[1]])
            for (const [index, playerId] of biddingOrder.entries()) {
                expect(state.activePlayerIds).toEqual([playerId])
                const action: PlaceBid = {
                    id: `bid-${playerId}`,
                    gameId: game.id,
                    source: ActionSource.User,
                    playerId,
                    type: ActionType.PlaceBid,
                    amount: index + 1
                }
                state = engine.executeCanonicalAction({
                    game: startedGame,
                    state,
                    action
                }).updatedState
            }
            expect(state.canalOverseerId).toBe(order[1])
            expect(state.seatOrder).toEqual(order)
        }
    })

    it.each([true, false])('preserves seeded setup with random spring %s', (randomizeSpring) => {
        const game = createGame(count, randomizeSpring)
        const raw = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            SantiagoRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(raw),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        const order = normal.seatOrder.toReversed()
        const assigned = initialize(order)
        expect(initialize(order)).toEqual(assigned)
        expect(assigned.seatOrder).toEqual(order)
        expect(assigned.canalOverseerId).toBe(order[0])
        expect({
            ...assigned,
            turnManager: normal.turnManager,
            seatOrder: normal.seatOrder,
            canalOverseerId: normal.canalOverseerId
        }).toEqual(normal)
        assert(SantiagoGameStateValidator.Check(assigned), 'Expected canonical state')
        for (const perspective of [
            ...order.map((playerId) => ({ kind: 'player', playerId }) as const),
            { kind: 'spectator' } as const
        ]) {
            const projected = SantiagoRuntime.visibility.state.project(assigned, perspective, {
                config: game.config
            })
            expect(projected.seatOrder).toEqual(order)
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        }
    })

    it.each([['p0', 'p0', 'p1'], ['p0'], ['p0', 'p1', 'unknown']])(
        'rejects invalid assignment %j',
        (...playerIds) => {
            expect(() =>
                engine.startGame(createGame(count, true), {
                    masterSeed,
                    startingPositions: { playerIds }
                })
            ).toThrow()
        }
    )
})
