import type { BugReportRequest, BugReportView, Game, Player } from '@tabletop/common'
import {
    ButtonStyle,
    ComponentType,
    type APIEmbedField,
    type RESTPostAPIGuildForumThreadsJSONBody
} from 'discord-api-types/v10'
import { siteUrl, truncate } from './discordFormatting.js'

export type BugReporter = {
    username: string
    discordUserId?: string
}

export type BugReportPostContext = {
    frontendHost: string
    titleName: string
    reporter: BugReporter
    seat: Player
    liveActionCount: number | undefined
    reportedAt: Date
}

const SITE_NAME = 'BoardTogether'
const BUG_COLOR = 0xef4444
const NOT_STARTED = 'Not started'

// Discord rejects the whole request when any of these fields is over its limit.
const Limit = {
    ThreadName: 100,
    EmbedTitle: 256,
    FieldValue: 1024
} as const

export function bugReportPost(
    game: Game,
    report: BugReportRequest,
    context: BugReportPostContext
): RESTPostAPIGuildForumThreadsJSONBody {
    const gameUrl = siteUrl(`/game/${game.id}`, context.frontendHost)

    return {
        name: truncate(`${context.titleName}: ${firstLine(report.description)}`, Limit.ThreadName),
        message: {
            embeds: [
                {
                    title: truncate(game.name, Limit.EmbedTitle),
                    url: gameUrl,
                    description: report.description,
                    color: BUG_COLOR,
                    fields: reportFields(game, report, context),
                    footer: { text: SITE_NAME },
                    timestamp: context.reportedAt.toISOString()
                }
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Link,
                            label: 'Open game',
                            url: gameUrl
                        }
                    ]
                }
            ],
            allowed_mentions: { parse: [] }
        }
    }
}

function reportFields(
    game: Game,
    report: BugReportRequest,
    context: BugReportPostContext
): APIEmbedField[] {
    const { liveActionCount } = context
    return [
        { name: 'Reporter', value: reporterLabel(context.reporter), inline: true },
        { name: 'Seat', value: context.seat.name, inline: true },
        { name: 'Game', value: context.titleName, inline: true },
        { name: 'Status', value: game.status, inline: true },
        { name: 'Actions', value: liveActionCount?.toString() ?? NOT_STARTED, inline: true },
        { name: 'Viewing', value: viewLabel(report.view, liveActionCount), inline: true },
        { name: 'Active players', value: activePlayerNames(game) },
        { name: 'Versions', value: versionsLabel(report) },
        {
            name: 'Client',
            value: truncate(
                [
                    report.client.userAgent,
                    `${report.client.viewport}${report.client.installedApp ? ' · installed app' : ''}`
                ].join('\n'),
                Limit.FieldValue
            )
        },
        {
            name: 'Investigate',
            value: `\`node tools/investigate/src/cli.mjs game ${game.id}\``
        }
    ]
}

function reporterLabel(reporter: BugReporter): string {
    return reporter.discordUserId
        ? `${reporter.username} (<@${reporter.discordUserId}>)`
        : reporter.username
}

function viewLabel(view: BugReportView, liveActionCount: number | undefined): string {
    if (view.exploring) {
        return 'Exploration'
    }
    if (view.inHistory) {
        return `History, after ${view.actionCount ?? '?'} of ${liveActionCount ?? '?'} actions`
    }
    return 'Live'
}

function activePlayerNames(game: Game): string {
    const activeIds = game.activePlayerIds ?? []
    const names = game.players
        .filter((player) => activeIds.includes(player.id))
        .map((player) => player.name)
    return names.length > 0 ? names.join(', ') : 'None'
}

function versionsLabel(report: BugReportRequest): string {
    const { logic, ui, site } = report.versions
    return `Logic ${logic ?? '?'} · UI ${ui ?? '?'} · Site ${site ?? '?'}`
}

function firstLine(text: string): string {
    return text.trim().split('\n', 1)[0]
}
