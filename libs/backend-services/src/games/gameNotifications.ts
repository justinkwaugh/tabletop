import {
    ActionSource,
    GameNotificationAddProjectedActionsData,
    GameNotificationReplaceProjectedActionsData,
    GameNotificationAction,
    NotificationCategory,
    Visibility,
    assertExists,
    type ActionCascadeResult,
    type Game,
    type GameAction,
    type GameNotificationData,
    type GameState,
    type Notification,
    omitGameState,
    type ProcessedActionReplay
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import * as Value from 'typebox/value'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'
import {
    createActionResultsRepresentationForPerspective,
    createUndoResultsRepresentationForPerspective
} from './gameRepresentation.js'

type NotificationSender = Pick<NotificationService, 'sendNotification'>

export function createGameNotification(
    action: GameNotificationAction,
    data: GameNotificationData
): Notification {
    return {
        id: nanoid(),
        type: NotificationCategory.Game,
        action,
        data: { ...data, game: omitGameState(data.game) }
    }
}

export async function publishActionResults({
    game,
    result,
    storedActions,
    priorState,
    visibility,
    notificationService
}: {
    game: Game
    result: ActionCascadeResult
    storedActions: GameAction[]
    priorState: GameState
    visibility?: Visibility.GameVisibility<GameState>
    notificationService: NotificationSender
}): Promise<void> {
    if (game.hotseat || visibility === undefined) {
        await publish({
            data: {
                game: omitGameState(game),
                actions: storedActions.filter((action) => action.source === ActionSource.User)
            },
            action: GameNotificationAction.AddActions,
            notificationService,
            topics: [`game-${game.id}`]
        })
        return
    }

    const publishForPerspective = async (
        perspective: Visibility.Perspective,
        topic: string
    ): Promise<void> => {
        const representation = createActionResultsRepresentationForPerspective({
            game,
            result,
            storedActions,
            missingActions: [],
            priorState,
            visibility,
            perspective
        })
        await publish({
            data: {
                game: representation.game,
                actions: representation.actions,
                perspective
            },
            action: GameNotificationAction.AddProjectedActions,
            notificationService,
            topics: [topic]
        })
    }

    await publishForGamePerspectives({ game, publishForPerspective })
}

export async function publishUndoResults({
    game,
    actionReplay,
    actionToUndo,
    redoneActions,
    visibility,
    notificationService
}: {
    game: Game
    actionReplay: ProcessedActionReplay
    actionToUndo: GameAction
    redoneActions: GameAction[]
    visibility?: Visibility.GameVisibility<GameState>
    notificationService: NotificationSender
}): Promise<void> {
    const currentState = game.state
    assertExists(currentState, `Cannot publish an undo for Game ${game.id} without current state`)

    if (game.hotseat || visibility === undefined) {
        await publish({
            data: {
                game: omitGameState(game),
                action: actionToUndo,
                redoneActions,
                undoneActionId: actionToUndo.id,
                canonicalReplay: {
                    startIndex: actionReplay.startIndex,
                    actionIds: actionReplay.actions.map((action) => action.id),
                    userActionIds: actionReplay.actions
                        .filter((action) => action.source === ActionSource.User)
                        .map((action) => action.id)
                },
                checksum: currentState.actionChecksum
            },
            action: GameNotificationAction.UndoAction,
            notificationService,
            topics: [`game-${game.id}`]
        })
        return
    }

    const publishForPerspective = async (
        perspective: Visibility.Perspective,
        topic: string
    ): Promise<void> => {
        const representation = createUndoResultsRepresentationForPerspective({
            game,
            actionReplay,
            redoneActions,
            visibility,
            perspective
        })
        await publish({
            data: {
                game: representation.game,
                actionReplay: representation.actionReplay,
                checksum: representation.checksum,
                perspective
            },
            action: GameNotificationAction.ReplaceProjectedActions,
            notificationService,
            topics: [topic]
        })
    }

    await publishForGamePerspectives({ game, publishForPerspective })
}

async function publish({
    action,
    data,
    notificationService,
    topics
}: {
    action:
        | GameNotificationAction.AddActions
        | GameNotificationAction.AddProjectedActions
        | GameNotificationAction.ReplaceProjectedActions
        | GameNotificationAction.UndoAction
    data: GameNotificationData
    notificationService: NotificationSender
    topics: string[]
}): Promise<void> {
    if (action === GameNotificationAction.AddProjectedActions) {
        Value.Assert(GameNotificationAddProjectedActionsData, data)
    } else if (action === GameNotificationAction.ReplaceProjectedActions) {
        Value.Assert(GameNotificationReplaceProjectedActionsData, data)
    }
    await notificationService.sendNotification({
        notification: createGameNotification(action, data),
        topics,
        channels: [NotificationDistributionMethod.Topical]
    })
}

async function publishForGamePerspectives({
    game,
    publishForPerspective
}: {
    game: Game
    publishForPerspective: (perspective: Visibility.Perspective, topic: string) => Promise<void>
}): Promise<void> {
    await publishForPerspective({ kind: 'spectator' }, `game-${game.id}`)
    for (const player of game.players) {
        if (player.userId === undefined) {
            continue
        }
        await publishForPerspective(
            { kind: 'player', playerId: player.id },
            `user-${player.userId}`
        )
    }
}
