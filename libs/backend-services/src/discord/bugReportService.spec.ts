import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    GameStatus,
    PlayerStatus,
    UserStatus,
    type BugReportRequest,
    type Game,
    type GameAction,
    type GameState,
    type User
} from '@tabletop/common'
import { BugReportService } from './bugReportService.js'
import { DiscordBotApi, type DiscordFile } from './discordBotApi.js'
import { GameService } from '../games/gameService.js'
import { UserService } from '../users/userService.js'
import { GameNotFoundError, UserIsNotAllowedPlayerError } from '../games/errors.js'

const reporter: User = {
    id: 'u-1',
    username: 'alice',
    status: UserStatus.Active,
    roles: [],
    externalIds: ['discord:discord-1']
}

const game: Game = {
    id: 'game-1',
    typeId: 'santiago',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'u-1',
    name: 'Friday night',
    players: [
        { id: 'p-1', isHuman: true, userId: 'u-1', name: 'Alice', status: PlayerStatus.Joined }
    ],
    config: {},
    hotseat: false,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    winningPlayerIds: []
}

const state: GameState = {
    id: 'state-1',
    gameId: 'game-1',
    players: [],
    activePlayerIds: ['p-1'],
    actionCount: 1,
    actionChecksum: 7,
    prng: { seed: 1, invocations: 0 },
    machineState: 'placing',
    turnManager: { series: [], turnOrder: ['p-1'], turnCounts: {} },
    winningPlayerIds: []
}

const action: GameAction = {
    id: 'action-1',
    gameId: 'game-1',
    type: 'placeCanal',
    source: ActionSource.User,
    playerId: 'p-1',
    createdAt: new Date('2026-09-01T00:05:00.000Z')
}

const report: BugReportRequest = {
    gameId: 'game-1',
    description: 'The canal would not place',
    view: { actionCount: 12, inHistory: false, exploring: false },
    versions: {},
    client: { userAgent: 'test', viewport: '800x600 @1x', installedApp: false }
}

function text(content: DiscordFile['content']): string {
    if (typeof content !== 'string') {
        throw new Error('Expected a text file')
    }
    return content
}

function forumWithTags(names: string[]): Response {
    return new Response(
        JSON.stringify({
            id: 'forum-1',
            available_tags: names.map((name, index) => ({ id: `tag-${index}`, name }))
        }),
        { status: 200 }
    )
}

describe('BugReportService', () => {
    let gameService: GameService
    let discordBotApi: DiscordBotApi
    let service: BugReportService

    beforeEach(() => {
        gameService = Object.create(GameService.prototype)
        vi.spyOn(gameService, 'getGameData').mockResolvedValue({ game, actions: [] })
        vi.spyOn(gameService, 'getTitle').mockReturnValue(undefined)
        discordBotApi = new DiscordBotApi('token')
        vi.spyOn(discordBotApi, 'post').mockResolvedValue(new Response('{}', { status: 201 }))
        vi.spyOn(discordBotApi, 'postWithFiles').mockResolvedValue(
            new Response('{}', { status: 201 })
        )
        vi.spyOn(discordBotApi, 'get').mockImplementation(async () =>
            forumWithTags(['Fixed', ' open '])
        )
        service = new BugReportService(
            gameService,
            Object.create(UserService.prototype),
            discordBotApi,
            { forumChannelId: 'forum-1', frontendHost: 'https://example.com' }
        )
    })

    it('opens a thread in the configured forum for a player in the game', async () => {
        await service.reportBug({ user: reporter, report })

        expect(gameService.getGameData).toHaveBeenCalledWith('game-1')
        expect(discordBotApi.post).toHaveBeenCalledWith(
            '/channels/forum-1/threads',
            expect.objectContaining({
                name: 'santiago: The canal would not place',
                applied_tags: ['tag-1']
            })
        )
    })

    it('attaches a started game as a dev harness scenario', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, state },
            actions: [action]
        })

        await service.reportBug({ user: reporter, report })

        expect(discordBotApi.post).not.toHaveBeenCalled()
        const [path, post, files] = vi.mocked(discordBotApi.postWithFiles).mock.calls[0]
        expect(path).toBe('/channels/forum-1/threads')
        expect(post).toEqual(
            expect.objectContaining({
                message: expect.objectContaining({
                    attachments: [{ id: 0, filename: 'bug-report-game-1.json' }]
                })
            })
        )
        expect(files).toHaveLength(1)
        expect(files[0].filename).toBe('bug-report-game-1.json')
        expect(files[0].contentType).toBe('application/json')
        expect(JSON.parse(text(files[0].content))).toEqual(
            JSON.parse(JSON.stringify({ game, state, actions: [action] }))
        )
    })

    it('attaches pasted screenshots after the scenario', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, state },
            actions: [action]
        })
        const screenshots = [Buffer.from([0xff, 0xd8, 0xff, 1]), Buffer.from([0xff, 0xd8, 0xff, 2])]

        await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: screenshots.map((bytes) => bytes.toString('base64')) }
        })

        const [, post, files] = vi.mocked(discordBotApi.postWithFiles).mock.calls[0]
        expect(files.map((file) => [file.filename, file.contentType])).toEqual([
            ['bug-report-game-1.json', 'application/json'],
            ['screenshot-1.jpg', 'image/jpeg'],
            ['screenshot-2.jpg', 'image/jpeg']
        ])
        expect(files.slice(1).map((file) => Buffer.from(file.content))).toEqual(screenshots)
        expect(post).toEqual(
            expect.objectContaining({
                message: expect.objectContaining({
                    attachments: [
                        { id: 0, filename: 'bug-report-game-1.json' },
                        { id: 1, filename: 'screenshot-1.jpg' },
                        { id: 2, filename: 'screenshot-2.jpg' }
                    ]
                })
            })
        )
    })

    it('attaches pasted screenshots to a report with no scenario', async () => {
        await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: [Buffer.from([0xff, 0xd8, 0xff]).toString('base64')] }
        })

        expect(discordBotApi.post).not.toHaveBeenCalled()
        const [, post, files] = vi.mocked(discordBotApi.postWithFiles).mock.calls[0]
        expect(files.map((file) => file.filename)).toEqual(['screenshot-1.jpg'])
        expect(post).toEqual(
            expect.objectContaining({
                message: expect.objectContaining({
                    attachments: [{ id: 0, filename: 'screenshot-1.jpg' }]
                })
            })
        )
    })

    it('leaves out the screenshots that do not fit beside the scenario', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, state },
            actions: [
                {
                    ...action,
                    undoPatch: [{ op: 'add', path: '/notes', value: 'x'.repeat(9_400_000) }]
                }
            ]
        })
        const screenshot = Buffer.alloc(400_000, 0xff).toString('base64')

        await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: [screenshot, screenshot] }
        })

        const [, post, files] = vi.mocked(discordBotApi.postWithFiles).mock.calls[0]
        expect(files.map((file) => file.filename)).toEqual([
            'bug-report-game-1.json',
            'screenshot-1.jpg'
        ])
        expect(post).toEqual(
            expect.objectContaining({
                message: expect.objectContaining({
                    embeds: [
                        expect.objectContaining({
                            fields: expect.arrayContaining([
                                { name: 'Screenshots', value: '1 left out, over the upload limit' }
                            ])
                        })
                    ]
                })
            })
        )
    })

    it('posts without the scenario when it is over the Discord upload limit', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, state },
            actions: [
                {
                    ...action,
                    undoPatch: [{ op: 'add', path: '/notes', value: 'x'.repeat(10_000_000) }]
                }
            ]
        })

        await service.reportBug({ user: reporter, report })

        expect(discordBotApi.postWithFiles).not.toHaveBeenCalled()
        const [, post] = vi.mocked(discordBotApi.post).mock.calls[0]
        expect(post).toEqual(
            expect.objectContaining({
                message: expect.objectContaining({
                    attachments: undefined,
                    embeds: [
                        expect.objectContaining({
                            fields: expect.arrayContaining([
                                { name: 'Scenario', value: 'Too large to attach (10.0 MB)' }
                            ])
                        })
                    ]
                })
            })
        )
    })

    it('looks up the Open tag once', async () => {
        await service.reportBug({ user: reporter, report })
        await service.reportBug({ user: reporter, report })

        expect(discordBotApi.get).toHaveBeenCalledTimes(1)
        expect(discordBotApi.get).toHaveBeenCalledWith('/channels/forum-1')
    })

    it('posts untagged when the forum has no Open tag', async () => {
        vi.mocked(discordBotApi.get).mockImplementation(async () => forumWithTags(['Fixed']))

        await service.reportBug({ user: reporter, report })

        expect(discordBotApi.post).toHaveBeenCalledWith(
            '/channels/forum-1/threads',
            expect.objectContaining({ applied_tags: [] })
        )
    })

    it('posts untagged when the forum tags cannot be read', async () => {
        vi.mocked(discordBotApi.get).mockResolvedValue(new Response('', { status: 403 }))

        await service.reportBug({ user: reporter, report })

        expect(discordBotApi.post).toHaveBeenCalledWith(
            '/channels/forum-1/threads',
            expect.objectContaining({ applied_tags: [] })
        )
    })

    it('refuses a user who is not a player in the game', async () => {
        await expect(
            service.reportBug({ user: { ...reporter, id: 'u-9' }, report })
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    it('refuses a game that does not exist', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue(undefined)

        await expect(service.reportBug({ user: reporter, report })).rejects.toBeInstanceOf(
            GameNotFoundError
        )
        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    it('fails when Discord rejects the thread', async () => {
        vi.mocked(discordBotApi.post).mockResolvedValue(
            new Response('Missing Permissions', { status: 403 })
        )

        await expect(service.reportBug({ user: reporter, report })).rejects.toThrow(
            'Discord rejected the bug report with 403: Missing Permissions'
        )
    })
})
