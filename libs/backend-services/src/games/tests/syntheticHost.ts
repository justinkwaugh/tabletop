import { expect, vi } from 'vitest'
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
    type Draw,
    type Note,
    type Step,
    type Tally
} from './syntheticGame.js'
import { GameService } from '../gameService.js'
import { FirestoreGameStore } from '../../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import { UserService } from '../../users/userService.js'
import { TokenService } from '../../tokens/tokenService.js'
import { UpdateValidationResult } from '../../persistence/stores/validator.js'
import type { TaskService } from '../../tasks/taskService.js'
import type { NotificationService } from '../../notifications/notificationService.js'

export function syntheticUser(id: string): User {
    return { id, status: UserStatus.Active, roles: [Role.User], externalIds: [] }
}

export function createSyntheticHost({ activeSeats = 1 } = {}) {
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
    const firstPlayerId = initial.turnManager.startNextTurn(0)
    const waitingPlayerIds = game.players
        .map((player) => player.id)
        .filter((playerId) => playerId !== firstPlayerId)
    initial.activePlayerIds = [firstPlayerId, ...waitingPlayerIds].slice(0, activeSeats)
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
                relatedActions,
                []
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
            Object.assign(game, gameUpdates)
            return {
                undoneActions: structuredClone(undone),
                updatedGame: { ...game, ...gameUpdates, state: structuredClone(state) },
                redoneActions: redone,
                priorState
            }
        }
    )
    vi.spyOn(store, 'updateGame').mockImplementation(async ({ fields, validator }) => {
        const existing = currentGame(false)
        const fieldsToUpdate = structuredClone(fields)
        if (validator?.(existing, fieldsToUpdate) === UpdateValidationResult.Cancel) {
            return [existing, [], existing]
        }
        Object.assign(game, fieldsToUpdate)
        return [currentGame(false), Object.keys(fieldsToUpdate), existing]
    })
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
    const draw = (id: string, playerId: string): Draw => ({
        id,
        gameId: game.id,
        type: 'draw',
        source: ActionSource.User,
        playerId,
        revealsInfo: true,
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
        service.applyActionToGame({
            definition: Definition,
            action,
            user: syntheticUser(action.playerId!)
        })
    const undo = (actionId: string, by: string) =>
        service.undoAction({
            definition: Definition,
            gameId: game.id,
            actionId,
            user: syntheticUser(by)
        })
    const summary = () => actions.map((action) => `${action.index}:${action.id}`)
    return {
        game,
        store,
        tasks,
        notifications,
        service,
        step,
        draw,
        note,
        tally,
        apply,
        undo,
        summary,
        state: () => state
    }
}
