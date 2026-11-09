import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    validateGameResult,
    type Game
} from '@tabletop/common'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { MedinaRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(MedinaRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number): Game {
    return MedinaRuntime.initializer.initializeGame(
        {
            id: 'medina-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: {},
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

function seatOrders(playerIds: string[]): string[][] {
    const rotations = (ids: string[]) =>
        ids.map((_, offset) => [...ids.slice(offset), ...ids.slice(0, offset)])
    return [...rotations(playerIds), ...rotations(playerIds.toReversed())]
}

function placeNextWall(game: Game, state: MedinaProjectedState): MedinaProjectedState {
    const hydrated = new HydratedMedinaGameState(structuredClone(state))
    const [playerId] = hydrated.activePlayerIds
    assertExists(playerId, 'Expected an acting player')
    const section = hydrated.wallSections()[0]
    assertExists(section, 'Expected an open wall section')
    return engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: `wall-${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: ActionType.PlaceWall,
            ...section
        }
    }).updatedState
}

describe.each([2, 3, 4])('Medina tournaments with %i players', (count) => {
    it('starts with seat one and follows the assigned seats', () => {
        const game = createGame(count)
        for (const order of seatOrders(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            let state = initialState
            let seen = 0
            let current = state.activePlayerIds[0]
            expect(current).toBe(order[0])
            while (seen < order.length - 1) {
                state = placeNextWall(game, state)
                if (state.activePlayerIds[0] !== current) {
                    seen += 1
                    current = state.activePlayerIds[0]
                    expect(current).toBe(order[seen])
                }
            }
        }
    })

    it('keeps the ordinary seeded setup apart from who sits where', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            MedinaRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        for (const order of seatOrders(game.players.map((player) => player.id))) {
            const assigned = initialize(order)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
        }
    })

    it('records a valid result for a finished assigned game', () => {
        const game = createGame(count)
        const order = game.players.map((player) => player.id).toReversed()
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        })
        const hydrated = new HydratedMedinaGameState(structuredClone(initialState))
        for (const player of hydrated.players) {
            player.buildings = { grey: 0, purple: 0, brown: 0, orange: 0 }
            player.rooftops = 0
            player.neutralRooftops = 0
            player.stables = 0
            player.merchants = 0
            player.walls = 1
        }
        let state: MedinaProjectedState = hydrated.dehydrate()
        let steps = 0
        while (state.machineState !== MachineState.EndOfGame) {
            expect(steps++).toBeLessThan(8)
            state = placeNextWall(game, state)
        }
        expect(() => validateGameResult(state)).not.toThrow()
        expect(MedinaRuntime.scoring.finalScores(state)).toEqual(
            Object.fromEntries(order.map((id) => [id, expect.any(Number)]))
        )
    })
})
