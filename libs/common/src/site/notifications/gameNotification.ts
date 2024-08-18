import { Type, type Static } from '@sinclair/typebox'
import { Notification, NotificationCategory } from './notification.js'
import { Game } from '../../game/model/game.js'
import { GameAction } from '../../game/engine/gameAction.js'

export enum GameNotificationAction {
    Create = 'create',
    Update = 'update',
    AddActions = 'addActions'
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

export type GameNotificationData =
    | GameNotificationCreateData
    | GameNotificationUpdateData
    | GameNotificationAddActionsData

export type GameNotification =
    | GameCreateNotification
    | GameUpdateNotification
    | GameAddActionsNotification
