import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import { GameService } from '../games/gameService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { LobbyPostStore } from '../persistence/stores/lobbyPostStore.js'
import type { LobbyMessage, StoredLobbyPost } from '../persistence/model/storedLobbyPost.js'
import { DiscordBotApi } from './discordBotApi.js'
import { LobbyPostQueue, LobbyPosts } from './lobbyPosts.js'
import { PostedLobbies } from './postedLobbies.js'

const lobbies = new PostedLobbies({ '18xx': { channelId: 'lobby-1', roleId: 'role-1' } }, () => ({
    name: '1830',
    designer: 'Francis Tresham',
    description: 'Railways',
    year: '1986',
    minPlayers: 2,
    maxPlayers: 6,
    defaultPlayerCount: 4,
    version: '1.0.0',
    beta: false
}))

const open: Game = {
    id: 'game-1',
    typeId: '1830',
    series: '18xx',
    status: GameStatus.WaitingForPlayers,
    isPublic: true,
    deleted: false,
    ownerId: 'u-1',
    name: 'Rails',
    players: [
        { id: 'p-1', isHuman: true, userId: 'u-1', name: 'Alice', status: PlayerStatus.Joined },
        { id: 'p-2', isHuman: true, name: 'Player 2', status: PlayerStatus.Open }
    ],
    config: {},
    hotseat: false,
    createdAt: new Date('2026-11-25T12:00:00.000Z'),
    updatedAt: new Date('2026-11-25T12:00:00.000Z'),
    winningPlayerIds: []
}
const filled: Game = {
    ...open,
    status: GameStatus.WaitingToStart,
    updatedAt: new Date('2026-11-25T12:05:00.000Z')
}
const posted: LobbyMessage = { channelId: 'lobby-1', messageId: 'msg-1' }
const MESSAGES_PATH = '/channels/lobby-1/messages'
const MESSAGE_PATH = '/channels/lobby-1/messages/msg-1'

class MemoryLobbyPostStore implements LobbyPostStore {
    readonly posts = new Map<string, StoredLobbyPost>()

    async findPost(gameId: string) {
        return this.posts.get(gameId)
    }

    async claimMessage(gameId: string, message: LobbyMessage) {
        const stored = this.posts.get(gameId)
        if (stored?.message) return stored.message
        this.posts.set(gameId, { gameId, posts: (stored?.posts ?? 0) + 1, message })
        return message
    }

    async clearMessage(gameId: string, message: LobbyMessage) {
        const stored = this.posts.get(gameId)
        if (stored?.message?.messageId !== message.messageId) return
        this.posts.set(gameId, { gameId, posts: stored.posts })
    }
}

function status(code: number, body: unknown = {}): Response {
    return new Response(code === 204 ? null : JSON.stringify(body), { status: code })
}

describe('LobbyPosts', () => {
    let gameService: GameService
    let discordBotApi: DiscordBotApi
    let store: MemoryLobbyPostStore
    let queueSync: MockInstance<LobbyPostQueue['queueSync']>
    let lobbyPosts: LobbyPosts

    function gameReads(...games: (Game | undefined)[]) {
        const getGame = vi.mocked(gameService.getGame)
        for (const game of games) getGame.mockResolvedValueOnce(game)
    }

    function postedBody() {
        expect(discordBotApi.post).toHaveBeenCalledOnce()
        return vi.mocked(discordBotApi.post).mock.calls[0][1]
    }

    beforeEach(() => {
        gameService = Object.create(GameService.prototype)
        vi.spyOn(gameService, 'getGame').mockResolvedValue(undefined)
        vi.spyOn(gameService, 'getTitle').mockReturnValue(undefined)
        discordBotApi = new DiscordBotApi('token')
        vi.spyOn(discordBotApi, 'post').mockImplementation(async () => status(200, { id: 'msg-1' }))
        vi.spyOn(discordBotApi, 'patch').mockResolvedValue(status(200))
        vi.spyOn(discordBotApi, 'delete').mockResolvedValue(status(204))
        store = new MemoryLobbyPostStore()
        const queue = new LobbyPostQueue({ createPushTask: async () => undefined }, lobbies)
        queueSync = vi.spyOn(queue, 'queueSync')
        lobbyPosts = new LobbyPosts(
            gameService,
            discordBotApi,
            store,
            queue,
            lobbies,
            'https://example.com'
        )
    })

    it("posts a game the first time it opens, mentioning the lobby's role", async () => {
        gameReads(open, open)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.post).toHaveBeenCalledWith(MESSAGES_PATH, expect.anything())
        expect(postedBody()).toMatchObject({ content: '<@&role-1>', enforce_nonce: true })
        expect(store.posts.get('game-1')).toEqual({ gameId: 'game-1', posts: 1, message: posted })
        expect(discordBotApi.delete).not.toHaveBeenCalled()
    })

    it('posts a game already open at launch without the mention', async () => {
        gameReads(open, open)

        await lobbyPosts.sync({ gameId: 'game-1', quiet: true })

        expect(postedBody()).toMatchObject({ content: undefined })
    })

    it('posts a reopened game again without mentioning the role a second time', async () => {
        store.posts.set('game-1', { gameId: 'game-1', posts: 1 })
        gameReads(open, open)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(postedBody()).toMatchObject({ content: undefined })
        expect(store.posts.get('game-1')?.posts).toBe(2)
    })

    it('sends the same nonce for every send of one post, and a new one for the next post', async () => {
        const nonces: unknown[] = []
        for (const posts of [0, 0, 1]) {
            store.posts.set('game-1', { gameId: 'game-1', posts })
            gameReads(open, open)
            await lobbyPosts.sync({ gameId: 'game-1' })
            nonces.push(vi.mocked(discordBotApi.post).mock.calls.at(-1)?.[1])
        }
        const [first, retry, next] = nonces.map((body) => Reflect.get(Object(body), 'nonce'))
        expect(first).toHaveLength(25)
        expect(retry).toBe(first)
        expect(next).not.toBe(first)
    })

    it('edits the post of a game still open', async () => {
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })
        gameReads(open, open)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.post).not.toHaveBeenCalled()
        expect(discordBotApi.patch).toHaveBeenCalledWith(
            MESSAGE_PATH,
            expect.not.objectContaining({ content: expect.anything() })
        )
    })

    it('edits again when the game changed while it was editing', async () => {
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })
        const joined: Game = {
            ...open,
            name: 'Renamed',
            updatedAt: new Date('2026-11-25T12:01:00.000Z')
        }
        gameReads(open, joined, joined)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.patch).toHaveBeenCalledTimes(2)
        const lastEdit = vi.mocked(discordBotApi.patch).mock.calls[1][1]
        expect(JSON.stringify(lastEdit)).toContain('Renamed')
    })

    it.each([
        ['filled', filled],
        ['gone', undefined]
    ])('removes the post of a game that is %s, keeping its count', async (_, game) => {
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })
        gameReads(game, game)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.delete).toHaveBeenCalledWith(MESSAGE_PATH)
        expect(store.posts.get('game-1')).toEqual({ gameId: 'game-1', posts: 1 })
        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    it('forgets a post someone already deleted in Discord', async () => {
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })
        gameReads(filled, filled)
        vi.mocked(discordBotApi.delete).mockResolvedValue(status(404))

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(store.posts.get('game-1')?.message).toBeUndefined()
    })

    it('leaves a post gone when someone deleted it in Discord while the game is open', async () => {
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })
        gameReads(open, open)
        vi.mocked(discordBotApi.patch).mockResolvedValue(status(404))

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.post).not.toHaveBeenCalled()
    })

    it('does nothing for a game that was never posted and is not open', async () => {
        gameReads(filled, filled)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.post).not.toHaveBeenCalled()
        expect(discordBotApi.delete).not.toHaveBeenCalled()
    })

    it('keeps a racing sync’s message when Discord returns that same message', async () => {
        gameReads(open, open)
        vi.spyOn(store, 'findPost').mockResolvedValueOnce(undefined)
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.delete).not.toHaveBeenCalled()
        expect(store.posts.get('game-1')?.message).toEqual(posted)
    })

    it('deletes its own message when another sync recorded a different one first', async () => {
        gameReads(open, open)
        vi.spyOn(store, 'findPost').mockResolvedValueOnce(undefined)
        store.posts.set('game-1', { gameId: 'game-1', posts: 1, message: posted })
        vi.mocked(discordBotApi.post).mockResolvedValue(status(200, { id: 'msg-2' }))

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.delete).toHaveBeenCalledWith(`${MESSAGES_PATH}/msg-2`)
        expect(store.posts.get('game-1')?.message).toEqual(posted)
    })

    it('takes the post down at once when the game filled while it was posting', async () => {
        gameReads(open, filled, filled)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.delete).toHaveBeenCalledWith(MESSAGE_PATH)
        expect(store.posts.get('game-1')).toEqual({ gameId: 'game-1', posts: 1 })
    })

    it('moves the post when its lobby moved to another channel', async () => {
        store.posts.set('game-1', {
            gameId: 'game-1',
            posts: 1,
            message: { ...posted, channelId: 'old-lobby' }
        })
        gameReads(open, open)

        await lobbyPosts.sync({ gameId: 'game-1' })

        expect(discordBotApi.delete).toHaveBeenCalledWith('/channels/old-lobby/messages/msg-1')
        expect(discordBotApi.post).toHaveBeenCalledWith(MESSAGES_PATH, expect.anything())
        expect(store.posts.get('game-1')).toEqual({ gameId: 'game-1', posts: 2, message: posted })
    })

    it('fails, so the queue retries, when Discord refuses', async () => {
        gameReads(open)
        vi.mocked(discordBotApi.post).mockResolvedValue(status(429))

        await expect(lobbyPosts.sync({ gameId: 'game-1' })).rejects.toThrow(/429/)
        expect(store.posts.size).toBe(0)
    })

    it('queues a quiet sync for each game open in a posted lobby', async () => {
        const getOpenSeriesGames = vi
            .spyOn(gameService, 'getOpenSeriesGames')
            .mockResolvedValue([
                open,
                { ...open, id: 'game-2' },
                { ...open, id: 'unlisted', unlisted: true }
            ])

        expect(await lobbyPosts.queueOpenGames()).toEqual(['game-1', 'game-2'])
        expect(getOpenSeriesGames).toHaveBeenCalledWith('18xx')
        expect(queueSync.mock.calls).toEqual([
            [{ gameId: 'game-1', quiet: true }],
            [{ gameId: 'game-2', quiet: true }]
        ])
    })
})

describe('LobbyPostQueue', () => {
    let createPushTask: ReturnType<typeof vi.fn<TaskService['createPushTask']>>
    let queue: LobbyPostQueue

    beforeEach(() => {
        createPushTask = vi.fn<TaskService['createPushTask']>(async () => undefined)
        queue = new LobbyPostQueue({ createPushTask }, lobbies)
    })

    it.each([
        ['opens', undefined, open],
        ['changes while open', open, open],
        ['fills', open, filled],
        ['is deleted', open, undefined]
    ])('queues a sync when a game %s', async (_, before, after) => {
        await queue.applyChange(before, after)

        expect(createPushTask).toHaveBeenCalledWith({
            queue: 'maintenance',
            path: '/discord/syncLobbyPost',
            payload: { gameId: 'game-1' }
        })
    })

    it('ignores games outside the posted lobbies', async () => {
        await queue.applyChange(filled, { ...filled, status: GameStatus.Started })
        await queue.applyChange(undefined, { ...open, series: 'gipf' })

        expect(createPushTask).not.toHaveBeenCalled()
    })

    it('never fails the write that changed the game', async () => {
        createPushTask.mockRejectedValue(new Error('queue down'))

        await expect(queue.applyChange(undefined, open)).resolves.toBeUndefined()
    })
})
