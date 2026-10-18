import * as Type from 'typebox'
import { Notification, NotificationCategory } from './notification.js'
import { Game } from '../../game/model/game.js'
import { Player } from '../../game/model/player.js'
import { User } from '../user.js'
import { PlayerVoteKind } from '../../game/model/playerVote.js'

export enum UserNotificationAction {
    PlayerJoined = 'playerJoined',
    PlayerDeclined = 'playerDeclined',
    WasInvited = 'wasInvited',
    GameStarted = 'gameStarted',
    IsYourTurn = 'isYourTurn',
    PlayerVoteRequested = 'playerVoteRequested'
}

export type PlayerJoinedNotification = Type.Static<typeof PlayerJoinedNotification>
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

export type PlayerDeclinedNotification = Type.Static<typeof PlayerDeclinedNotification>
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

export type WasInvitedNotification = Type.Static<typeof WasInvitedNotification>
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

export type GameStartedNotification = Type.Static<typeof GameStartedNotification>
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

export type IsYourTurnNotification = Type.Static<typeof IsYourTurnNotification>
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

export type PlayerVoteRequestedNotification = Type.Static<typeof PlayerVoteRequestedNotification>
export const PlayerVoteRequestedNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.User),
            action: Type.Literal(UserNotificationAction.PlayerVoteRequested),
            data: Type.Object({
                user: Type.Pick(User, ['id']),
                game: Type.Pick(Game, ['id', 'typeId', 'name']),
                initiator: Type.Pick(Player, ['id', 'name']),
                kind: Type.Enum(PlayerVoteKind)
            })
        })
    ])
)

export function isYourTurnNotification(
    notification: Notification
): notification is IsYourTurnNotification {
    return (
        notification.type === NotificationCategory.User &&
        notification.action === UserNotificationAction.IsYourTurn
    )
}

export type UserNotification =
    | PlayerJoinedNotification
    | PlayerDeclinedNotification
    | WasInvitedNotification
    | GameStartedNotification
    | IsYourTurnNotification
    | PlayerVoteRequestedNotification
