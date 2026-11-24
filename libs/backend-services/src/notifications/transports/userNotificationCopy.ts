import {
    assertExists,
    PlayerVoteKind,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'

export type UserNotificationCopy = {
    summary: string
    heading: string
    path: string
    buttonLabel: string
}

export type UserNotificationNameFormat = {
    person(name: string): string
    game(name: string, path: string): string
}

const PLAIN_NAMES: UserNotificationNameFormat = {
    person: (name) => name,
    game: (name) => name
}

const DASHBOARD_PATH = '/dashboard'

export function userNotificationCopy(
    notification: UserNotification,
    format: UserNotificationNameFormat = PLAIN_NAMES
): UserNotificationCopy {
    const path = userNotificationPath(notification)
    const gameName = format.game(notification.data.game.name, path)

    switch (notification.action) {
        case UserNotificationAction.IsYourTurn:
            return {
                summary: `It's your turn in ${gameName}`,
                heading: "It's your turn",
                path,
                buttonLabel: 'Take your turn'
            }
        case UserNotificationAction.GameStarted:
            return {
                summary: `${gameName} has begun!`,
                heading: 'Your game has begun',
                path,
                buttonLabel: 'Open game'
            }
        case UserNotificationAction.WasInvited: {
            const owner = notification.data.owner.username
            assertExists(owner, `Invitation to ${notification.data.game.id} has no owner name`)
            return {
                summary: `${format.person(owner)} invited you to ${gameName}`,
                heading: `${format.person(owner)} invited you to play`,
                path,
                buttonLabel: 'View invitation'
            }
        }
        case UserNotificationAction.PlayerJoined:
            return {
                summary: `${format.person(notification.data.player.name)} joined ${gameName}`,
                heading: `${format.person(notification.data.player.name)} joined your game`,
                path,
                buttonLabel: 'Open dashboard'
            }
        case UserNotificationAction.PlayerDeclined:
            return {
                summary: `${format.person(notification.data.player.name)} declined to join ${gameName}`,
                heading: `${format.person(notification.data.player.name)} declined your invitation`,
                path,
                buttonLabel: 'Open dashboard'
            }
        case UserNotificationAction.PlayerVoteRequested:
            return {
                summary:
                    notification.data.kind === PlayerVoteKind.Call
                        ? `${format.person(notification.data.initiator.name)} asks to end ${gameName}`
                        : `${format.person(notification.data.initiator.name)} asks to go back in ${gameName}`,
                heading:
                    notification.data.kind === PlayerVoteKind.Call
                        ? `${format.person(notification.data.initiator.name)} asks everyone to end the game`
                        : `${format.person(notification.data.initiator.name)} asks everyone to go back`,
                path,
                buttonLabel: 'Vote'
            }
        case UserNotificationAction.TookOverSeat:
            return {
                summary: `You've taken over ${format.person(notification.data.formerHolder.name)}'s seat in ${gameName}`,
                heading: `An administrator gave you ${format.person(notification.data.formerHolder.name)}'s seat`,
                path,
                buttonLabel: 'Open game'
            }
        case UserNotificationAction.LostSeat:
            return {
                summary: `${format.person(notification.data.newHolder.name)} has taken over your seat in ${gameName}`,
                heading: `An administrator gave your seat to ${format.person(notification.data.newHolder.name)}`,
                path,
                buttonLabel: 'Open dashboard'
            }
    }
}

function userNotificationPath(notification: UserNotification): string {
    switch (notification.action) {
        case UserNotificationAction.IsYourTurn:
        case UserNotificationAction.GameStarted:
        case UserNotificationAction.PlayerVoteRequested:
        case UserNotificationAction.TookOverSeat:
            return `/game/${notification.data.game.id}`
        case UserNotificationAction.WasInvited:
        case UserNotificationAction.PlayerJoined:
        case UserNotificationAction.PlayerDeclined:
        case UserNotificationAction.LostSeat:
            return DASHBOARD_PATH
    }
}
