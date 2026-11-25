import { GAME_PACE_LABELS, gamePaceOf, PlayerStatus, takenSeats, type Game } from '@tabletop/common'
import {
    ButtonStyle,
    ComponentType,
    type RESTPostAPIChannelMessageJSONBody
} from 'discord-api-types/v10'
import { escapeMarkdown, truncate } from './discordFormatting.js'
import { siteUrl } from '../site/siteUrl.js'
import { SITE_NAME } from '../site/siteName.js'

export type LobbyPostContext = {
    titleName: string
    frontendHost: string
}

const OPEN_GAME_COLOR = 0x22c55e

// Discord rejects the whole request when any of these fields is over its limit.
const Limit = {
    EmbedTitle: 256,
    FieldValue: 1024
} as const

export type NewLobbyPost = {
    /** Discord returns the message already sent with this nonce instead of posting another. */
    nonce: string
    mentionRoleId?: string
}

export function newLobbyPost(
    game: Game,
    context: LobbyPostContext,
    { nonce, mentionRoleId }: NewLobbyPost
): RESTPostAPIChannelMessageJSONBody {
    return {
        content: mentionRoleId ? `<@&${mentionRoleId}>` : undefined,
        ...lobbyPostUpdate(game, context),
        allowed_mentions: { parse: [], roles: mentionRoleId ? [mentionRoleId] : [] },
        nonce,
        enforce_nonce: true
    }
}

// Leaves the content alone, so an edit never mentions the role again.
export function lobbyPostUpdate(
    game: Game,
    context: LobbyPostContext
): Pick<RESTPostAPIChannelMessageJSONBody, 'embeds' | 'components'> {
    const joinUrl = siteUrl(`/join/${encodeURIComponent(game.id)}`, context.frontendHost)
    return {
        embeds: [
            {
                title: truncate(escapeMarkdown(game.name), Limit.EmbedTitle),
                url: joinUrl,
                description: `**${escapeMarkdown(context.titleName)}**`,
                color: OPEN_GAME_COLOR,
                fields: [
                    { name: 'Seats', value: seatsLabel(game), inline: true },
                    {
                        name: 'Pace',
                        value: GAME_PACE_LABELS[gamePaceOf(game).pace].line,
                        inline: true
                    },
                    { name: 'Players', value: playersLabel(game) }
                ],
                footer: { text: SITE_NAME },
                timestamp: game.createdAt.toISOString()
            }
        ],
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: 'Join game',
                        url: joinUrl
                    }
                ]
            }
        ]
    }
}

function seatsLabel(game: Game): string {
    const open = game.players.length - takenSeats(game)
    return `${open} open of ${game.players.length}`
}

function playersLabel(game: Game): string {
    const names = game.players.flatMap((player) =>
        player.status === PlayerStatus.Joined ? [escapeMarkdown(player.name)] : []
    )
    return truncate(names.length > 0 ? names.join(', ') : 'Nobody yet', Limit.FieldValue)
}
