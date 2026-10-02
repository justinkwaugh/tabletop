import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    GameStatus,
    PlayerStatus,
    UserStatus,
    type BugReportRequest,
    type Game,
    type User
} from '@tabletop/common'
import { BugReportService } from './bugReportService.js'
import { DiscordBotApi } from './discordBotApi.js'
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

const report: BugReportRequest = {
    gameId: 'game-1',
    description: 'The canal would not place',
    view: { actionCount: 12, inHistory: false, exploring: false },
    versions: {},
    client: { userAgent: 'test', viewport: '800x600 @1x', installedApp: false }
}

describe('BugReportService', () => {
    let gameService: GameService
    let discordBotApi: DiscordBotApi
    let service: BugReportService

    beforeEach(() => {
        gameService = Object.create(GameService.prototype)
        vi.spyOn(gameService, 'getGame').mockResolvedValue(game)
        vi.spyOn(gameService, 'getTitle').mockReturnValue(undefined)
        discordBotApi = new DiscordBotApi('token')
        vi.spyOn(discordBotApi, 'post').mockResolvedValue(new Response('{}', { status: 201 }))
        service = new BugReportService(
            gameService,
            Object.create(UserService.prototype),
            discordBotApi,
            { forumChannelId: 'forum-1', frontendHost: 'https://example.com' }
        )
    })

    it('opens a thread in the configured forum for a player in the game', async () => {
        await service.reportBug({ user: reporter, report })

        expect(gameService.getGame).toHaveBeenCalledWith({ gameId: 'game-1', withState: true })
        expect(discordBotApi.post).toHaveBeenCalledWith(
            '/channels/forum-1/threads',
            expect.objectContaining({ name: 'santiago: The canal would not place' })
        )
    })

    it('refuses a user who is not a player in the game', async () => {
        await expect(
            service.reportBug({ user: { ...reporter, id: 'u-9' }, report })
        ).rejects.toBeInstanceOf(UserIsNotAllowedPlayerError)
        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    it('refuses a game that does not exist', async () => {
        vi.mocked(gameService.getGame).mockResolvedValue(undefined)

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
