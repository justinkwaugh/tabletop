import {
    GAME_PACE_LABELS,
    GamePace,
    gamePaceOf,
    nonStandardGameOptions,
    PlayerStatus,
    takenSeats,
    type Game,
    type GameConfigurator,
    type GameOptionValueLabels
} from '@tabletop/common'
import {
    ButtonStyle,
    ComponentType,
    type RESTPostAPIChannelMessageJSONBody
} from 'discord-api-types/v10'
import { escapeMarkdown, truncate } from './discordFormatting.js'
import { siteUrl } from '../site/siteUrl.js'

export type LobbyPostContext = {
    titleName: string
    /** The title's options, so the post can show those the game sets away from the standard. */
    configurator?: GameConfigurator
    frontendHost: string
    /** Whole hours; only when the host shares their time difference and it is being shown. */
    hostUtcOffset?: number
}

const OPTION_VALUE_LABELS: GameOptionValueLabels = { yes: 'Yes', no: 'No', none: 'None' }

const OPEN_GAME_COLOR = 0x22c55e

// Discord rejects the whole request when any of these fields is over its limit; a line is held
// well under the 4096 of the description it is part of.
const Limit = {
    EmbedTitle: 256,
    Line: 1024
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
                description: descriptionLines(game, context).join('\n'),
                color: OPEN_GAME_COLOR
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

// A line for the title, seats and pace, one for the options if the game sets any away from
// the standard, one for the players and one for the host's time if they share it.
function descriptionLines(game: Game, context: LobbyPostContext): string[] {
    const open = game.players.length - takenSeats(game)
    const options = nonStandardOptions(game, context)
    const { hostUtcOffset } = context
    return [
        `**${escapeMarkdown(context.titleName)}** · ${open} of ${game.players.length} seats open · ${paceText(game)}`,
        ...(options.length > 0 ? [truncate(`Options: ${options.join(' · ')}`, Limit.Line)] : []),
        truncate(`Players: ${playerNames(game)}`, Limit.Line),
        ...(hostUtcOffset === undefined ? [] : [`Host's time: ${utcOffsetText(hostUtcOffset)}`])
    ]
}

function paceText(game: Game): string {
    const { pace } = gamePaceOf(game)
    const labels = GAME_PACE_LABELS[pace]
    return pace === GamePace.Live ? labels.name : labels.option
}

export function utcOffsetText(hours: number): string {
    if (hours === 0) return 'UTC'
    return `UTC${hours < 0 ? '\u2212' : '+'}${Math.abs(hours)}`
}

function nonStandardOptions(game: Game, { configurator }: LobbyPostContext): string[] {
    if (!configurator) return []
    return nonStandardGameOptions(game.config, configurator, OPTION_VALUE_LABELS).map(
        ({ name, value, enabledFlag }) => escapeMarkdown(enabledFlag ? name : `${name}: ${value}`)
    )
}

function playerNames(game: Game): string {
    const names = game.players.flatMap((player) =>
        player.status === PlayerStatus.Joined ? [escapeMarkdown(player.name)] : []
    )
    return names.length > 0 ? names.join(', ') : 'Nobody yet'
}
