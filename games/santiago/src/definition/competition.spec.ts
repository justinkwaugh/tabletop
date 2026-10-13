import {
    ActionSource,
    GameEngine,
    GameResult,
    PlayerStatus,
    assert,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import { SantiagoRuntime } from './runtime.js'
import { SantiagoGameStateValidator, type SantiagoProjectedState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import type { PlaceSpring } from '../actions/placeSpring.js'
import type { PlaceBid } from '../actions/placeBid.js'
import type { RevealTiles } from '../actions/revealTiles.js'
import { nextAction } from './tests/autoplay.js'

const engine = new GameEngine(SantiagoRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, randomizeSpring: boolean, palmTrees = true) {
    return SantiagoRuntime.initializer.initializeGame(
        {
            id: 'santiago-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { randomizeSpring, palmTrees },
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
    // Every option that changes setup or the first actor: the spring's placement and palm trees.
    const setups = [
        [true, true],
        [true, false],
        [false, true],
        [false, false]
    ] as const

    it.each(setups)(
        'honors assigned positions with random spring %s and palm trees %s',
        (randomizeSpring, palmTrees) => {
            const game = createGame(count, randomizeSpring, palmTrees)
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
                expect(state.machineState).toBe(MachineState.TileReveal)
                expect(state.biddingOrder).toEqual(biddingOrder)
                expect(state.activePlayerIds).toEqual([order[1]])
                const reveal: RevealTiles = {
                    id: 'reveal-tiles',
                    gameId: game.id,
                    source: ActionSource.User,
                    playerId: order[1],
                    type: ActionType.RevealTiles
                }
                state = engine.executeCanonicalAction({
                    game: startedGame,
                    state,
                    action: reveal
                }).updatedState
                expect(state.machineState).toBe(MachineState.Bidding)
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
        }
    )

    it.each(setups)(
        'preserves seeded setup with random spring %s and palm trees %s',
        (randomizeSpring, palmTrees) => {
            const game = createGame(count, randomizeSpring, palmTrees)
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
        }
    )

    it('plays a game in an assigned order to a valid result', () => {
        const game = createGame(count, true)
        const ids = game.players.map((player) => player.id)
        const order = [...ids.slice(1), ids[0]]
        const { startedGame, initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        })
        let state: SantiagoProjectedState = initialState
        for (let step = 0; step < 400 && state.machineState !== MachineState.EndOfGame; step++) {
            state = engine.executeCanonicalAction({
                game: startedGame,
                state,
                action: nextAction(state, game.id)
            }).updatedState
        }
        assert(SantiagoGameStateValidator.Check(state), 'Expected canonical state')

        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.seatOrder).toEqual(order)
        expect(() => validateGameResult(state)).not.toThrow()
        const finalScores = SantiagoRuntime.scoring.finalScores(state)
        const best = Math.max(...Object.values(finalScores))
        const leaders = ids.filter((playerId) => finalScores[playerId] === best)
        expect(state.winningPlayerIds.toSorted()).toEqual(leaders.toSorted())
        expect(state.result).toBe(leaders.length > 1 ? GameResult.Draw : GameResult.Win)
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
