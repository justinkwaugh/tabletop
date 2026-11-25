import { UserNotification } from '@tabletop/common'
import { MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from 'discord-api-types/v10'
import { escapeMarkdown, truncate } from '../../discord/discordFormatting.js'
import { siteUrl } from '../../site/siteUrl.js'
import { userNotificationCopy } from './userNotificationCopy.js'
import { SITE_NAME } from '../../site/siteName.js'
import { m, type Locale } from '@tabletop/email/i18n'

export type DiscordWebhookAudience = {
    frontendHost: string
    mentionUserId?: string
    locale: Locale
}

export type DiscordWebhookMessageContext = DiscordWebhookAudience & {
    gameTitle?: string
}

const AVATAR_PATH = '/android-chrome-192x192.png'
const CONTENT_LIMIT = 2000

export function discordWebhookNotificationMessage(
    notification: UserNotification,
    context: DiscordWebhookMessageContext
): RESTPostAPIWebhookWithTokenJSONBody {
    const titlePrefix = context.gameTitle ? `${escapeMarkdown(context.gameTitle)} · ` : ''
    const copy = userNotificationCopy(notification, context.locale, {
        person: escapeMarkdown,
        game: (name, path) =>
            `${titlePrefix}[${escapeMarkdown(name)}](${siteUrl(path, context.frontendHost)})`
    })

    return {
        ...discordWebhookIdentity(context.frontendHost),
        content: truncate(`${mentionPrefix(context.mentionUserId)}${copy.summary}`, CONTENT_LIMIT),
        flags: MessageFlags.SuppressEmbeds,
        allowed_mentions: allowedMentions(context.mentionUserId)
    }
}

export function discordWebhookConnectedMessage(
    audience: DiscordWebhookAudience,
    username: string
): RESTPostAPIWebhookWithTokenJSONBody {
    const connected = m.notification_discord_webhook_connected(
        { site: SITE_NAME, username: escapeMarkdown(username) },
        { locale: audience.locale }
    )
    return {
        ...discordWebhookIdentity(audience.frontendHost),
        content: `${mentionPrefix(audience.mentionUserId)}${connected}`,
        allowed_mentions: allowedMentions(audience.mentionUserId)
    }
}

function discordWebhookIdentity(
    frontendHost: string
): Pick<RESTPostAPIWebhookWithTokenJSONBody, 'username' | 'avatar_url'> {
    return { username: SITE_NAME, avatar_url: siteUrl(AVATAR_PATH, frontendHost) }
}

function mentionPrefix(mentionUserId: string | undefined): string {
    return mentionUserId ? `<@${mentionUserId}> ` : ''
}

// Only the player is ever pinged; names players choose can't mention anyone.
function allowedMentions(
    mentionUserId: string | undefined
): RESTPostAPIWebhookWithTokenJSONBody['allowed_mentions'] {
    return { parse: [], users: mentionUserId ? [mentionUserId] : [] }
}
