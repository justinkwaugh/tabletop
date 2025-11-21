import { Type, type Static } from 'typebox'
import { Notification, NotificationCategory } from './notification.js'
import { Game } from '../../game/model/game.js'
import { Player } from '../../game/model/player.js'
import { User } from '../user.js'

export enum UserNotificationAction {
    PlayerJoined = 'playerJoined',
    PlayerDeclined = 'playerDeclined',
    WasInvited = 'wasInvited',
    GameStarted = 'gameStarted',
    IsYourTurn = 'isYourTurn'
}

export type PlayerJoinedNotification = Static<typeof PlayerJoinedNotification>
export const PlayerJoinedNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.User),
            action: Type.Literal(UserNotificationAction.PlayerJoined),
            data: Type.Object({
                user: Type.Pick(User, ['id']),
                game: Type.Pick(Game, ['id', 'typeId', 'name']),
                player: Type.Pick(Player, ['id', 'name'])
            })
        })
    ])
)

export type PlayerDeclinedNotification = Static<typeof PlayerDeclinedNotification>
export const PlayerDeclinedNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.User),
            action: Type.Literal(UserNotificationAction.PlayerDeclined),
            data: Type.Object({
                user: Type.Pick(User, ['id']),
                game: Type.Pick(Game, ['id', 'typeId', 'name']),
                player: Type.Pick(Player, ['id', 'name'])
            })
        })
    ])
)

export type WasInvitedNotification = Static<typeof WasInvitedNotification>
export const WasInvitedNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.User),
            action: Type.Literal(UserNotificationAction.WasInvited),
            data: Type.Object({
                user: Type.Pick(User, ['id']),
                owner: Type.Pick(User, ['id', 'username']),
                game: Type.Pick(Game, ['id', 'typeId', 'name'])
            })
        })
    ])
)

export type GameStartedNotification = Static<typeof GameStartedNotification>
export const GameStartedNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.User),
            action: Type.Literal(UserNotificationAction.GameStarted),
            data: Type.Object({
                user: Type.Pick(User, ['id']),
                game: Type.Pick(Game, ['id', 'typeId', 'name'])
            })
        })
    ])
)

export type IsYourTurnNotification = Static<typeof IsYourTurnNotification>
export const IsYourTurnNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.User),
            action: Type.Literal(UserNotificationAction.IsYourTurn),
            data: Type.Object({
                user: Type.Pick(User, ['id']),
                game: Type.Pick(Game, ['id', 'typeId', 'name'])
            })
        })
    ])
)

export type UserNotification =
    | PlayerJoinedNotification
    | PlayerDeclinedNotification
    | WasInvitedNotification
    | GameStartedNotification
    | IsYourTurnNotification
