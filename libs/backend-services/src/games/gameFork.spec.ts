import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists, GameEngine, PlayerStatus } from '@tabletop/common'
import {
    ActionType,
    CellType,
    Definition,
    FreshFishRuntime,
    type PlaceDisk
} from '@tabletop/fresh-fish'
import { reconstructForkHistory } from './gameFork.js'

describe('Hosted Fork reconstruction', () => {
    it.each([1, 2, 3])(
        'rewinds version %i initialization before replaying rewritten records',
        (systemVersion) => {
            const game = FreshFishRuntime.initializer.initializeGame(
                {
                    id: 'source',
                    typeId: Definition.info.id,
                    ownerId: 'owner',
                    seed: 101,
                    players: ['p1', 'p2', 'p3'].map((id) => ({
                        id,
                        name: id,
                        isHuman: false,
                        status: PlayerStatus.Joined
                    }))
                },
                Definition
            )
            const engine = new GameEngine(FreshFishRuntime)
            const initial = FreshFishRuntime.initializer.initializeGameState(game, {
                ...engine.generateUninitializedState(game),
                systemVersion,
                protectedPrng: systemVersion >= 3 ? { seed: 123, invocations: 0 } : undefined
            })
            const playerId = initial.turnManager.startNextTurn(0)
            initial.activePlayerIds = [playerId]
            const empty = [...initial.board].find(({ cell }) => cell.type === CellType.Empty)
            if (empty === undefined) throw Error('Expected an empty board cell')
            const action: PlaceDisk = {
                id: 'place-disk',
                gameId: game.id,
                type: ActionType.PlaceDisk,
                source: ActionSource.User,
                playerId,
                coords: empty.coords
            }
            const prefix = engine.executeAction({ action, state: initial.dehydrate(), game })
            const nextState = FreshFishRuntime.hydrator.hydrateState(prefix.updatedState)
            const nextEmpty = [...nextState.board].find(({ cell }) => cell.type === CellType.Empty)
            assertExists(nextEmpty, 'Expected another empty cell')
            const secondAction: PlaceDisk = {
                ...action,
                id: 'second-disk',
                playerId: nextState.activePlayerIds[0],
                coords: nextEmpty.coords
            }
            const source = engine.executeAction({
                action: secondAction,
                state: prefix.updatedState,
                game
            })
            const actions = [...prefix.processedActions, ...source.processedActions]
            const original = structuredClone(source)
            const fork = { ...game, id: 'fork' }
            const unrelatedInitial = engine.startGame(fork).initialState
            const rebuilt = reconstructForkHistory({
                engine,
                game: fork,
                initialState: unrelatedInitial,
                canonicalState: source.updatedState,
                actions,
                actionIndex: 0
            })
            expect(rebuilt.state).toEqual({
                ...prefix.updatedState,
                id: unrelatedInitial.id,
                gameId: fork.id,
                actionChecksum: rebuilt.state.actionChecksum
            })
            expect(rebuilt.actions[0]?.id).not.toBe(action.id)
            expect(rebuilt.actions[0]?.gameId).toBe(fork.id)
            expect(rebuilt.state.actionChecksum).not.toBe(source.updatedState.actionChecksum)
            expect(source).toEqual(original)
            const rebuiltAction = rebuilt.actions[0]
            assertExists(rebuiltAction, 'Expected a rebuilt Action')
            const rewound = engine.undoProcessedAction({
                action: rebuiltAction,
                state: rebuilt.state
            })
            expect(rewound).toEqual({
                ...initial.dehydrate(),
                id: unrelatedInitial.id,
                gameId: fork.id
            })
            const beforeActions = reconstructForkHistory({
                engine,
                game: fork,
                initialState: unrelatedInitial,
                canonicalState: source.updatedState,
                actions,
                actionIndex: -1
            })
            expect(beforeActions.actions).toEqual([])
            expect(beforeActions.state).toEqual(rewound)
        }
    )
})
