import { Game, Player, type BugReportRequest, type BugReportView } from '@tabletop/common'
import { Type } from 'typebox'
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

export type ScenarioAttachment =
    { attached: true; filename: string } | { attached: false; bytes: number }

export type ReportedGame = Type.Static<typeof ReportedGame>
export const ReportedGame = Type.Object({
    ...Type.Pick(Game, ['id', 'typeId', 'name', 'status', 'activePlayerIds']).properties,
    players: Type.Array(Type.Pick(Player, ['id', 'name']))
})

export type BugReportPostContext = {
    frontendHost: string
    titleName: string
    reporter: BugReporter
    liveActionCount: number | undefined
    storedLocally: boolean
    appliedTagIds: string[]
    reportedAt: Date
    scenario?: ScenarioAttachment
    attachedFilenames: string[]
    screenshotsLeftOut: number
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
    game: ReportedGame,
    report: BugReportRequest,
    context: BugReportPostContext
): RESTPostAPIGuildForumThreadsJSONBody {
    const gameUrl = context.storedLocally
        ? undefined
        : siteUrl(`/game/${game.id}`, context.frontendHost)

    return {
        name: truncate(`${context.titleName}: ${firstLine(report.description)}`, Limit.ThreadName),
        applied_tags: context.appliedTagIds,
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
            components: gameUrl
                ? [
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
                  ]
                : undefined,
            attachments:
                context.attachedFilenames.length > 0
                    ? context.attachedFilenames.map((filename, id) => ({ id, filename }))
                    : undefined,
            allowed_mentions: { parse: [] }
        }
    }
}

function reportFields(
    game: ReportedGame,
    report: BugReportRequest,
    context: BugReportPostContext
): APIEmbedField[] {
    const { liveActionCount } = context
    return [
        { name: 'Reporter', value: reporterLabel(context.reporter), inline: true },
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
        ...scenarioFields(context.scenario),
        ...screenshotFields(context.screenshotsLeftOut),
        context.storedLocally
            ? {
                  name: 'Hotseat',
                  value: "Kept only in the reporter's browser, so the scenario is the only copy"
              }
            : {
                  name: 'Investigate',
                  value: `\`node tools/investigate/src/cli.mjs game ${game.id}\``
              }
    ]
}

function scenarioFields(scenario: ScenarioAttachment | undefined): APIEmbedField[] {
    if (!scenario) {
        return []
    }
    const value = scenario.attached
        ? `Open \`${scenario.filename}\` with **Load from file…** in the title's dev harness; it is a real game, so keep it out of the repository`
        : `Too large to attach (${(scenario.bytes / 1_000_000).toFixed(1)} MB)`
    return [{ name: 'Scenario', value }]
}

function screenshotFields(leftOut: number): APIEmbedField[] {
    return leftOut > 0
        ? [{ name: 'Screenshots', value: `${leftOut} left out, over the upload limit` }]
        : []
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

function activePlayerNames(game: ReportedGame): string {
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
