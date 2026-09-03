import * as Type from 'typebox'
import { Notification, NotificationCategory } from './notification.js'
import { Game } from '../../game/model/game.js'
import { GameAction } from '../../game/engine/gameAction.js'
import {
    CanonicalActionReplayManifest,
    ProcessedActionReplay
} from '../../game/engine/canonicalActionReplay.js'
import { GameChatMessage } from '../chat/gameChatMessage.js'
import { Perspective } from '../../game/visibility/valueProjector.js'

const GameWithoutState = Type.Omit(Game, ['state'], { additionalProperties: false })

export enum GameNotificationAction {
    Create = 'create',
    Update = 'update',
    Delete = 'delete',
    AddActions = 'addActions',
    AddProjectedActions = 'addProjectedActions',
    ReplaceProjectedActions = 'replaceProjectedActions',
    UndoAction = 'undoAction',
    Chat = 'chat'
}

export type GameNotificationUpdateData = Type.Static<typeof GameNotificationUpdateData>
export const GameNotificationUpdateData = Type.Object({
    game: Game
})

export type GameNotificationCreateData = Type.Static<typeof GameNotificationCreateData>
export const GameNotificationCreateData = Type.Object({
    game: Game
})

export type GameNotificationDeleteData = Type.Static<typeof GameNotificationDeleteData>
export const GameNotificationDeleteData = Type.Object({
    game: Game
})

export type GameNotificationAddActionsData = Type.Static<typeof GameNotificationAddActionsData>
export const GameNotificationAddActionsData = Type.Object({
    game: Game,
    actions: Type.Array(GameAction)
})

export type GameNotificationAddProjectedActionsData = Type.Static<
    typeof GameNotificationAddProjectedActionsData
>
export const GameNotificationAddProjectedActionsData = Type.Object({
    game: GameWithoutState,
    actions: Type.Array(GameAction),
    perspective: Perspective
})

export type GameNotificationReplaceProjectedActionsData = Type.Static<
    typeof GameNotificationReplaceProjectedActionsData
>
export const GameNotificationReplaceProjectedActionsData = Type.Object({
    game: GameWithoutState,
    actionReplay: ProcessedActionReplay,
    checksum: Type.Number(),
    perspective: Perspective
})

export type GameNotificationUndoActionData = Type.Static<typeof GameNotificationUndoActionData>
export const GameNotificationUndoActionData = Type.Object({
    game: Game,
    redoneActions: Type.Array(GameAction),
    canonicalReplay: CanonicalActionReplayManifest,
    checksum: Type.Number(),
    // Compatibility for clients deployed before the compact replay manifest.
    action: GameAction,
    undoneActionId: Type.String()
})

export type GameNotificationChatData = Type.Static<typeof GameNotificationChatData>
export const GameNotificationChatData = Type.Object({
    game: Game,
    message: GameChatMessage,
    checksum: Type.Number()
})

export type GameCreateNotification = Type.Static<typeof GameCreateNotification>
export const GameCreateNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.Create),
            data: GameNotificationCreateData
        })
    ])
)

export type GameDeleteNotification = Type.Static<typeof GameDeleteNotification>
export const GameDeleteNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.Delete),
            data: GameNotificationDeleteData
        })
    ])
)

export type GameUpdateNotification = Type.Static<typeof GameUpdateNotification>
export const GameUpdateNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.Update),
            data: GameNotificationUpdateData
        })
    ])
)

export type GameAddActionsNotification = Type.Static<typeof GameAddActionsNotification>
export const GameAddActionsNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.AddActions),
            data: GameNotificationAddActionsData
        })
    ])
)

export type GameAddProjectedActionsNotification = Type.Static<
    typeof GameAddProjectedActionsNotification
>
export const GameAddProjectedActionsNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.AddProjectedActions),
            data: GameNotificationAddProjectedActionsData
        })
    ])
)

export type GameReplaceProjectedActionsNotification = Type.Static<
    typeof GameReplaceProjectedActionsNotification
>
export const GameReplaceProjectedActionsNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.ReplaceProjectedActions),
            data: GameNotificationReplaceProjectedActionsData
        })
    ])
)

export type GameUndoActionNotification = Type.Static<typeof GameUndoActionNotification>
export const GameUndoActionNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.UndoAction),
            data: GameNotificationUndoActionData
        })
    ])
)

export type GameChatNotification = Type.Static<typeof GameChatNotification>
export const GameChatNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.Game),
            action: Type.Literal(GameNotificationAction.Chat),
            data: GameNotificationChatData
        })
    ])
)

export type GameNotificationData =
    | GameNotificationCreateData
    | GameNotificationUpdateData
    | GameNotificationDeleteData
    | GameNotificationAddActionsData
    | GameNotificationAddProjectedActionsData
    | GameNotificationReplaceProjectedActionsData
    | GameNotificationUndoActionData
    | GameNotificationChatData

export type GameNotification =
    | GameCreateNotification
    | GameUpdateNotification
    | GameDeleteNotification
    | GameAddActionsNotification
    | GameAddProjectedActionsNotification
    | GameReplaceProjectedActionsNotification
    | GameUndoActionNotification
    | GameChatNotification
