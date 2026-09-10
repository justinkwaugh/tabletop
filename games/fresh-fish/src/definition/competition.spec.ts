import {
    ActionSource,
    assertExists,
    defaultGameConfig,
    normalizeGameConfig,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { PlaceDisk } from '../actions/placeDisk.js'
import { CellType } from '../components/cells.js'
import { ActionType } from './actions.js'
import { Definition } from './gameDefinition.js'
import type { FreshFishGameConfig } from './gameConfig.js'
import { FreshFishInfo } from './info.js'
import { FreshFishRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FreshFishRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, config: FreshFishGameConfig = {}) {
    return FreshFishRuntime.initializer.initializeGame(
        {
            id: 'fresh-fish-competition',
            typeId: FreshFishInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(FreshFishInfo.configurator?.options ?? []),
                ...config
            }),
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

describe.each([2, 3, 4, 5])('Fresh Fish tournaments with %i players', (count) => {
    it('honors every starting seat through actual first-round turns', () => {
        const game = createGame(count)
        const playerIds = game.players.map((player) => player.id)
        for (let offset = 0; offset < count; offset++) {
            const order = [...playerIds.slice(offset), ...playerIds.slice(0, offset)]
            const { initialState, startedGame } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            let state = initialState
            expect(state.turnManager.turnOrder).toEqual(order)
            expect(startedGame.protectedInformation).toBe(true)
            for (const playerId of order) {
                expect(state.activePlayerIds).toEqual([playerId])
                const hydrated = FreshFishRuntime.hydrator.hydrateState(state)
                const cell = [...hydrated.board].find(({ cell }) => cell.type === CellType.Empty)
                assertExists(cell, 'Expected an empty cell for the first disk')
                const action: PlaceDisk = {
                    id: `disk-${playerId}`,
                    gameId: game.id,
                    source: ActionSource.User,
                    type: ActionType.PlaceDisk,
                    playerId,
                    coords: cell.coords
                }
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.activePlayerIds).toEqual([order[0]])
        }
    })

    it.each([false, true])(
        'preserves ordinary seeded setup and options (variant %s)',
        (variant) => {
            const game = createGame(count, {
                auctioneerWinsTie: variant,
                forceThreeDisks: !variant,
                ...(variant ? { boardSeed: 0 } : {})
            })
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (playerIds?: string[]) =>
                FreshFishRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        playerIds ? { playerIds } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
            const order = [...normal.turnManager.turnOrder].reverse()
            const assigned = initialize(order)
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            if (variant) expect(assigned.boardSeed).toBe(0)
            for (const perspective of [
                ...order.map((playerId) => ({ kind: 'player', playerId }) as const),
                { kind: 'spectator' } as const
            ]) {
                const projected = FreshFishRuntime.visibility.state.project(assigned, perspective)
                expect(projected.turnManager.turnOrder).toEqual(order)
                expect(projected.tileBag.items).toEqual([])
                expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            }
        }
    )

    it.each([false, true])(
        'records the terminal winners used by tournament scoring (tie %s)',
        (tied) => {
            const game = createGame(count)
            const state = FreshFishRuntime.hydrator.hydrateState(
                engine.startGame(game, {
                    masterSeed,
                    startingPositions: {
                        playerIds: game.players.map((player) => player.id).reverse()
                    }
                }).initialState
            )
            state.players.forEach((player, index) => {
                player.money = index === 0 || (tied && index === 1) ? 15 : 10
            })
            state.machineState = MachineState.EndOfGame
            FreshFishRuntime.stateHandlers[MachineState.EndOfGame].enter(
                new MachineContext({ gameState: state, gameConfig: game.config })
            )
            expect(state.result).toBe(tied ? GameResult.Draw : GameResult.Win)
            expect(state.winningPlayerIds).toEqual(tied ? ['p0', 'p1'] : ['p0'])
            expect(() => validateGameResult(state.dehydrate())).not.toThrow()
        }
    )
})
