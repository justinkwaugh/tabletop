import {
    ActionSource,
    GameNotificationAddProjectedActionsData,
    GameNotificationAction,
    NotificationCategory,
    Visibility,
    type ActionCascadeResult,
    type Game,
    type GameAction,
    type GameNotificationData,
    type GameState,
    type Notification
} from '@tabletop/common'
import { nanoid } from 'nanoid'
import * as Value from 'typebox/value'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'
import { createActionResultsRepresentationForPerspective } from './gameRepresentation.js'

type NotificationSender = Pick<NotificationService, 'sendNotification'>

export function createGameNotification(
    action: GameNotificationAction,
    data: GameNotificationData
): Notification {
    return {
        id: nanoid(),
        type: NotificationCategory.Game,
        action,
        data
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
                game: withoutGameState(game),
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

async function publish({
    action,
    data,
    notificationService,
    topics
}: {
    action: GameNotificationAction.AddActions | GameNotificationAction.AddProjectedActions
    data: GameNotificationData
    notificationService: NotificationSender
    topics: string[]
}): Promise<void> {
    if (action === GameNotificationAction.AddProjectedActions) {
        Value.Assert(GameNotificationAddProjectedActionsData, data)
    }
    await notificationService.sendNotification({
        notification: createGameNotification(action, data),
        topics,
        channels: [NotificationDistributionMethod.Topical]
    })
}

function withoutGameState(game: Game): Omit<Game, 'state'> {
    const gameWithoutState = structuredClone(game)
    delete gameWithoutState.state
    return gameWithoutState
}
