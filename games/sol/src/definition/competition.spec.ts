import {
    defaultGameConfig,
    validateGameResult,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './gameDefinition.js'
import { SolRuntime } from './runtime.js'
import { SolInfo } from './info.js'
import { MachineState } from './states.js'

const engine = new GameEngine(SolRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count = 4) {
    return SolRuntime.initializer.initializeGame(
        {
            id: 'sol-competition',
            typeId: 'sol',
            ownerId: 'owner',
            seed: 101,
            config: defaultGameConfig(SolInfo.configurator?.options ?? []),
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

describe('Sol competition', () => {
    it('supports assigned order and preserves seed-only calls', () => {
        const game = createGame()
        const ordinaryEngine = new GameEngine(SolRuntime)
        const playerIds = ['p3', 'p1', 'p0', 'p2']
        const assigned = ordinaryEngine.startGame(game, {
            startingPositions: { playerIds },
            masterSeed
        }).initialState
        expect(assigned.turnManager.turnOrder).toEqual(playerIds)
        expect(assigned.activePlayerIds).toEqual([playerIds[0]])
        const legacy = ordinaryEngine.startGame(game, masterSeed).initialState
        const options = ordinaryEngine.startGame(game, { masterSeed }).initialState
        expect({ ...options, id: legacy.id }).toEqual(legacy)
    })
    it.each([2, 3, 4, 5])('assigns seating and the first actor for %i players', (count) => {
        const game = createGame(count)
        const ids = game.players.map((player) => player.id)
        for (let offset = 0; offset < count; offset++) {
            const playerIds = [...ids.slice(offset), ...ids.slice(0, offset)]
            const { initialState, startedGame } = engine.startGame(game, {
                startingPositions: { playerIds },
                masterSeed: masterSeed
            })
            expect(initialState.players.map((player) => player.playerId)).toEqual(playerIds)
            expect(initialState.turnManager.turnOrder).toEqual(playerIds)
            expect(initialState.activePlayerIds).toEqual([playerIds[0]])
            expect(initialState.turnManager.series[0].playerId).toBe(playerIds[0])
            const positions = count === 5 ? 16 : 13
            const spacing = count === 2 ? 6 : count === 3 ? 4 : 3
            for (let index = 1; index < count; index++) {
                expect(
                    (initialState.board.motherships[playerIds[index]] -
                        initialState.board.motherships[playerIds[index - 1]] +
                        positions) %
                        positions
                ).toBe(spacing)
            }
            expect(startedGame.protectedInformation).toBe(true)
            expect(game.startedAt).toBeUndefined()
        }
    })

    it('reproduces complete setup and preserves ordinary setup when its random order is assigned', () => {
        const game = createGame()
        const normal = engine.startGame(game, masterSeed).initialState
        const assignment = { playerIds: normal.turnManager.turnOrder }
        const first = engine.startGame(game, {
            startingPositions: assignment,
            masterSeed: masterSeed
        }).initialState
        const second = engine.startGame(game, {
            startingPositions: assignment,
            masterSeed: masterSeed
        }).initialState
        expect({ ...first, id: normal.id }).toEqual(normal)
        expect({ ...second, id: first.id }).toEqual(first)
        const reversed = engine.startGame(game, {
            startingPositions: { playerIds: [...assignment.playerIds].reverse() },
            masterSeed: masterSeed
        }).initialState
        expect(
            reversed.players.map((player) => [player.playerId, player.color]).toSorted()
        ).toEqual(normal.players.map((player) => [player.playerId, player.color]).toSorted())
        expect(reversed.deck).toEqual(normal.deck)
        expect(reversed.prng).toEqual(normal.prng)
    })

    it('preserves hidden-information projections for every player and spectators', () => {
        const game = createGame()
        const state = engine.startGame(game, {
            startingPositions: { playerIds: ['p3', 'p1', 'p0', 'p2'] },
            masterSeed: masterSeed
        }).initialState
        for (const perspective of [
            { kind: 'spectator' } as const,
            ...game.players.map((player) => ({ kind: 'player', playerId: player.id }) as const)
        ]) {
            const view = SolRuntime.visibility.state.project(state, perspective, {
                config: game.config
            })
            expect(view).not.toHaveProperty('masterSeed')
            expect(view.deck.items).toEqual([])
            expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(view.turnManager.turnOrder).toEqual(state.turnManager.turnOrder)
            expect(() => SolRuntime.hydrator.hydrateState(view)).not.toThrow()
            expect(() => validateGameResult(view)).toThrow('Game has no final result')
        }
    })

    it.each([{ momentum: [9, 4, 2, 0] }, { momentum: [9, 9, 2, 0] }])(
        'extracts actual terminal wins from momentum $momentum',
        ({ momentum }) => {
            const game = createGame()
            const state = SolRuntime.hydrator.hydrateState(
                engine.startGame(game, {
                    startingPositions: { playerIds: ['p0', 'p1', 'p2', 'p3'] },
                    masterSeed: masterSeed
                }).initialState
            )
            state.players.forEach((player, index) => {
                player.momentum = momentum[index]
            })
            state.machineState = MachineState.EndOfGame
            SolRuntime.stateHandlers[MachineState.EndOfGame].enter(
                new MachineContext({ gameState: state, gameConfig: game.config })
            )
            const winners = momentum[0] === momentum[1] ? ['p0', 'p1'] : ['p0']
            expect(state.result).toBe(winners.length === 1 ? GameResult.Win : GameResult.Draw)
            expect(state.winningPlayerIds).toEqual(winners)
            expect(() => validateGameResult(state.dehydrate())).not.toThrow()
        }
    )

    it('rejects invalid setup and runtime publications without the capability', () => {
        const game = createGame()
        expect(() =>
            engine.startGame(game, { startingPositions: { playerIds: ['p0', 'p0', 'p2', 'p3'] } })
        ).toThrow('Invalid starting position')
        expect(() =>
            engine.startGame(game, {
                startingPositions: { playerIds: ['p0', 'p1', 'p2', 'outsider'] }
            })
        ).toThrow('every player')
        expect(() =>
            engine.startGame(game, { startingPositions: { playerIds: ['p0', 'p1'] } })
        ).toThrow('every player')
        const oldEngine = new GameEngine({
            ...SolRuntime,
            initializer: {
                initializeGame: (game, definition) =>
                    SolRuntime.initializer.initializeGame(game, definition),
                initializeGameState: (game, state) =>
                    SolRuntime.initializer.initializeGameState(game, state)
            }
        })
        expect(() =>
            oldEngine.startGame(game, {
                startingPositions: {
                    playerIds: game.players.map((player) => player.id)
                }
            })
        ).toThrow('does not support assigned starting positions')
        expect(() => oldEngine.startGame(game, masterSeed)).not.toThrow()
    })
})
