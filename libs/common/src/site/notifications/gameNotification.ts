import { Type, type Static } from '@sinclair/typebox'
import { Notification, NotificationCategory } from './notification.js'
import { Game } from '../../game/model/game.js'
import { GameAction } from '../../game/engine/gameAction.js'
import { GameChatMessage } from '../chat/gameChatMessage.js'

export enum GameNotificationAction {
    Create = 'create',
    Update = 'update',
    AddActions = 'addActions',
    UndoAction = 'undoAction',
    Chat = 'chat'
}

export type GameNotificationUpdateData = Static<typeof GameNotificationUpdateData>
export const GameNotificationUpdateData = Type.Object({
    game: Game
})

export type GameNotificationCreateData = Static<typeof GameNotificationCreateData>
export const GameNotificationCreateData = Type.Object({
    game: Game
})

export type GameNotificationAddActionsData = Static<typeof GameNotificationAddActionsData>
export const GameNotificationAddActionsData = Type.Object({
    game: Game,
    actions: Type.Array(GameAction)
})

export type GameNotificationUndoActionData = Static<typeof GameNotificationUndoActionData>
export const GameNotificationUndoActionData = Type.Object({
    game: Game,
    action: GameAction,
    redoneActions: Type.Array(GameAction)
})

export type GameNotificationChatData = Static<typeof GameNotificationChatData>
export const GameNotificationChatData = Type.Object({
    game: Game,
    message: GameChatMessage,
    checksum: Type.Number()
})

export type GameCreateNotification = Static<typeof GameCreateNotification>
export const GameCreateNotification = Type.Composite([
    Type.Omit(Notification, ['type', 'action', 'data']),
    Type.Object({
        type: Type.Literal(NotificationCategory.Game),
        action: Type.Literal(GameNotificationAction.Create),
        data: GameNotificationCreateData
    })
])

export type GameUpdateNotification = Static<typeof GameUpdateNotification>
export const GameUpdateNotification = Type.Composite([
    Type.Omit(Notification, ['type', 'action', 'data']),
    Type.Object({
        type: Type.Literal(NotificationCategory.Game),
        action: Type.Literal(GameNotificationAction.Update),
        data: GameNotificationUpdateData
    })
])

export type GameAddActionsNotification = Static<typeof GameAddActionsNotification>
export const GameAddActionsNotification = Type.Composite([
    Type.Omit(Notification, ['type', 'action', 'data']),
    Type.Object({
        type: Type.Literal(NotificationCategory.Game),
        action: Type.Literal(GameNotificationAction.AddActions),
        data: GameNotificationAddActionsData
    })
])

export type GameUndoActionNotification = Static<typeof GameUndoActionNotification>
export const GameUndoActionNotification = Type.Composite([
    Type.Omit(Notification, ['type', 'action', 'data']),
    Type.Object({
        type: Type.Literal(NotificationCategory.Game),
        action: Type.Literal(GameNotificationAction.UndoAction),
        data: GameNotificationUndoActionData
    })
])

export type GameChatNotification = Static<typeof GameChatNotification>
export const GameChatNotification = Type.Composite([
    Type.Omit(Notification, ['type', 'action', 'data']),
    Type.Object({
        type: Type.Literal(NotificationCategory.Game),
        action: Type.Literal(GameNotificationAction.Chat),
        data: GameNotificationChatData
    })
])

export type GameNotificationData =
    | GameNotificationCreateData
    | GameNotificationUpdateData
    | GameNotificationAddActionsData
    | GameNotificationUndoActionData

export type GameNotification =
    | GameCreateNotification
    | GameUpdateNotification
    | GameAddActionsNotification
    | GameUndoActionNotification
