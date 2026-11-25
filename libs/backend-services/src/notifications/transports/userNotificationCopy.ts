import {
    assertExists,
    PlayerVoteKind,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'
import { m, type Locale } from '@tabletop/email/i18n'

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
    locale: Locale,
    format: UserNotificationNameFormat = PLAIN_NAMES
): UserNotificationCopy {
    const path = userNotificationPath(notification)
    const game = format.game(notification.data.game.name, path)
    const options = { locale }

    switch (notification.action) {
        case UserNotificationAction.IsYourTurn:
            return {
                summary: m.notification_is_your_turn_summary({ game }, options),
                heading: m.notification_is_your_turn_heading({}, options),
                path,
                buttonLabel: m.notification_is_your_turn_button({}, options)
            }
        case UserNotificationAction.GameStarted:
            return {
                summary: m.notification_game_started_summary({ game }, options),
                heading: m.notification_game_started_heading({}, options),
                path,
                buttonLabel: m.notification_open_game_button({}, options)
            }
        case UserNotificationAction.WasInvited: {
            const ownerName = notification.data.owner.username
            assertExists(ownerName, `Invitation to ${notification.data.game.id} has no owner name`)
            const owner = format.person(ownerName)
            return {
                summary: m.notification_was_invited_summary({ owner, game }, options),
                heading: m.notification_was_invited_heading({ owner }, options),
                path,
                buttonLabel: m.notification_was_invited_button({}, options)
            }
        }
        case UserNotificationAction.PlayerJoined: {
            const player = format.person(notification.data.player.name)
            return {
                summary: m.notification_player_joined_summary({ player, game }, options),
                heading: m.notification_player_joined_heading({ player }, options),
                path,
                buttonLabel: m.notification_open_dashboard_button({}, options)
            }
        }
        case UserNotificationAction.PlayerDeclined: {
            const player = format.person(notification.data.player.name)
            return {
                summary: m.notification_player_declined_summary({ player, game }, options),
                heading: m.notification_player_declined_heading({ player }, options),
                path,
                buttonLabel: m.notification_open_dashboard_button({}, options)
            }
        }
        case UserNotificationAction.PlayerVoteRequested: {
            const player = format.person(notification.data.initiator.name)
            const call = notification.data.kind === PlayerVoteKind.Call
            return {
                summary: call
                    ? m.notification_call_vote_summary({ player, game }, options)
                    : m.notification_undo_vote_summary({ player, game }, options),
                heading: call
                    ? m.notification_call_vote_heading({ player }, options)
                    : m.notification_undo_vote_heading({ player }, options),
                path,
                buttonLabel: m.notification_vote_button({}, options)
            }
        }
        case UserNotificationAction.TookOverSeat: {
            const player = format.person(notification.data.formerHolder.name)
            return {
                summary: m.notification_took_over_seat_summary({ player, game }, options),
                heading: m.notification_took_over_seat_heading({ player }, options),
                path,
                buttonLabel: m.notification_open_game_button({}, options)
            }
        }
        case UserNotificationAction.LostSeat: {
            const player = format.person(notification.data.newHolder.name)
            return {
                summary: m.notification_lost_seat_summary({ player, game }, options),
                heading: m.notification_lost_seat_heading({ player }, options),
                path,
                buttonLabel: m.notification_open_dashboard_button({}, options)
            }
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
