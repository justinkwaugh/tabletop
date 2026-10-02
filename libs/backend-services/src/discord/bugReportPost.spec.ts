import { describe, expect, it } from 'vitest'
import {
    GameStatus,
    PlayerStatus,
    type BugReportRequest,
    type Game,
    type Player
} from '@tabletop/common'
import { ButtonStyle, ComponentType } from 'discord-api-types/v10'
import { bugReportPost, type BugReportPostContext } from './bugReportPost.js'

const alice: Player = {
    id: 'p-1',
    isHuman: true,
    userId: 'u-1',
    name: 'Alice',
    status: PlayerStatus.Joined
}
const bob: Player = { id: 'p-2', isHuman: true, userId: 'u-2', name: 'Bob', status: PlayerStatus.Joined }

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
    frontendHost: 'https://example.com',
    titleName: 'Santiago',
    reporter: { username: 'alice', discordUserId: 'discord-1' },
    seat: alice,
    liveActionCount: 142,
    reportedAt: new Date('2026-10-02T18:30:00.000Z')
}

function fieldValue(post: ReturnType<typeof bugReportPost>, name: string): string | undefined {
    return post.message.embeds?.[0].fields?.find((field) => field.name === name)?.value
}

describe('bugReportPost', () => {
    it('opens a forum thread named for the title and the first line of the description', () => {
        const post = bugReportPost(game, report, context)

        expect(post.name).toBe('Santiago: The canal would not place')
        expect(post.message.allowed_mentions).toEqual({ parse: [] })
        expect(post.message.components).toEqual([
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
    })

    it('describes the reporter, game, view, versions, and client', () => {
        const post = bugReportPost(game, report, context)
        const embed = post.message.embeds?.[0]

        expect(embed?.title).toBe('Friday night')
        expect(embed?.url).toBe('https://example.com/game/game-1')
        expect(embed?.description).toBe(report.description)
        expect(embed?.timestamp).toBe('2026-10-02T18:30:00.000Z')
        expect(embed?.fields).toEqual([
            { name: 'Reporter', value: 'alice (<@discord-1>)', inline: true },
            { name: 'Seat', value: 'Alice', inline: true },
            { name: 'Game', value: 'Santiago', inline: true },
            { name: 'Status', value: GameStatus.Started, inline: true },
            { name: 'Actions', value: '142', inline: true },
            { name: 'Viewing', value: 'Live', inline: true },
            { name: 'Active players', value: 'Bob' },
            { name: 'Versions', value: 'Logic 2.2.0 · UI 3.3.0 · Site 1.40.0' },
            { name: 'Client', value: 'Mozilla/5.0 (Macintosh)\n1440x900 @2x · installed app' },
            {
                name: 'Investigate',
                value: '`node tools/investigate/src/cli.mjs game game-1`'
            }
        ])
    })

    it('names the reporter without a mention when Discord is not linked', () => {
        const post = bugReportPost(game, report, {
            ...context,
            reporter: { username: 'alice' }
        })

        expect(fieldValue(post, 'Reporter')).toBe('alice')
    })

    it('places a history view relative to the live action count', () => {
        const post = bugReportPost(
            game,
            { ...report, view: { actionCount: 97, inHistory: true, exploring: false } },
            context
        )

        expect(fieldValue(post, 'Viewing')).toBe('History, after 97 of 142 actions')
    })

    it('reports an exploration over a history position', () => {
        const post = bugReportPost(
            game,
            { ...report, view: { actionCount: 150, inHistory: true, exploring: true } },
            context
        )

        expect(fieldValue(post, 'Viewing')).toBe('Exploration')
    })

    it('reports a game that has not started', () => {
        const post = bugReportPost(
            { ...game, status: GameStatus.WaitingForPlayers, activePlayerIds: undefined },
            report,
            { ...context, liveActionCount: undefined }
        )

        expect(fieldValue(post, 'Actions')).toBe('Not started')
        expect(fieldValue(post, 'Active players')).toBe('None')
    })

    it('keeps the thread name within the Discord limit', () => {
        const post = bugReportPost(game, { ...report, description: 'x'.repeat(300) }, context)

        expect(post.name).toHaveLength(100)
        expect(post.name.endsWith('…')).toBe(true)
    })
})
