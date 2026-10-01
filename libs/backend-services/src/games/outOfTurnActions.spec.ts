import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import {
    ActionSource,
    GameEngine,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type GameAction,
    type GameState,
    type User
} from '@tabletop/common'
import {
    SyntheticDefinition as Definition,
    SyntheticRuntime,
    type Note,
    type Step,
    type Tally
} from './tests/syntheticGame.js'
import { GameService } from './gameService.js'
import { DisallowedActionError, DisallowedUndoError, RacedActionError } from './errors.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'

afterEach(() => vi.restoreAllMocks())

function user(id: string): User {
    return { id, status: UserStatus.Active, roles: [Role.User], externalIds: [] }
}

function createHost() {
    const game = SyntheticRuntime.initializer.initializeGame(
        {
            id: 'standing',
            typeId: Definition.info.id,
            ownerId: 'p1',
            seed: 7,
            config: {},
            players: ['p1', 'p2', 'p3'].map((id) => ({
                id,
                userId: id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    game.status = GameStatus.Started
    const engine = new GameEngine(SyntheticRuntime)
    const initial = SyntheticRuntime.initializer.initializeGameState(game, {
        ...engine.generateUninitializedState(game),
        systemVersion: 3,
        protectedPrng: { seed: 3, invocations: 0 }
    })
    initial.activePlayerIds = [initial.turnManager.startNextTurn(0)]
    let state: GameState = initial.dehydrate()
    const actions: GameAction[] = []
    const store = new FirestoreGameStore(
        RedisCacheService.prototype,
        new Firestore({ projectId: 'out-of-turn-unit-test' })
    )
    const currentGame = (withState: boolean) =>
        structuredClone({ ...game, state: withState ? state : undefined })
    vi.spyOn(store, 'findGameById').mockImplementation(async (_id, withState) =>
        currentGame(withState === true)
    )
    vi.spyOn(store, 'findActionsForGame').mockImplementation(async () => structuredClone(actions))
    vi.spyOn(store, 'findActionRangeForGame').mockImplementation(async ({ startIndex, endIndex }) =>
        structuredClone(actions.slice(startIndex, endIndex))
    )
    vi.spyOn(store, 'readGameData').mockImplementation(async (gameId, read) => {
        const loaded = await store.findGameById(gameId, true)
        if (!loaded) return undefined
        return read({
            game: loaded,
            actions: () => store.findActionsForGame(loaded),
            actionRange: (startIndex, endIndex) =>
                store.findActionRangeForGame({ game: loaded, startIndex, endIndex }),
            undoWindow: async (actionId) => {
                const target = actions.find((action) => action.id === actionId)
                if (!target || target.index === undefined) return undefined
                return {
                    targetAction: structuredClone(target),
                    startIndex: target.index,
                    actions: structuredClone(actions.slice(target.index))
                }
            }
        })
    })
    vi.spyOn(store, 'addActionsToGame').mockImplementation(
        async ({ game: existing, actions: added, state: newState, validator }) => {
            const gameUpdates = {}
            const relatedActions: GameAction[] = []
            const result = await validator(
                currentGame(false),
                structuredClone(state),
                newState,
                added,
                gameUpdates,
                relatedActions
            )
            expect(result).toBe(UpdateValidationResult.Proceed)
            const priorState = state
            actions.push(...structuredClone(added))
            state = structuredClone(newState)
            return {
                storedActions: structuredClone(added),
                updatedGame: { ...existing, ...gameUpdates, state: structuredClone(state) },
                relatedActions,
                priorState
            }
        }
    )
    vi.spyOn(store, 'undoActionsFromGame').mockImplementation(
        async ({ actions: undone, redoneActions, state: newState, validator }) => {
            const gameUpdates = {}
            const result = await validator(
                currentGame(false),
                structuredClone(state),
                structuredClone(undone),
                newState,
                gameUpdates
            )
            expect(result).toBe(UpdateValidationResult.Proceed)
            const priorState = state
            const undoneIds = new Set(undone.map((action) => action.id))
            const retained = actions.filter((action) => !undoneIds.has(action.id))
            const redone = redoneActions.map((action, offset) => ({
                ...structuredClone(action),
                index: retained.length + offset
            }))
            actions.splice(0, actions.length, ...retained, ...redone)
            state = structuredClone(newState)
            return {
                undoneActions: structuredClone(undone),
                updatedGame: { ...game, ...gameUpdates, state: structuredClone(state) },
                redoneActions: redone,
                priorState
            }
        }
    )
    vi.spyOn(UserService.prototype, 'getUser').mockResolvedValue(undefined)
    const unused = vi.fn(async () => {
        throw Error('Unexpected dependency call')
    })
    const tasks: TaskService = {
        createPushTask: unused,
        sendVerificationEmail: unused,
        sendPasswordResetEmail: unused,
        sendAuthVerificationEmail: unused,
        sendAccountChangeNotificationEmail: unused,
        sendGameInvitationEmail: unused,
        sendTurnNotification: unused,
        sendGameEndEmail: unused
    }
    const notifications: NotificationService = {
        addTopicTransport: vi.fn(),
        addTopicListener: unused,
        removeTopicListener: unused,
        addTransport: vi.fn(),
        registerNotificationSubscription: unused,
        unregisterNotificationSubscription: unused,
        sendNotification: vi.fn(async () => {})
    }
    const service = new GameService(
        store,
        UserService.prototype,
        TokenService.prototype,
        tasks,
        notifications,
        RedisCacheService.prototype,
        { [Definition.info.id]: Definition }
    )
    const step = (id: string, playerId: string): Step => ({
        id,
        gameId: game.id,
        type: 'step',
        source: ActionSource.User,
        playerId,
        index: state.actionCount
    })
    const note = (
        id: string,
        playerId: string,
        text: string,
        index = state.actionCount,
        supersedesActionId?: string
    ): Note => ({
        id,
        gameId: game.id,
        type: 'note',
        source: ActionSource.User,
        playerId,
        outOfTurn: true,
        supersedable: true,
        text,
        index,
        ...(supersedesActionId ? { supersedesActionId } : {})
    })
    const tally = (
        id: string,
        playerId: string,
        index = state.actionCount,
        options: { board?: true } = {}
    ): Tally => ({
        id,
        gameId: game.id,
        type: 'tally',
        source: ActionSource.User,
        playerId,
        outOfTurn: true,
        sequenced: true,
        index,
        ...options
    })
    const apply = (action: GameAction) =>
        service.applyActionToGame({ definition: Definition, action, user: user(action.playerId!) })
    const undo = (actionId: string, by: string) =>
        service.undoAction({ definition: Definition, gameId: game.id, actionId, user: user(by) })
    const summary = () => actions.map((action) => `${action.index}:${action.id}`)
    return { game, store, service, step, note, tally, apply, undo, summary, state: () => state }
}

describe('Out-of-turn Actions on the host', () => {
    it('accepts a declaration from a waiting Player and replaces the one it names', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        expect(host.state().activePlayerIds).toEqual(['p2'])
        await host.apply(host.note('n1', 'p3', 'first'))
        expect(host.summary()).toEqual(['0:s1', '1:n1'])
        expect(host.state().activePlayerIds).toEqual(['p2'])

        const undo = vi.mocked(host.store.undoActionsFromGame)
        await expect(host.apply(host.note('dup', 'p3', 'unnamed', 2))).rejects.toBeInstanceOf(
            DisallowedActionError
        )
        await expect(host.apply(host.note('stale', 'p3', 'stale', 2, 's1'))).rejects.toBeInstanceOf(
            DisallowedActionError
        )
        expect(undo).not.toHaveBeenCalled()
        const replaced = await host.apply(host.note('n2', 'p3', 'second', 2, 'n1'))
        expect(undo).toHaveBeenCalledTimes(1)
        expect(host.summary()).toEqual(['0:s1', '1:n2'])
        expect(replaced.actions.map((action) => action.index)).toEqual([1])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p3: 'second' })
        expect(host.state().actionCount).toBe(2)
    })

    it('keeps the declaration when the replacement would be invalid without it', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.note('n1', 'p3', 'first'))
        await expect(host.apply(host.note('n2', 'p3', 'invalid', 2, 'n1'))).rejects.toBeInstanceOf(
            DisallowedActionError
        )
        expect(vi.mocked(host.store.undoActionsFromGame)).not.toHaveBeenCalled()
        expect(host.summary()).toEqual(['0:s1', '1:n1'])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p3: 'first' })
    })

    it('replaces a declaration farther back when the Actions after it did not depend on it', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.note('n1', 'p3', 'first'))
        await host.apply(host.step('s2', 'p2'))
        expect(host.summary()).toEqual(['0:s1', '1:n1', '2:s2'])
        await host.apply(host.note('n2', 'p3', 'second', 3, 'n1'))
        expect(vi.mocked(host.store.undoActionsFromGame)).toHaveBeenCalledTimes(1)
        expect(host.summary()).toEqual(['0:s1', '1:s2', '2:n2'])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p3: 'second' })
        expect(host.state().activePlayerIds).toEqual(['p3'])
    })

    it('appends an unnamed declaration once another Action follows the standing one', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.note('n1', 'p3', 'first'))
        await host.apply(host.step('s2', 'p2'))
        await host.apply(host.note('n2', 'p3', 'second', 1))
        expect(vi.mocked(host.store.undoActionsFromGame)).not.toHaveBeenCalled()
        expect(host.summary()).toEqual(['0:s1', '1:n1', '2:s2', '3:n2'])
    })

    it('does not let a declaration block another Player’s Undo and re-applies it afterwards', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.apply(host.note('n1', 'p1', 'standing'))
        expect(host.summary()).toEqual(['0:s1', '1:s2', '2:n1'])

        await host.undo('s2', 'p2')
        expect(host.summary()).toEqual(['0:s1', '1:n1'])
        expect(host.state().activePlayerIds).toEqual(['p2'])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p1: 'standing' })

        await expect(host.undo('s1', 'p2')).rejects.toBeInstanceOf(DisallowedUndoError)
    })
})

describe('Sequenced Out-of-Turn Actions on the host', () => {
    it('records a commuting race after the Action it raced and reports that Action', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        const result = await host.apply(host.tally('t1', 'p3', 0))
        expect(host.summary()).toEqual(['0:s1', '1:t1'])
        expect(result.actions.map((action) => action.index)).toEqual([1])
        expect(result.missingActions?.map((action) => action.id)).toEqual(['s1'])
        expect(Reflect.get(host.state(), 'tallies')).toEqual({ p3: 1 })
        expect(host.state().activePlayerIds).toEqual(['p2'])
    })

    it('records a turn-taking Action that raced a sequenced one', async () => {
        const host = createHost()
        await host.apply(host.tally('t1', 'p3'))
        const late = host.step('s1', 'p1')
        late.index = 0
        await host.apply(late)
        expect(host.summary()).toEqual(['0:t1', '1:s1'])
    })

    it('rejects a race whose outcome depends on the order', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await expect(host.apply(host.tally('t1', 'p3', 0, { board: true }))).rejects.toBeInstanceOf(
            RacedActionError
        )
        expect(host.summary()).toEqual(['0:s1'])
    })

    it('keeps rejecting stale turn-taking races that involve no sequenced Action', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        const late = host.step('s2', 'p2')
        late.index = 0
        await expect(host.apply(late)).rejects.toThrow('Action index is not valid')
        expect(host.summary()).toEqual(['0:s1'])
    })

    it('blocks another Player’s Undo and is undone only by its own Player', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.tally('t1', 'p3'))
        await expect(host.undo('s1', 'p1')).rejects.toBeInstanceOf(DisallowedUndoError)
        await expect(host.undo('t1', 'p1')).rejects.toBeInstanceOf(DisallowedUndoError)
        await host.undo('t1', 'p3')
        expect(host.summary()).toEqual(['0:s1'])
        expect(Reflect.get(host.state(), 'tallies')).toBeUndefined()
    })
})
