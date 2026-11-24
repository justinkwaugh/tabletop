import { PlayerVoteKind, UserNotification, UserNotificationAction } from '@tabletop/common'

export type UserNotificationCopy = {
    summary: string
    heading: string
    path: string
    buttonLabel: string
}

const DASHBOARD_PATH = '/dashboard'

export function userNotificationCopy(notification: UserNotification): UserNotificationCopy {
    const gameName = notification.data.game.name
    const gamePath = `/game/${notification.data.game.id}`

    switch (notification.action) {
        case UserNotificationAction.IsYourTurn:
            return {
                summary: `It's your turn in ${gameName}`,
                heading: "It's your turn",
                path: gamePath,
                buttonLabel: 'Take your turn'
            }
        case UserNotificationAction.GameStarted:
            return {
                summary: `${gameName} has begun!`,
                heading: 'Your game has begun',
                path: gamePath,
                buttonLabel: 'Open game'
            }
        case UserNotificationAction.WasInvited:
            return {
                summary: `${notification.data.owner.username} invited you to ${gameName}`,
                heading: `${notification.data.owner.username} invited you to play`,
                path: DASHBOARD_PATH,
                buttonLabel: 'View invitation'
            }
        case UserNotificationAction.PlayerJoined:
            return {
                summary: `${notification.data.player.name} joined ${gameName}`,
                heading: `${notification.data.player.name} joined your game`,
                path: DASHBOARD_PATH,
                buttonLabel: 'Open dashboard'
            }
        case UserNotificationAction.PlayerDeclined:
            return {
                summary: `${notification.data.player.name} declined to join ${gameName}`,
                heading: `${notification.data.player.name} declined your invitation`,
                path: DASHBOARD_PATH,
                buttonLabel: 'Open dashboard'
            }
        case UserNotificationAction.PlayerVoteRequested:
            return {
                summary:
                    notification.data.kind === PlayerVoteKind.Call
                        ? `${notification.data.initiator.name} asks to end ${gameName}`
                        : `${notification.data.initiator.name} asks to go back in ${gameName}`,
                heading:
                    notification.data.kind === PlayerVoteKind.Call
                        ? `${notification.data.initiator.name} asks everyone to end the game`
                        : `${notification.data.initiator.name} asks everyone to go back`,
                path: gamePath,
                buttonLabel: 'Vote'
            }
        case UserNotificationAction.TookOverSeat:
            return {
                summary: `You've taken over ${notification.data.formerHolder.name}'s seat in ${gameName}`,
                heading: `An administrator gave you ${notification.data.formerHolder.name}'s seat`,
                path: gamePath,
                buttonLabel: 'Open game'
            }
        case UserNotificationAction.LostSeat:
            return {
                summary: `${notification.data.newHolder.name} has taken over your seat in ${gameName}`,
                heading: `An administrator gave your seat to ${notification.data.newHolder.name}`,
                path: DASHBOARD_PATH,
                buttonLabel: 'Open dashboard'
            }
    }
}
