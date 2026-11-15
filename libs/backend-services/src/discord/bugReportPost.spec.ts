import { describe, expect, it } from 'vitest'
import {
    GameStatus,
    PlayerStatus,
    type BugReportRequest,
    type Game,
    type Player
} from '@tabletop/common'
import { ButtonStyle, ComponentType } from 'discord-api-types/v10'
import {
    bugReportDataMessage,
    bugReportPost,
    type BugReportDataContext,
    type BugReportPostContext
} from './bugReportPost.js'

const alice: Player = {
    id: 'p-1',
    isHuman: true,
    userId: 'u-1',
    name: 'Alice',
    status: PlayerStatus.Joined
}
const bob: Player = {
    id: 'p-2',
    isHuman: true,
    userId: 'u-2',
    name: 'Bob',
    status: PlayerStatus.Joined
}

const game: Game = {
    id: 'game-1',
    typeId: 'santiago',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'u-1',
    name: 'Friday night',
    players: [alice, bob],
    config: {},
    hotseat: false,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    activePlayerIds: ['p-2'],
    winningPlayerIds: []
}

const report: BugReportRequest = {
    gameId: 'game-1',
    description: 'The canal would not place\nI clicked the spring twice',
    view: { actionCount: 142, inHistory: false, exploring: false },
    versions: { site: '1.40.0', logic: '2.2.0', ui: '3.3.0' },
    client: {
        userAgent: 'Mozilla/5.0 (Macintosh)',
        viewport: '1440x900 @2x',
        installedApp: true
    }
}

const context: BugReportPostContext = {
    reportId: 'r-123',
    titleName: 'Santiago',
    reporter: { username: 'alice', discordUserId: 'discord-1' },
    appliedTagIds: ['tag-open'],
    reportedAt: new Date('2026-10-02T18:30:00.000Z'),
    attachedFilenames: [],
    screenshotsLeftOut: 0
}

const dataContext: BugReportDataContext = {
    reportId: 'r-123',
    frontendHost: 'https://example.com',
    titleName: 'Santiago',
    reporterUserId: 'u-1',
    liveActionCount: 142,
    storedLocally: false,
    reportedAt: new Date('2026-10-02T18:30:00.000Z')
}

function fieldValue(post: ReturnType<typeof bugReportPost>, name: string): string | undefined {
    return post.message.embeds?.[0].fields?.find((field) => field.name === name)?.value
}

function dataFieldValue(
    message: ReturnType<typeof bugReportDataMessage>,
    name: string
): string | undefined {
    return message.embeds?.[0].fields?.find((field) => field.name === name)?.value
}

describe('bugReportPost', () => {
    it('opens a tagged forum thread named for the title and the first line of the description', () => {
        const post = bugReportPost(game, report, context)

        expect(post.name).toBe('Santiago: The canal would not place')
        expect(post.applied_tags).toEqual(['tag-open'])
        expect(post.message.allowed_mentions).toEqual({ parse: [] })
    })

    it('shows only what the reporter chose to share, with the report ID in the footer', () => {
        const post = bugReportPost(game, report, context)
        const embed = post.message.embeds?.[0]

        expect(embed?.title).toBe('Santiago')
        expect(embed?.url).toBeUndefined()
        expect(post.message.components).toBeUndefined()
        expect(embed?.description).toBe(report.description)
        expect(embed?.footer).toEqual({ text: 'BoardTogether · report r-123' })
        expect(embed?.fields).toEqual([
            { name: 'Reporter', value: 'alice (<@discord-1>)', inline: true },
            { name: 'Status', value: GameStatus.Started, inline: true },
            { name: 'Viewing', value: 'Live', inline: true },
            { name: 'Versions', value: 'Logic 2.2.0 · UI 3.3.0 · Site 1.40.0' }
        ])
    })

    it('never names the game, its players or its link, or carries the scenario', () => {
        const text = JSON.stringify(
            bugReportPost(game, report, { ...context, attachedFilenames: ['screenshot-1.jpg'] })
        )

        for (const hidden of ['Friday night', 'Bob', 'game-1', '.json', 'Mozilla', '1440x900']) {
            expect(text).not.toContain(hidden)
        }
    })

    it('names the reporter without a mention when Discord is not linked', () => {
        const post = bugReportPost(game, report, { ...context, reporter: { username: 'alice' } })

        expect(fieldValue(post, 'Reporter')).toBe('alice')
    })

    it('says whether the reporter was in history or exploring, without action counts', () => {
        const inHistory = { actionCount: 97, inHistory: true, exploring: false }
        expect(
            fieldValue(bugReportPost(game, { ...report, view: inHistory }, context), 'Viewing')
        ).toBe('History')
        const exploring = { actionCount: 150, inHistory: true, exploring: true }
        expect(
            fieldValue(bugReportPost(game, { ...report, view: exploring }, context), 'Viewing')
        ).toBe('Exploration')
    })

    it('lists the screenshots in upload order', () => {
        const post = bugReportPost(game, report, {
            ...context,
            attachedFilenames: ['screenshot-1.jpg', 'screenshot-2.jpg']
        })

        expect(post.message.attachments).toEqual([
            { id: 0, filename: 'screenshot-1.jpg' },
            { id: 1, filename: 'screenshot-2.jpg' }
        ])
    })

    it('keeps the thread name within the Discord limit', () => {
        const post = bugReportPost(game, { ...report, description: 'x'.repeat(300) }, context)

        expect(post.name).toHaveLength(100)
        expect(post.name.endsWith('…')).toBe(true)
    })
})

describe('bugReportDataMessage', () => {
    it('carries the game link, IDs, counts, active players and the report ID', () => {
        const message = bugReportDataMessage(game, report, dataContext)
        const embed = message.embeds?.[0]

        expect(message.content).toBe('Data for bug report r-123')
        expect(embed?.title).toBe('Friday night')
        expect(embed?.url).toBe('https://example.com/game/game-1')
        expect(message.components).toEqual([
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: 'Open game',
                        url: 'https://example.com/game/game-1'
                    }
                ]
            }
        ])
        expect(embed?.fields).toEqual([
            { name: 'Game', value: 'Santiago', inline: true },
            { name: 'Reporter ID', value: 'u-1', inline: true },
            { name: 'Actions', value: '142', inline: true },
            { name: 'Viewing', value: 'Live', inline: true },
            { name: 'Active players', value: 'Bob' },
            { name: 'Client', value: 'Mozilla/5.0 (Macintosh)\n1440x900 @2x · installed app' },
            { name: 'Investigate', value: '`node tools/investigate/src/cli.mjs game game-1`' }
        ])
    })

    it('places a history view relative to the live action count', () => {
        const message = bugReportDataMessage(
            game,
            { ...report, view: { actionCount: 97, inHistory: true, exploring: false } },
            dataContext
        )

        expect(dataFieldValue(message, 'Viewing')).toBe('History, after 97 of 142 actions')
    })

    it('reports a game that has not started', () => {
        const message = bugReportDataMessage(
            { ...game, status: GameStatus.WaitingForPlayers, activePlayerIds: undefined },
            report,
            { ...dataContext, liveActionCount: undefined }
        )

        expect(dataFieldValue(message, 'Actions')).toBe('Not started')
        expect(dataFieldValue(message, 'Active players')).toBe('None')
    })

    it('attaches the scenario and says where it goes', () => {
        const message = bugReportDataMessage(game, report, {
            ...dataContext,
            scenario: { attached: true, filename: 'bug-report-game-1.json' }
        })

        expect(message.attachments).toEqual([{ id: 0, filename: 'bug-report-game-1.json' }])
        expect(dataFieldValue(message, 'Scenario')).toBe(
            "Open `bug-report-game-1.json` with **Load from file…** in the title's dev harness; it is a real game, so keep it out of the repository"
        )
    })

    it("neither links nor investigates a game kept in the reporter's browser", () => {
        const message = bugReportDataMessage(game, report, { ...dataContext, storedLocally: true })

        expect(message.embeds?.[0].url).toBeUndefined()
        expect(message.components).toBeUndefined()
        expect(dataFieldValue(message, 'Investigate')).toBeUndefined()
        expect(dataFieldValue(message, 'Hotseat')).toBe(
            "Kept only in the reporter's browser, so the scenario is the only copy"
        )
    })
})
