import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import {
    ActionSource,
    assertExists,
    GameEngine,
    PlayerStatus,
    createGameFork,
    GameForkError,
    GameStatus,
    GameStorage,
    UserStatus,
    Role,
    type User
} from '@tabletop/common'
import {
    SyntheticDefinition as Definition,
    SyntheticRuntime,
    type Step,
    type Draw
} from './tests/syntheticGame.js'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'

afterEach(() => vi.restoreAllMocks())

function createSource(systemVersion = 3) {
    const game = SyntheticRuntime.initializer.initializeGame(
        {
            id: 'source',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 101,
            config: {},
            players: ['p1', 'p2', 'p3'].map((id) => ({
                id,
                userId: id === 'p1' ? 'owner' : id,
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
        systemVersion,
        protectedPrng: systemVersion >= 3 ? { seed: 123, invocations: 0 } : undefined
    })
    initial.activePlayerIds = [initial.turnManager.startNextTurn(0)]
    const action: Step = {
        id: 'first-step',
        gameId: game.id,
        type: 'step',
        source: ActionSource.User,
        playerId: initial.activePlayerIds[0]
    }
    const prefix = engine.executeAction({ action, state: initial.dehydrate(), game })
    const secondAction: Step = {
        ...action,
        id: 'second-step',
        playerId: prefix.updatedState.activePlayerIds[0]
    }
    const source = engine.executeAction({ action: secondAction, state: prefix.updatedState, game })
    const actions = [...prefix.processedActions, ...source.processedActions]
    return {
        game,
        engine,
        initial: initial.dehydrate(),
        prefix,
        secondAction,
        state: source.updatedState,
        actions
    }
}

describe('Canonical Fork', () => {
    it.each([1, 2, 3])(
        'preserves version %i state, history, and deterministic continuation',
        (version) => {
            const source = createSource(version)
            const original = structuredClone({
                game: source.game,
                state: source.state,
                actions: source.actions
            })
            const initializer = vi.spyOn(SyntheticRuntime.initializer, 'initializeGameState')
            const fork = createGameFork({ ...source, runtime: SyntheticRuntime, actionIndex: 0 })
            expect(initializer).not.toHaveBeenCalled()
            expect(fork.game.id).not.toBe(source.game.id)
            expect(fork.game.parentId).toBe(source.game.id)
            expect(fork.game).not.toHaveProperty('state')
            expect(fork.state).toEqual({ ...source.prefix.updatedState, gameId: fork.game.id })
            expect(fork.actions[0].id).toBe(source.actions[0].id)
            expect(fork.actions[0].gameId).toBe(fork.game.id)
            const rewound = source.engine.undoProcessedAction({
                action: fork.actions[0],
                state: fork.state
            })
            expect(rewound).toEqual({ ...source.initial, gameId: fork.game.id })
            const replayed = source.engine.applyProcessedAction({
                action: fork.actions[0],
                state: rewound,
                game: fork.game
            })
            expect(replayed).toEqual(fork.state)
            const continuation = source.engine.executeAction({
                action: { ...source.secondAction, gameId: fork.game.id },
                state: fork.state,
                game: fork.game
            })
            expect(continuation.updatedState).toEqual({ ...source.state, gameId: fork.game.id })
            fork.state.drawPile.items.pop()
            expect({ game: source.game, state: source.state, actions: source.actions }).toEqual(
                original
            )
            const start = createGameFork({ ...source, runtime: SyntheticRuntime, actionIndex: -1 })
            expect(start.actions).toEqual([])
            expect(start.state).toEqual({ ...source.initial, gameId: start.game.id })
        }
    )

    it('copies the current position without requiring old patches or old Action schemas', () => {
        const source = createSource()
        delete source.actions[0].undoPatch
        source.actions[0].type = 'retired-action-type'
        Reflect.set(source.state, 'priorActionId', source.actions[0].id)
        const fork = createGameFork({ ...source, runtime: SyntheticRuntime, actionIndex: 1 })
        expect(fork.state).toEqual({ ...source.state, gameId: fork.game.id })
        expect(Reflect.get(fork.state, 'priorActionId')).toBe(fork.actions[0].id)
        expect(fork.actions[0].undoPatch).toBeUndefined()
        expect(() =>
            createGameFork({ ...source, runtime: SyntheticRuntime, actionIndex: -1 })
        ).toThrow(GameForkError)
    })

    it('normalizes root snapshot patches to the fork Game identity', () => {
        const source = createSource()
        source.actions[0].undoPatch = [{ op: 'replace', path: '', value: source.initial }]
        source.actions[0].forwardPatch = [
            { op: 'replace', path: '', value: source.prefix.updatedState }
        ]
        const fork = createGameFork({ ...source, runtime: SyntheticRuntime, actionIndex: 0 })
        expect(
            source.engine.undoProcessedAction({ action: fork.actions[0], state: fork.state })
        ).toEqual({ ...source.initial, gameId: fork.game.id })
        expect(
            source.engine.applyProcessedAction({
                action: fork.actions[0],
                state: { ...source.initial, gameId: fork.game.id },
                game: fork.game
            })
        ).toEqual(fork.state)
    })

    it('includes generated cascade actions and preserves their auction identities', () => {
        const source = createSource()
        const draw: Draw = {
            id: 'draw-token',
            gameId: source.game.id,
            type: 'draw',
            source: ActionSource.User,
            playerId: source.state.activePlayerIds[0],
            revealsInfo: true
        }
        const drawn = source.engine.executeAction({
            action: draw,
            state: source.state,
            game: source.game
        })
        expect(drawn.processedActions.length).toBeGreaterThan(1)
        expect(drawn.updatedState.currentAuction).toBeDefined()
        const actions = [...source.actions, ...drawn.processedActions]
        const fork = createGameFork({
            game: source.game,
            state: drawn.updatedState,
            actions,
            runtime: SyntheticRuntime,
            actionIndex: source.state.actionCount
        })
        expect(fork.state).toEqual({ ...drawn.updatedState, gameId: fork.game.id })
        expect(fork.actions.map((action) => action.id)).toEqual(actions.map((action) => action.id))
    })

    it.each([-2, 0.5, 2, NaN])('rejects invalid fork index %s', (actionIndex) => {
        expect(() =>
            createGameFork({ ...createSource(), runtime: SyntheticRuntime, actionIndex })
        ).toThrow(GameForkError)
    })

    it('reports an incompatible historical schema without exposing canonical data', () => {
        const source = createSource()
        source.actions[1].undoPatch?.push({ op: 'remove', path: '/board' })
        expect(() =>
            createGameFork({ ...source, runtime: SyntheticRuntime, actionIndex: 0 })
        ).toThrow('This game cannot be forked from that position.')
    })
})

function createService(source: ReturnType<typeof createSource>) {
    const store = new FirestoreGameStore(
        RedisCacheService.prototype,
        new Firestore({ projectId: 'fork-unit-test' })
    )
    const reads = vi
        .spyOn(store, 'findGameById')
        .mockImplementation(async (_id, withState) =>
            structuredClone({ ...source.game, state: withState ? source.state : undefined })
        )
    vi.spyOn(store, 'findActionsForGame').mockImplementation(async () =>
        structuredClone(source.actions)
    )
    const writes = vi
        .spyOn(store, 'writeFullGameData')
        .mockImplementation(async (game, state, actions) => ({
            storedGame: structuredClone(game),
            storedGameState: structuredClone(state),
            storedActions: structuredClone(actions)
        }))
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
    return { service, store, reads, writes, notifications }
}

const owner: User = { id: 'owner', status: UserStatus.Active, roles: [Role.User], externalIds: [] }

describe('Hosted Fork service', () => {
    it('rejects an incomplete Undo result before persistence', async () => {
        const source = createSource()
        const { service, store } = createService(source)
        source.actions[0].undoPatch?.push({ op: 'remove', path: '/board' })
        vi.spyOn(store, 'findUndoActionWindow').mockResolvedValue({
            targetAction: source.actions[0],
            startIndex: 0,
            actions: source.actions
        })
        const write = vi.spyOn(store, 'undoActionsFromGame')
        await expect(
            service.undoAction({
                definition: {
                    ...Definition,
                    runtime: { ...SyntheticRuntime, visibility: undefined }
                },
                user: { ...owner, roles: [Role.Admin] },
                gameId: source.game.id,
                actionId: source.actions[0].id
            })
        ).rejects.toThrow('Complete canonical state is required')
        expect(write).not.toHaveBeenCalled()
    })

    it('rejects invalid administrative state replacement before persistence', async () => {
        const source = createSource()
        const { service } = createService(source)
        const write = vi
            .spyOn(FirestoreGameStore.prototype, 'setGameState')
            .mockResolvedValue(undefined)
        Reflect.deleteProperty(source.state, 'board')
        await expect(service.setGameState(source.state)).rejects.toThrow(
            'Complete canonical state is required'
        )
        expect(write).not.toHaveBeenCalled()
    })

    it('validates the current Host View without requiring compatible history', async () => {
        const source = createSource()
        source.actions[0].undoPatch?.push({ op: 'remove', path: '/board' })
        const { service } = createService(source)
        const admin = { ...owner, roles: [Role.Admin] }
        await expect(
            service.getGameForUser({ gameId: source.game.id, user: admin, hostView: true })
        ).resolves.toBeDefined()
        Reflect.deleteProperty(source.state, 'board')
        await expect(
            service.getGameForUser({ gameId: source.game.id, user: admin, hostView: true })
        ).rejects.toThrow('Complete canonical state is required')
    })

    it.each([true, false])(
        'uses stored canonical state with visibility registration %s',
        async (visible) => {
            const source = createSource()
            const { service, reads, writes, notifications } = createService(source)
            const definition = {
                ...Definition,
                runtime: {
                    ...SyntheticRuntime,
                    visibility: visible ? SyntheticRuntime.visibility : undefined
                }
            }
            const game = await service.forkGame({
                definition,
                gameId: source.game.id,
                actionIndex: 0,
                name: 'Fork',
                owner
            })
            expect(reads).toHaveBeenCalledWith(source.game.id, true)
            const written = writes.mock.calls[0]
            assertExists(written, 'Expected fork persistence')
            expect(written[1]).toEqual({ ...source.prefix.updatedState, gameId: game.id })
            expect(game.status).toBe(GameStatus.WaitingForPlayers)
            expect(game.storage).toBe(GameStorage.Remote)
            expect(game.players.map((p) => p.status)).toEqual([
                PlayerStatus.Joined,
                PlayerStatus.Reserved,
                PlayerStatus.Reserved
            ])
            expect(game).not.toHaveProperty('state')
            expect(notifications.sendNotification).toHaveBeenCalledOnce()
        }
    )

    it('does not write or announce a fork when reconstruction fails', async () => {
        const source = createSource()
        source.actions[1].undoPatch?.push({ op: 'remove', path: '/board' })
        const { service, writes, notifications } = createService(source)
        await expect(
            service.forkGame({
                definition: Definition,
                gameId: source.game.id,
                actionIndex: 0,
                owner
            })
        ).rejects.toThrow(GameForkError)
        expect(writes).not.toHaveBeenCalled()
        expect(notifications.sendNotification).not.toHaveBeenCalled()
    })
})
