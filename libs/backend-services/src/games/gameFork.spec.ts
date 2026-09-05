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
    ActionType,
    CellType,
    Definition,
    FreshFishRuntime,
    TileType,
    type DrawTile,
    type PlaceDisk
} from '@tabletop/fresh-fish'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'

afterEach(() => vi.restoreAllMocks())

function createSource(systemVersion = 3) {
    const game = FreshFishRuntime.initializer.initializeGame(
        {
            id: 'source',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 101,
            config: { forceThreeDisks: false },
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
    const engine = new GameEngine(FreshFishRuntime)
    const initial = FreshFishRuntime.initializer.initializeGameState(game, {
        ...engine.generateUninitializedState(game),
        systemVersion,
        protectedPrng: systemVersion >= 3 ? { seed: 123, invocations: 0 } : undefined
    })
    initial.activePlayerIds = [initial.turnManager.startNextTurn(0)]
    const firstCell = [...initial.board].find(({ cell }) => cell.type === CellType.Empty)
    assertExists(firstCell, 'Expected an empty cell')
    const action: PlaceDisk = {
        id: 'place-disk',
        gameId: game.id,
        type: ActionType.PlaceDisk,
        source: ActionSource.User,
        playerId: initial.activePlayerIds[0],
        coords: firstCell.coords
    }
    const prefix = engine.executeAction({ action, state: initial.dehydrate(), game })
    const nextState = FreshFishRuntime.hydrator.hydrateState(prefix.updatedState)
    const secondCell = [...nextState.board].find(({ cell }) => cell.type === CellType.Empty)
    assertExists(secondCell, 'Expected another empty cell')
    const secondAction: PlaceDisk = {
        ...action,
        id: 'second-disk',
        playerId: nextState.activePlayerIds[0],
        coords: secondCell.coords
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
            const initializer = vi.spyOn(FreshFishRuntime.initializer, 'initializeGameState')
            const fork = createGameFork({ ...source, runtime: FreshFishRuntime, actionIndex: 0 })
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
            fork.state.tileBag.items.pop()
            expect({ game: source.game, state: source.state, actions: source.actions }).toEqual(
                original
            )
            const start = createGameFork({ ...source, runtime: FreshFishRuntime, actionIndex: -1 })
            expect(start.actions).toEqual([])
            expect(start.state).toEqual({ ...source.initial, gameId: start.game.id })
        }
    )

    it('copies the current position without requiring old patches or old Action schemas', () => {
        const source = createSource()
        delete source.actions[0].undoPatch
        source.actions[0].type = 'retired-action-type'
        Reflect.set(source.state, 'priorActionId', source.actions[0].id)
        const fork = createGameFork({ ...source, runtime: FreshFishRuntime, actionIndex: 1 })
        expect(fork.state).toEqual({ ...source.state, gameId: fork.game.id })
        expect(Reflect.get(fork.state, 'priorActionId')).toBe(fork.actions[0].id)
        expect(fork.actions[0].undoPatch).toBeUndefined()
        expect(() =>
            createGameFork({ ...source, runtime: FreshFishRuntime, actionIndex: -1 })
        ).toThrow(GameForkError)
    })

    it('normalizes root snapshot patches to the fork Game identity', () => {
        const source = createSource()
        source.actions[0].undoPatch = [{ op: 'replace', path: '', value: source.initial }]
        source.actions[0].forwardPatch = [
            { op: 'replace', path: '', value: source.prefix.updatedState }
        ]
        const fork = createGameFork({ ...source, runtime: FreshFishRuntime, actionIndex: 0 })
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

    it('includes the real DrawTile cascade and preserves generated auction identities', () => {
        const source = createSource()
        const hydrated = FreshFishRuntime.hydrator.hydrateState(source.state)
        const cell = [...hydrated.board].find(({ cell }) => cell.type === CellType.Empty)
        assertExists(cell, 'Expected another empty cell')
        const thirdDisk: PlaceDisk = {
            ...source.secondAction,
            id: 'third-disk',
            playerId: hydrated.activePlayerIds[0],
            coords: cell.coords
        }
        const third = source.engine.executeAction({
            action: thirdDisk,
            state: source.state,
            game: source.game
        })
        const bag = third.updatedState.tileBag.items
        const stallIndex = bag.findIndex((tile) => tile.type === TileType.Stall)
        const stall = bag.splice(stallIndex, 1)[0]
        assertExists(stall, 'Expected a stall tile')
        bag.push(stall)
        const draw: DrawTile = {
            id: 'draw-stall',
            gameId: source.game.id,
            type: ActionType.DrawTile,
            source: ActionSource.User,
            playerId: third.updatedState.activePlayerIds[0],
            revealsInfo: true
        }
        const drawn = source.engine.executeAction({
            action: draw,
            state: third.updatedState,
            game: source.game
        })
        expect(drawn.processedActions.length).toBeGreaterThan(1)
        expect(drawn.updatedState.currentAuction).toBeDefined()
        const actions = [...source.actions, ...third.processedActions, ...drawn.processedActions]
        const fork = createGameFork({
            game: source.game,
            state: drawn.updatedState,
            actions,
            runtime: FreshFishRuntime,
            actionIndex: third.updatedState.actionCount
        })
        expect(fork.state).toEqual({ ...drawn.updatedState, gameId: fork.game.id })
        expect(fork.actions.map((action) => action.id)).toEqual(actions.map((action) => action.id))
    })

    it.each([-2, 0.5, 2, NaN])('rejects invalid fork index %s', (actionIndex) => {
        expect(() =>
            createGameFork({ ...createSource(), runtime: FreshFishRuntime, actionIndex })
        ).toThrow(GameForkError)
    })

    it('reports an incompatible historical schema without exposing canonical data', () => {
        const source = createSource()
        source.actions[1].undoPatch?.push({ op: 'remove', path: '/board' })
        expect(() =>
            createGameFork({ ...source, runtime: FreshFishRuntime, actionIndex: 0 })
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
    return { service, reads, writes, notifications }
}

const owner: User = { id: 'owner', status: UserStatus.Active, roles: [Role.User], externalIds: [] }

describe('Hosted Fork service', () => {
    it.each([true, false])(
        'uses stored canonical state with visibility registration %s',
        async (visible) => {
            const source = createSource()
            const { service, reads, writes, notifications } = createService(source)
            const definition = {
                ...Definition,
                runtime: {
                    ...FreshFishRuntime,
                    visibility: visible ? FreshFishRuntime.visibility : undefined
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
