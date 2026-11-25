import { UserNotification, UserNotificationAction } from '@tabletop/common'
import {
    ButtonStyle,
    ComponentType,
    RESTPostAPIChannelMessageJSONBody
} from 'discord-api-types/v10'
import { truncate } from '../../discord/discordFormatting.js'
import { siteUrl } from '../../site/siteUrl.js'
import { userNotificationCopy } from './userNotificationCopy.js'
import { SITE_NAME } from '../../site/siteName.js'
import type { Locale } from '@tabletop/email/i18n'

export type DiscordNotificationContext = {
    frontendHost: string
    gameTitle?: string
    thumbnailUrl?: string
    sentAt: Date
    locale: Locale
}

// Discord rejects the whole message when any of these fields is over its limit.
const Limit = {
    Content: 2000,
    EmbedTitle: 256,
    EmbedAuthorName: 256
} as const

const Color: Record<UserNotificationAction, number> = {
    [UserNotificationAction.IsYourTurn]: 0x22c55e,
    [UserNotificationAction.GameStarted]: 0x3b82f6,
    [UserNotificationAction.WasInvited]: 0xa855f7,
    [UserNotificationAction.PlayerJoined]: 0x14b8a6,
    [UserNotificationAction.PlayerDeclined]: 0x6b7280,
    [UserNotificationAction.PlayerVoteRequested]: 0xf59e0b,
    [UserNotificationAction.TookOverSeat]: 0x0ea5e9,
    [UserNotificationAction.LostSeat]: 0x6b7280
}

export function discordNotificationMessage(
    notification: UserNotification,
    context: DiscordNotificationContext
): RESTPostAPIChannelMessageJSONBody {
    const copy = userNotificationCopy(notification, context.locale)
    const url = siteUrl(copy.path, context.frontendHost)

    return {
        // Push notifications show only the plain content, never the embed.
        content: truncate(copy.summary, Limit.Content),
        embeds: [
            {
                author: { name: truncate(copy.heading, Limit.EmbedAuthorName) },
                title: truncate(notification.data.game.name, Limit.EmbedTitle),
                url,
                description: context.gameTitle,
                color: Color[notification.action],
                thumbnail: context.thumbnailUrl
                    ? { url: siteUrl(context.thumbnailUrl, context.frontendHost) }
                    : undefined,
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
