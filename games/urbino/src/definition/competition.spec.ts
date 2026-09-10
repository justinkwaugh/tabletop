import {
    ActionSource,
    defaultGameConfig,
    validateGameResult,
    GameEngine,
    MachineContext,
    PlayerStatus
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './definition.js'
import { UrbinoRuntime } from './runtime.js'
import { UrbinoInfo } from './info.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import type { PlaceArchitect } from '../actions/placeArchitect.js'
import type { ChooseFirstPlayer } from '../actions/chooseFirstPlayer.js'

const engine = new GameEngine(UrbinoRuntime)
function createGame() {
    return UrbinoRuntime.initializer.initializeGame(
        {
            id: 'urbino-competition',
            typeId: 'urbino',
            ownerId: 'owner',
            seed: 101,
            config: defaultGameConfig(UrbinoInfo.configurator?.options ?? []),
            players: ['p0', 'p1'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

describe('Urbino competition', () => {
    it.each([
        ['p0', 'p1'],
        ['p1', 'p0']
    ])(
        'assigns architect placement and preserves the first position’s choice: %s, %s',
        (first, second) => {
            const game = createGame()
            let state = engine.startGame(game, {
                startingPositions: {
                    playerIds: [first, second]
                }
            }).initialState
            expect(state.turnManager.turnOrder).toEqual([first, second])
            expect(state.players.map((player) => player.playerId)).toEqual([first, second])
            expect(state.activePlayerIds).toEqual([first])
            for (const [index, playerId] of [first, second].entries()) {
                expect(state.activePlayerIds).toEqual([playerId])
                const action: PlaceArchitect = {
                    id: `architect-${index}`,
                    gameId: game.id,
                    source: ActionSource.User,
                    type: ActionType.PlaceArchitect,
                    playerId,
                    position: index
                }
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
            }
            expect(state.machineState).toBe(MachineState.ChoosingFirstPlayer)
            expect(state.activePlayerIds).toEqual([first])
            const action: ChooseFirstPlayer = {
                id: 'choose-first',
                gameId: game.id,
                source: ActionSource.User,
                type: ActionType.ChooseFirstPlayer,
                playerId: first,
                startingPlayerId: second
            }
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
            expect(state.activePlayerIds).toEqual([second])
            expect(state.turnManager.series[0].playerId).toBe(second)
        }
    )

    it('preserves seeded ordinary setup, player identity, and colors', () => {
        const game = createGame()
        const uninitialized = engine.generateUninitializedState(game)
        const normal = UrbinoRuntime.initializer
            .initializeGameState(game, structuredClone(uninitialized))
            .dehydrate()
        const assigned = UrbinoRuntime.initializer
            .initializeGameState(game, structuredClone(uninitialized), {
                playerIds: normal.turnManager.turnOrder
            })
            .dehydrate()
        expect(assigned).toEqual(normal)
        const reversedIds = [...normal.turnManager.turnOrder].reverse()
        const reversed = UrbinoRuntime.initializer
            .initializeGameState(game, structuredClone(uninitialized), { playerIds: reversedIds })
            .dehydrate()
        expect(
            reversed.players.map((player) => [player.playerId, player.color]).toSorted()
        ).toEqual(normal.players.map((player) => [player.playerId, player.color]).toSorted())
        expect(
            UrbinoRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), {
                    playerIds: reversedIds
                })
                .dehydrate()
        ).toEqual(reversed)
        expect(reversed.prng).toEqual(normal.prng)
    })

    it.each([false, true])('extracts declared terminal winners with a tied score: %s', (tied) => {
        const game = createGame()
        const state = UrbinoRuntime.hydrator.hydrateState(
            engine.startGame(game, { startingPositions: { playerIds: ['p1', 'p0'] } }).initialState
        )
        state.players[0].score = 10
        state.players[1].score = tied ? 10 : 4
        state.machineState = MachineState.EndOfGame
        UrbinoRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: game.config })
        )
        expect(state.winningPlayerIds).toEqual(tied ? ['p1', 'p0'] : ['p1'])
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
    })
})
