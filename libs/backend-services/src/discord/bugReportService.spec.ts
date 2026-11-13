import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type BugReportRequest,
    type Game,
    type GameAction,
    type GameState,
    type User
} from '@tabletop/common'
import { BugReportService } from './bugReportService.js'
import { InvalidLocalGameError } from './errors.js'
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

const DATA_PATH = '/channels/data-1/messages'
const THREAD_PATH = '/channels/forum-1/threads'

function created(path: string): Response {
    return new Response(
        JSON.stringify(
            path === DATA_PATH ? { id: 'data-msg' } : { id: 'thread-1', guild_id: 'guild-1' }
        ),
        { status: 201 }
    )
}

describe('BugReportService', () => {
    let gameService: GameService
    let discordBotApi: DiscordBotApi
    let service: BugReportService

    function sent(path: string): { body: unknown; files: DiscordFile[] }[] {
        return [
            ...vi
                .mocked(discordBotApi.post)
                .mock.calls.filter(([to]) => to === path)
                .map(([, body]) => ({ body, files: [] })),
            ...vi
                .mocked(discordBotApi.postWithFiles)
                .mock.calls.filter(([to]) => to === path)
                .map(([, body, files]) => ({ body, files }))
        ]
    }

    function only(path: string) {
        const messages = sent(path)
        expect(messages).toHaveLength(1)
        return messages[0]
    }

    beforeEach(() => {
        gameService = Object.create(GameService.prototype)
        vi.spyOn(gameService, 'getGameData').mockResolvedValue({ game, actions: [] })
        vi.spyOn(gameService, 'getGame').mockResolvedValue(undefined)
        vi.spyOn(gameService, 'getTitle').mockReturnValue(undefined)
        discordBotApi = new DiscordBotApi('token')
        vi.spyOn(discordBotApi, 'post').mockImplementation(async (path) => created(path))
        vi.spyOn(discordBotApi, 'postWithFiles').mockImplementation(async (path) => created(path))
        vi.spyOn(discordBotApi, 'patch').mockResolvedValue(new Response('{}', { status: 200 }))
        vi.spyOn(discordBotApi, 'get').mockImplementation(async () =>
            forumWithTags(['Fixed', ' open '])
        )
        service = new BugReportService(
            gameService,
            Object.create(UserService.prototype),
            discordBotApi,
            {
                forumChannelId: 'forum-1',
                dataChannelId: 'data-1',
                frontendHost: 'https://example.com'
            }
        )
    })

    it('posts the data privately, then opens the public thread, then links them', async () => {
        await service.reportBug({ user: reporter, report })

        expect(gameService.getGameData).toHaveBeenCalledWith('game-1')
        const [dataCall, threadCall] = [DATA_PATH, THREAD_PATH].map((path) =>
            vi.mocked(discordBotApi.post).mock.calls.findIndex(([to]) => to === path)
        )
        const order = vi.mocked(discordBotApi.post).mock.invocationCallOrder
        expect(order[dataCall]).toBeLessThan(order[threadCall])
        const thread = only(THREAD_PATH).body
        expect(thread).toEqual(
            expect.objectContaining({
                name: 'santiago: The canal would not place',
                applied_tags: ['tag-1']
            })
        )
        const reportId = JSON.stringify(thread).match(/report ([\w-]+)/)?.[1]
        expect(reportId).toBeDefined()
        expect(JSON.stringify(only(DATA_PATH).body)).toContain(`report ${reportId}`)
        expect(discordBotApi.patch).toHaveBeenCalledWith('/channels/data-1/messages/data-msg', {
            content: `Data for bug report ${reportId} · https://discord.com/channels/guild-1/thread-1`
        })
    })

    it('puts the game link, game name and player names only in the data message', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, activePlayerIds: ['p-1'] },
            actions: []
        })
        await service.reportBug({ user: reporter, report })

        const thread = JSON.stringify(only(THREAD_PATH).body)
        const data = JSON.stringify(only(DATA_PATH).body)
        for (const hidden of ['example.com/game/game-1', 'Friday night', 'Alice', 'u-1']) {
            expect(thread).not.toContain(hidden)
            expect(data).toContain(hidden)
        }
    })

    it('attaches a started game as a dev harness scenario to the data message only', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, state },
            actions: [action]
        })

        await service.reportBug({ user: reporter, report })

        const { files } = only(DATA_PATH)
        expect(files).toHaveLength(1)
        expect(files[0].filename).toBe('bug-report-game-1.json')
        expect(files[0].contentType).toBe('application/json')
        expect(JSON.parse(text(files[0].content))).toEqual(
            JSON.parse(JSON.stringify({ game, state, actions: [action] }))
        )
        expect(only(THREAD_PATH).files).toEqual([])
    })

    it('attaches pasted screenshots to the public thread', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue({
            game: { ...game, state },
            actions: [action]
        })
        const screenshots = [Buffer.from([0xff, 0xd8, 0xff, 1]), Buffer.from([0xff, 0xd8, 0xff, 2])]

        await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: screenshots.map((bytes) => bytes.toString('base64')) }
        })

        const { body, files } = only(THREAD_PATH)
        expect(files.map((file) => [file.filename, file.contentType])).toEqual([
            ['screenshot-1.jpg', 'image/jpeg'],
            ['screenshot-2.jpg', 'image/jpeg']
        ])
        expect(files.map((file) => Buffer.from(file.content))).toEqual(screenshots)
        expect(body).toEqual(
            expect.objectContaining({
                message: expect.objectContaining({
                    attachments: [
                        { id: 0, filename: 'screenshot-1.jpg' },
                        { id: 1, filename: 'screenshot-2.jpg' }
                    ]
                })
            })
        )
    })

    it('leaves out the screenshots over the upload limit', async () => {
        const screenshot = Buffer.alloc(6_000_000, 0xff).toString('base64')

        await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: [screenshot, screenshot] }
        })

        const { body, files } = only(THREAD_PATH)
        expect(files.map((file) => file.filename)).toEqual(['screenshot-1.jpg'])
        expect(body).toEqual(
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

    it('posts the data without the scenario when it is over the Discord upload limit', async () => {
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
        expect(only(DATA_PATH).body).toEqual(
            expect.objectContaining({
                attachments: undefined,
                embeds: [
                    expect.objectContaining({
                        fields: expect.arrayContaining([
                            { name: 'Scenario', value: 'Too large to attach (10.0 MB)' }
                        ])
                    })
                ]
            })
        )
    })

    it('opens no public thread when the data cannot be posted', async () => {
        vi.mocked(discordBotApi.post).mockImplementation(async (path) =>
            path === DATA_PATH ? new Response('Missing Access', { status: 403 }) : created(path)
        )

        await expect(service.reportBug({ user: reporter, report })).rejects.toThrow(
            'Discord rejected the bug report data with 403: Missing Access'
        )
        expect(sent(THREAD_PATH)).toEqual([])
    })

    it('still succeeds when the data message cannot be linked to the thread', async () => {
        vi.mocked(discordBotApi.patch).mockResolvedValue(new Response('', { status: 500 }))
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        try {
            await service.reportBug({ user: reporter, report })

            expect(warn).toHaveBeenCalled()
        } finally {
            warn.mockRestore()
        }
    })

    it('posts the data before a thread that carries screenshots', async () => {
        await service.reportBug({
            user: reporter,
            report: { ...report, screenshots: [Buffer.from([0xff, 0xd8, 0xff]).toString('base64')] }
        })

        const dataOrder = vi.mocked(discordBotApi.post).mock.invocationCallOrder[0]
        const threadOrder = vi.mocked(discordBotApi.postWithFiles).mock.invocationCallOrder[0]
        expect(vi.mocked(discordBotApi.post).mock.calls[0][0]).toBe(DATA_PATH)
        expect(dataOrder).toBeLessThan(threadOrder)
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

        expect(only(THREAD_PATH).body).toEqual(expect.objectContaining({ applied_tags: [] }))
    })

    it('posts untagged when the forum tags cannot be read', async () => {
        vi.mocked(discordBotApi.get).mockResolvedValue(new Response('', { status: 403 }))

        await service.reportBug({ user: reporter, report })

        expect(only(THREAD_PATH).body).toEqual(expect.objectContaining({ applied_tags: [] }))
    })

    it('refuses a user who is not a player in the game', async () => {
        await expect(
            service.reportBug({ user: { ...reporter, id: 'u-9' }, report })
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    it('accepts a report from an admin who is not a player in the game', async () => {
        await service.reportBug({ user: { ...reporter, id: 'u-9', roles: [Role.Admin] }, report })

        expect(sent(THREAD_PATH)).toHaveLength(1)
    })

    it('refuses a game that does not exist', async () => {
        vi.mocked(gameService.getGameData).mockResolvedValue(undefined)

        await expect(service.reportBug({ user: reporter, report })).rejects.toBeInstanceOf(
            GameNotFoundError
        )
        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    describe("a game kept in the reporter's browser", () => {
        const localGame: Game = { ...game, hotseat: true, activePlayerIds: ['p-1'] }
        const scenarioJson = JSON.stringify({ game: localGame, state, actions: [action] })

        it('attaches the scenario the reporter sent to the data message', async () => {
            await service.reportBug({
                user: { ...reporter, id: 'u-9' },
                report: { ...report, localGame: scenarioJson }
            })

            expect(gameService.getGameData).not.toHaveBeenCalled()
            const { body, files } = only(DATA_PATH)
            expect(files).toEqual([
                {
                    filename: 'bug-report-game-1.json',
                    contentType: 'application/json',
                    content: scenarioJson
                }
            ])
            expect(body).toEqual(
                expect.objectContaining({
                    components: undefined,
                    embeds: [
                        expect.objectContaining({
                            title: 'Friday night',
                            url: undefined,
                            fields: expect.arrayContaining([
                                { name: 'Actions', value: '1', inline: true },
                                { name: 'Active players', value: 'Alice' },
                                {
                                    name: 'Hotseat',
                                    value: "Kept only in the reporter's browser, so the scenario is the only copy"
                                }
                            ])
                        })
                    ]
                })
            )
            expect(only(THREAD_PATH).files).toEqual([])
        })

        it('refuses a scenario of a hosted game', async () => {
            vi.mocked(gameService.getGame).mockResolvedValue(game)

            await expect(
                service.reportBug({
                    user: { ...reporter, id: 'u-9' },
                    report: { ...report, localGame: scenarioJson }
                })
            ).rejects.toBeInstanceOf(InvalidLocalGameError)
            expect(discordBotApi.postWithFiles).not.toHaveBeenCalled()
        })

        it('refuses a scenario of another game', async () => {
            await expect(
                service.reportBug({
                    user: reporter,
                    report: { ...report, gameId: 'game-2', localGame: scenarioJson }
                })
            ).rejects.toBeInstanceOf(InvalidLocalGameError)
            expect(discordBotApi.postWithFiles).not.toHaveBeenCalled()
        })

        it('refuses a local game that is not a scenario', async () => {
            for (const localGameJson of ['{not json', JSON.stringify({ game: localGame })]) {
                await expect(
                    service.reportBug({
                        user: reporter,
                        report: { ...report, localGame: localGameJson }
                    })
                ).rejects.toBeInstanceOf(InvalidLocalGameError)
            }
            expect(discordBotApi.postWithFiles).not.toHaveBeenCalled()
        })
    })

    it('fails, and deletes the data it posted, when Discord rejects the thread', async () => {
        vi.mocked(discordBotApi.post).mockImplementation(async (path) =>
            path === THREAD_PATH
                ? new Response('Missing Permissions', { status: 403 })
                : created(path)
        )
        vi.spyOn(discordBotApi, 'delete').mockResolvedValue(new Response(null, { status: 204 }))

        await expect(service.reportBug({ user: reporter, report })).rejects.toThrow(
            'Discord rejected the bug report with 403: Missing Permissions'
        )
        expect(discordBotApi.delete).toHaveBeenCalledWith('/channels/data-1/messages/data-msg')
    })
})
