import {
    ActionSource,
    assertExists,
    calculateActionChecksum,
    GameNotificationAction,
    GameStatus,
    GameStorage,
    GameUpdateNotification,
    GameAddActionsNotification,
    GameAddProjectedActionsNotification,
    GameReplaceProjectedActionsNotification,
    GameUndoActionNotification,
    NotificationCategory,
    PlayerStatus,
    Visibility,
    GameState,
    type Game
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'
import {
    createGameNotification,
    publishActionResults,
    publishUndoResults
} from './gameNotifications.js'

const GAME_ID = 'notification-game'

type NotificationPublication = Parameters<NotificationService['sendNotification']>[0]

function createState(actionCount = 0, actionChecksum = 0) {
    return {
        id: 'state-1',
        gameId: GAME_ID,
        players: [],
        activePlayerIds: ['player-1'],
        actionCount,
        actionChecksum,
        prng: { seed: 1, invocations: 0 },
        machineState: 'playing',
        turnManager: { series: [], turnOrder: [], turnCounts: {} },
        winningPlayerIds: []
    }
}

function createGame(): Game {
    return {
        id: GAME_ID,
        typeId: 'notification-test',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'user-1',
        name: 'Notification Test',
        players: [
            {
                id: 'player-1',
                userId: 'user-1',
                name: 'Player 1',
                isHuman: true,
                status: PlayerStatus.Joined
            },
            {
                id: 'player-2',
                userId: 'user-2',
                name: 'Player 2',
                isHuman: true,
                status: PlayerStatus.Joined
            },
            {
                id: 'player-3',
                name: 'Automated Player',
                isHuman: false,
                status: PlayerStatus.Joined
            }
        ],
        config: {},
        hotseat: false,
        state: createState(),
        createdAt: new Date('2026-09-03T00:00:00.000Z'),
        winningPlayerIds: [],
        seed: 17,
        storage: GameStorage.Remote
    }
}

function createActionCascade() {
    const before = createState()
    const userAction = {
        id: 'action-1',
        gameId: GAME_ID,
        source: ActionSource.User,
        type: 'placeBid',
        playerId: 'player-1',
        amount: 7,
        index: 0,
        undoPatch: [
            { op: 'replace' as const, path: '/actionChecksum', value: before.actionChecksum },
            { op: 'replace' as const, path: '/actionCount', value: before.actionCount }
        ]
    }
    const afterUserAction = createState(1, calculateActionChecksum(0, [userAction]))
    const systemAction = {
        id: 'action-2',
        gameId: GAME_ID,
        source: ActionSource.System,
        type: 'recordBid',
        index: 1,
        undoPatch: [
            {
                op: 'replace' as const,
                path: '/actionChecksum',
                value: afterUserAction.actionChecksum
            },
            {
                op: 'replace' as const,
                path: '/actionCount',
                value: afterUserAction.actionCount
            }
        ]
    }
    const afterSystemAction = createState(
        2,
        calculateActionChecksum(afterUserAction.actionChecksum, [systemAction])
    )

    return {
        before,
        result: {
            processedActions: [userAction, systemAction],
            updatedState: afterSystemAction,
            indexOffset: 0,
            actionCascade: {
                before,
                transitions: [
                    { action: userAction, after: afterUserAction },
                    { action: systemAction, after: afterSystemAction }
                ]
            }
        },
        storedActions: [structuredClone(userAction), structuredClone(systemAction)]
    }
}

function createVisibility(): Visibility.GameVisibility<GameState> {
    return {
        state: {
            schema: GameState,
            project(value) {
                return structuredClone(value)
            }
        },
        actions: {
            project(action, perspective) {
                const projectedAction = structuredClone(action)
                delete projectedAction.undoPatch
                delete projectedAction.forwardPatch
                if (
                    perspective.kind !== 'player' ||
                    perspective.playerId !== projectedAction.playerId
                ) {
                    Reflect.deleteProperty(projectedAction, 'amount')
                }
                return projectedAction
            }
        }
    }
}

function createNotificationRecorder() {
    const publications: NotificationPublication[] = []
    return {
        publications,
        notificationService: {
            async sendNotification(publication: NotificationPublication) {
                publications.push(publication)
            }
        }
    }
}

function findProjectedActionsNotification(publications: NotificationPublication[], topic: string) {
    const publication = publications.find((candidate) => candidate.topics.includes(topic))
    if (publication === undefined) {
        throw new Error(`No notification was published to ${topic}`)
    }
    return Value.Parse(GameAddProjectedActionsNotification, publication.notification)
}

function findProjectedReplacementNotification(
    publications: NotificationPublication[],
    topic: string
) {
    const publication = publications.find((candidate) => candidate.topics.includes(topic))
    if (publication === undefined) {
        throw new Error(`No notification was published to ${topic}`)
    }
    return Value.Parse(GameReplaceProjectedActionsNotification, publication.notification)
}

describe('game notifications', () => {
    it('emits state-free payloads while accepting legacy state-bearing payloads', () => {
        const game = createGame()
        const notification = Value.Parse(
            GameUpdateNotification,
            createGameNotification(GameNotificationAction.Update, { game })
        )

        expect(notification.type).toBe(NotificationCategory.Game)
        expect(notification.data.game).not.toHaveProperty('state')
        expect(game).toHaveProperty('state')

        const legacyNotification = structuredClone(notification)
        legacyNotification.data.game.state = game.state
        expect(Value.Check(GameUpdateNotification, legacyNotification)).toBe(true)
    })

    it('publishes complete projected cascades for each Player and the spectator', async () => {
        const game = createGame()
        Reflect.set(game, 'actionChunkSize', 200)
        const { before, result, storedActions } = createActionCascade()
        const { notificationService, publications } = createNotificationRecorder()

        await publishActionResults({
            game,
            result,
            storedActions,
            priorState: before,
            visibility: createVisibility(),
            notificationService
        })

        expect(publications).toHaveLength(3)
        expect(publications.map((publication) => publication.notification.action)).toEqual([
            GameNotificationAction.AddProjectedActions,
            GameNotificationAction.AddProjectedActions,
            GameNotificationAction.AddProjectedActions
        ])
        expect(
            publications.every(
                (publication) =>
                    publication.channels.length === 1 &&
                    publication.channels[0] === NotificationDistributionMethod.Topical
            )
        ).toBe(true)

        const spectator = findProjectedActionsNotification(publications, `game-${GAME_ID}`)
        const playerOne = findProjectedActionsNotification(publications, 'user-user-1')
        const playerTwo = findProjectedActionsNotification(publications, 'user-user-2')
        const unsafeNotification = structuredClone(spectator)
        Reflect.set(unsafeNotification.data.game, 'state', createState())

        expect(spectator.data.perspective).toEqual({ kind: 'spectator' })
        expect(Value.Check(GameAddProjectedActionsNotification, unsafeNotification)).toBe(false)
        expect(playerOne.data.perspective).toEqual({
            kind: 'player',
            playerId: 'player-1'
        })
        expect(playerTwo.data.perspective).toEqual({
            kind: 'player',
            playerId: 'player-2'
        })
        expect(playerOne.data.actions[0]).toHaveProperty('amount', 7)
        expect(playerTwo.data.actions[0]).not.toHaveProperty('amount')
        expect(spectator.data.actions[0]).not.toHaveProperty('amount')

        for (const notification of [spectator, playerOne, playerTwo]) {
            expect(notification.data.game).not.toHaveProperty('state')
            expect(notification.data.game).not.toHaveProperty('actionChunkSize')
            expect(notification.data.actions.map((action) => action.id)).toEqual([
                'action-1',
                'action-2'
            ])
            expect(
                notification.data.actions.every(
                    (action) => action.forwardPatch !== undefined && action.undoPatch !== undefined
                )
            ).toBe(true)
        }
        expect(game.state).toBeDefined()
    })

    it('preserves the shared User-Action notification for a legacy Game Title', async () => {
        const game = createGame()
        const { before, result, storedActions } = createActionCascade()
        const { notificationService, publications } = createNotificationRecorder()

        await publishActionResults({
            game,
            result,
            storedActions,
            priorState: before,
            notificationService
        })

        expect(publications).toHaveLength(1)
        const publication = publications[0]
        const notification = Value.Parse(GameAddActionsNotification, publication.notification)
        expect(publication.topics).toEqual([`game-${GAME_ID}`])
        expect(notification.action).toBe(GameNotificationAction.AddActions)
        expect(Object.keys(notification.data).toSorted()).toEqual(['actions', 'game'])
        expect(notification.data.actions.map((action) => action.id)).toEqual(['action-1'])
        expect(notification.data.game).not.toHaveProperty('state')
    })

    it('publishes a complete projected undo replacement for every perspective', async () => {
        const game = createGame()
        const { result, storedActions } = createActionCascade()
        game.state = result.updatedState
        const { notificationService, publications } = createNotificationRecorder()
        const actionToUndo = storedActions[0]
        assertExists(actionToUndo, 'Expected an Action to undo')

        await publishUndoResults({
            game,
            actionReplay: { startIndex: 0, actions: storedActions },
            actionToUndo,
            redoneActions: storedActions,
            visibility: createVisibility(),
            notificationService
        })

        expect(publications).toHaveLength(3)
        expect(publications.map((publication) => publication.notification.action)).toEqual([
            GameNotificationAction.ReplaceProjectedActions,
            GameNotificationAction.ReplaceProjectedActions,
            GameNotificationAction.ReplaceProjectedActions
        ])

        const spectator = findProjectedReplacementNotification(publications, `game-${GAME_ID}`)
        const playerOne = findProjectedReplacementNotification(publications, 'user-user-1')
        const playerTwo = findProjectedReplacementNotification(publications, 'user-user-2')
        const unsafeNotification = structuredClone(spectator)
        Reflect.set(unsafeNotification.data.game, 'state', createState())

        expect(spectator.data.perspective).toEqual({ kind: 'spectator' })
        expect(Value.Check(GameReplaceProjectedActionsNotification, unsafeNotification)).toBe(false)
        expect(playerOne.data.perspective).toEqual({
            kind: 'player',
            playerId: 'player-1'
        })
        expect(playerTwo.data.perspective).toEqual({
            kind: 'player',
            playerId: 'player-2'
        })
        expect(playerOne.data.actionReplay.actions[0]).toHaveProperty('amount', 7)
        expect(playerTwo.data.actionReplay.actions[0]).not.toHaveProperty('amount')
        expect(spectator.data.actionReplay.actions[0]).not.toHaveProperty('amount')

        for (const notification of [spectator, playerOne, playerTwo]) {
            expect(notification.data.game).not.toHaveProperty('state')
            expect(notification.data.actionReplay.actions.map((action) => action.id)).toEqual([
                'action-1',
                'action-2'
            ])
            expect(
                notification.data.actionReplay.actions.every(
                    (action) => action.forwardPatch !== undefined && action.undoPatch !== undefined
                )
            ).toBe(true)
        }
        expect(game.state).toBeDefined()
    })

    it('preserves the existing shared undo notification for a legacy Game Title', async () => {
        const game = createGame()
        const { result, storedActions } = createActionCascade()
        game.state = result.updatedState
        const { notificationService, publications } = createNotificationRecorder()
        const actionToUndo = storedActions[0]
        assertExists(actionToUndo, 'Expected an Action to undo')

        await publishUndoResults({
            game,
            actionReplay: { startIndex: 0, actions: storedActions },
            actionToUndo,
            redoneActions: storedActions,
            notificationService
        })

        expect(publications).toHaveLength(1)
        const publication = publications[0]
        const notification = Value.Parse(GameUndoActionNotification, publication.notification)
        expect(publication.topics).toEqual([`game-${GAME_ID}`])
        expect(notification.action).toBe(GameNotificationAction.UndoAction)
        expect(notification.data.action.id).toBe('action-1')
        expect(notification.data.undoneActionId).toBe('action-1')
        expect(notification.data.redoneActions.map((action) => action.id)).toEqual([
            'action-1',
            'action-2'
        ])
        expect(notification.data.canonicalReplay).toEqual({
            startIndex: 0,
            actionIds: ['action-1', 'action-2'],
            userActionIds: ['action-1']
        })
        expect(notification.data.game).not.toHaveProperty('state')
    })
})
