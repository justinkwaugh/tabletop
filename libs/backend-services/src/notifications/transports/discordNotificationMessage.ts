import { UserNotification, UserNotificationAction } from '@tabletop/common'
import {
    ButtonStyle,
    ComponentType,
    RESTPostAPIChannelMessageJSONBody
} from 'discord-api-types/v10'

export type DiscordNotificationContext = {
    frontendHost: string
    gameTitle?: string
    coverImageUrl?: string
    sentAt: Date
}

type NotificationCopy = {
    summary: string
    heading: string
    color: number
    path: string
    buttonLabel: string
}

const SITE_NAME = 'BoardTogether'
const DASHBOARD_PATH = '/dashboard'

const Color = {
    Turn: 0x22c55e,
    Started: 0x3b82f6,
    Invited: 0xa855f7,
    Joined: 0x14b8a6,
    Declined: 0x6b7280
} as const

export function discordNotificationMessage(
    notification: UserNotification,
    context: DiscordNotificationContext
): RESTPostAPIChannelMessageJSONBody {
    const copy = notificationCopy(notification)
    const url = `${context.frontendHost}${copy.path}`

    return {
        // Push notifications show only the plain content, never the embed.
        content: copy.summary,
        embeds: [
            {
                author: { name: copy.heading },
                title: notification.data.game.name,
                url,
                description: context.gameTitle,
                color: copy.color,
                thumbnail: context.coverImageUrl ? { url: context.coverImageUrl } : undefined,
                footer: { text: SITE_NAME },
                timestamp: context.sentAt.toISOString()
            }
        ],
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: copy.buttonLabel,
                        url
                    }
                ]
            }
        ],
        allowed_mentions: { parse: [] }
    }
}

function notificationCopy(notification: UserNotification): NotificationCopy {
    const gameName = notification.data.game.name
    const gamePath = `/game/${notification.data.game.id}`

    switch (notification.action) {
        case UserNotificationAction.IsYourTurn:
            return {
                summary: `It's your turn in ${gameName}`,
                heading: "It's your turn",
                color: Color.Turn,
                path: gamePath,
                buttonLabel: 'Take your turn'
            }
        case UserNotificationAction.GameStarted:
            return {
                summary: `${gameName} has begun!`,
                heading: 'Your game has begun',
                color: Color.Started,
                path: gamePath,
                buttonLabel: 'Open game'
            }
        case UserNotificationAction.WasInvited:
            return {
                summary: `${notification.data.owner.username} invited you to ${gameName}`,
                heading: `${notification.data.owner.username} invited you to play`,
                color: Color.Invited,
                path: DASHBOARD_PATH,
                buttonLabel: 'View invitation'
            }
        case UserNotificationAction.PlayerJoined:
            return {
                summary: `${notification.data.player.name} joined ${gameName}`,
                heading: `${notification.data.player.name} joined your game`,
                color: Color.Joined,
                path: DASHBOARD_PATH,
                buttonLabel: 'Open dashboard'
            }
        case UserNotificationAction.PlayerDeclined:
            return {
                summary: `${notification.data.player.name} declined to join ${gameName}`,
                heading: `${notification.data.player.name} declined your invitation`,
                color: Color.Declined,
                path: DASHBOARD_PATH,
                buttonLabel: 'Open dashboard'
            }
    }
}
