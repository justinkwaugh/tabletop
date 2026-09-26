import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    FieldValue,
    Firestore,
    QueryDocumentSnapshot,
    Transaction,
    type DocumentReference,
    type DocumentSnapshot
} from '@google-cloud/firestore'
import { GameStatus, PlayerStatus, Role, UserStatus, type Game, type User } from '@tabletop/common'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import { DefaultNotificationService } from '../notifications/defaultNotificationService.js'
import { SyntheticDefinition } from './tests/syntheticGame.js'

const users: User[] = ['a', 'b', 'c'].map((id) => ({
    id,
    username: id,
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}))
afterEach(() => vi.restoreAllMocks())

function fixture({ isPublic = true, lastSlot = false } = {}) {
    const stored: Game = {
        id: 'lobby',
        typeId: 'synthetic',
        ownerId: 'a',
        name: 'Lobby',
        isPublic,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status: GameStatus.WaitingForPlayers,
        players: ['a', 'b', 'c'].slice(0, lastSlot ? 2 : 3).map((id, index) => ({
            id: `p${index}`,
            isHuman: true,
            name: index === 0 || !isPublic ? id : '',
            ...(index === 0 || !isPublic ? { userId: id } : {}),
            status:
                index === 0
                    ? PlayerStatus.Joined
                    : isPublic
                      ? PlayerStatus.Open
                      : PlayerStatus.Reserved
        }))
    }
    const initial = structuredClone(stored)
    const firestore = new Firestore({ projectId: 'membership-unit-test' })
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, firestore)
    const transaction: Transaction = Object.create(Transaction.prototype)
    const snapshot: QueryDocumentSnapshot = Object.create(QueryDocumentSnapshot.prototype)
    vi.spyOn(snapshot, 'data').mockImplementation(() => structuredClone(stored))
    const documentReader: { get(reference: DocumentReference): Promise<DocumentSnapshot> } =
        transaction
    vi.spyOn(documentReader, 'get').mockResolvedValue(snapshot)
    vi.spyOn(transaction, 'update').mockImplementation((_reference, fields) => {
        for (const [key, value] of Object.entries(fields)) {
            if (value instanceof FieldValue && value.isEqual(FieldValue.delete())) {
                Reflect.deleteProperty(stored, key)
            } else {
                Reflect.set(stored, key, value)
            }
        }
        return transaction
    })
    vi.spyOn(transaction, 'set').mockReturnValue(transaction)
    let pending = Promise.resolve()
    vi.spyOn(firestore, 'runTransaction').mockImplementation((update) => {
        const result = pending.then(() => update(transaction))
        pending = result.then(
            () => {},
            () => {}
        )
        return result
    })
    const addKeys = vi.fn(async (_keys: string[]) => {})
    vi.spyOn(cache, 'lockWhileWriting').mockImplementation(async (_keys, writer) =>
        writer({ addKeys })
    )
    vi.spyOn(store, 'findGameById').mockImplementation(async () => structuredClone(initial))
    const notifications: DefaultNotificationService = Object.create(
        DefaultNotificationService.prototype
    )
    vi.spyOn(notifications, 'sendNotification').mockResolvedValue()
    const tasks: LocalTaskService = Object.create(LocalTaskService.prototype)
    vi.spyOn(tasks, 'createPushTask').mockResolvedValue()
    const service = new GameService(
        store,
        UserService.prototype,
        TokenService.prototype,
        tasks,
        notifications,
        cache,
        { synthetic: SyntheticDefinition }
    )
    return { service, store, cache, addKeys, notifications, tasks, read: () => stored, initial }
}

describe('lobby membership transactions', () => {
    it.each([true, false])(
        'preserves both joins from stale reads (public: %s)',
        async (isPublic) => {
            const { service, read } = fixture({ isPublic })
            await Promise.all(
                users.slice(1).map((user) => service.joinGame({ user, gameId: 'lobby' }))
            )
            expect(read().players.map((player) => player.userId)).toEqual(['a', 'b', 'c'])
            expect(read().players.every((player) => player.status === PlayerStatus.Joined)).toBe(
                true
            )
            expect(read().status).toBe(GameStatus.WaitingToStart)
        }
    )

    it('uses current membership even when sequential joins read stale metadata', async () => {
        const { service, read, notifications } = fixture()
        for (const user of users.slice(1)) await service.joinGame({ user, gameId: 'lobby' })
        expect(read().players.map((player) => player.userId)).toEqual(['a', 'b', 'c'])
        expect(notifications.sendNotification).toHaveBeenLastCalledWith(
            expect.objectContaining({
                notification: expect.objectContaining({
                    data: expect.objectContaining({ player: { id: 'p2', name: 'c' } })
                })
            })
        )
    })

    it.each([true, false])(
        'preserves another join when declining (public: %s)',
        async (isPublic) => {
            const { service, read, initial } = fixture({ isPublic })
            for (const game of [read(), initial]) {
                Object.assign(game.players[1], {
                    userId: 'b',
                    name: 'b',
                    status: PlayerStatus.Joined
                })
            }
            await service.joinGame({ user: users[2], gameId: 'lobby' })
            await service.declineGame({ user: users[1], gameId: 'lobby' })
            expect(read().players[2]).toMatchObject({ userId: 'c', status: PlayerStatus.Joined })
            expect(read().players[1].status).toBe(
                isPublic ? PlayerStatus.Open : PlayerStatus.Declined
            )
            expect(read().status).toBe(GameStatus.WaitingForPlayers)
        }
    )

    it('returns an already joined public player without duplicate notifications', async () => {
        const { service, read, notifications } = fixture()
        await service.joinGame({ user: users[1], gameId: 'lobby' })
        vi.mocked(notifications.sendNotification).mockClear()
        const result = await service.joinGame({ user: users[1], gameId: 'lobby' })
        expect(result).toEqual(read())
        expect(notifications.sendNotification).not.toHaveBeenCalled()
    })

    it('protects only the newly joined member list when existing memberships stay unchanged', async () => {
        const { service, addKeys } = fixture()
        await service.joinGame({ user: users[1], gameId: 'lobby' })
        expect(addKeys).toHaveBeenCalledExactlyOnceWith(['games-active-b'])
    })

    it('rejects an uninvited user in a private lobby', async () => {
        const { service, read } = fixture({ isPublic: false })
        const before = structuredClone(read())
        await expect(
            service.joinGame({ user: { ...users[1], id: 'outsider' }, gameId: 'lobby' })
        ).rejects.toThrow()
        expect(read()).toEqual(before)
    })

    it('allows only one claimant for the final slot', async () => {
        const { service, read } = fixture({ lastSlot: true })
        const results = await Promise.allSettled(
            users.slice(1).map((user) => service.joinGame({ user, gameId: 'lobby' }))
        )
        expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
        expect(read().players.map((player) => player.userId)).toEqual(['a', 'b'])
        expect(read().status).toBe(GameStatus.WaitingToStart)
    })
})

describe('public game auto-start', () => {
    const now = Date.parse('2026-09-26T12:00:00Z')
    const autoStartAt = now + 60_000

    async function fillLobby(options?: { isPublic?: boolean }) {
        vi.spyOn(Date, 'now').mockReturnValue(now)
        const lobby = fixture(options)
        for (const user of users.slice(1)) await lobby.service.joinGame({ user, gameId: 'lobby' })
        vi.mocked(lobby.store.findGameById).mockImplementation(async () =>
            structuredClone(lobby.read())
        )
        return lobby
    }

    it('schedules a start one minute after the final join fills a public game', async () => {
        const { read, tasks } = await fillLobby()
        expect(read().autoStartAt).toEqual(new Date(autoStartAt))
        expect(tasks.createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'game-auto-start',
            path: '/games/autoStart',
            payload: { gameId: 'lobby', autoStartAt },
            inSeconds: 60
        })
    })

    it('does not schedule a start for an invite-only game', async () => {
        const { read, tasks } = await fillLobby({ isPublic: false })
        expect(read().status).toBe(GameStatus.WaitingToStart)
        expect(read().autoStartAt).toBeUndefined()
        expect(tasks.createPushTask).not.toHaveBeenCalled()
    })

    it('cancels the countdown when a player leaves and restarts it when the game refills', async () => {
        const { service, read, tasks } = await fillLobby()
        await service.declineGame({ user: users[2], gameId: 'lobby' })
        expect(read().autoStartAt).toBeUndefined()

        vi.mocked(Date.now).mockReturnValue(now + 5_000)
        await service.joinGame({ user: users[2], gameId: 'lobby' })
        expect(read().autoStartAt).toEqual(new Date(autoStartAt + 5_000))
        expect(tasks.createPushTask).toHaveBeenLastCalledWith(
            expect.objectContaining({
                payload: { gameId: 'lobby', autoStartAt: autoStartAt + 5_000 }
            })
        )
    })

    it('cancels the countdown when the owner makes the game invite-only', async () => {
        const { service, read } = await fillLobby()
        await service.updateGame({ gameId: 'lobby', owner: users[0], fields: { isPublic: false } })
        expect(read().autoStartAt).toBeUndefined()
    })

    it('reports a scheduling failure and reschedules when the join is retried', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(now)
        const { service, read, tasks } = fixture()
        await service.joinGame({ user: users[1], gameId: 'lobby' })
        vi.mocked(tasks.createPushTask).mockRejectedValueOnce(new Error('Queue unavailable'))
        await expect(service.joinGame({ user: users[2], gameId: 'lobby' })).rejects.toThrow(
            'Queue unavailable'
        )
        expect(read().autoStartAt).toEqual(new Date(autoStartAt))

        await service.joinGame({ user: users[2], gameId: 'lobby' })
        expect(tasks.createPushTask).toHaveBeenLastCalledWith(
            expect.objectContaining({ payload: { gameId: 'lobby', autoStartAt } })
        )
    })

    it('starts the game when its countdown task arrives', async () => {
        const { service, read } = await fillLobby()
        await service.autoStartGame({ gameId: 'lobby', autoStartAt })
        expect(read().status).toBe(GameStatus.Started)
        expect(read().autoStartAt).toBeUndefined()
    })

    it('retries rather than start from a game read before the owner changed it', async () => {
        const { service, read, store } = await fillLobby()
        vi.mocked(store.findGameById).mockResolvedValue({
            ...structuredClone(read()),
            updatedAt: new Date(0)
        })
        await expect(service.autoStartGame({ gameId: 'lobby', autoStartAt })).rejects.toThrow(
            'updated by another request'
        )
        expect(read().status).toBe(GameStatus.WaitingToStart)
    })

    it('keeps the game started when player notifications fail', async () => {
        const { service, read, notifications } = await fillLobby()
        vi.mocked(notifications.sendNotification).mockRejectedValue(new Error('Push unavailable'))
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
        await service.autoStartGame({ gameId: 'lobby', autoStartAt })
        expect(read().status).toBe(GameStatus.Started)
        expect(logged).toHaveBeenCalledWith(
            'Failed to notify players that game lobby started',
            expect.any(Error)
        )
    })

    it('ignores a task from a countdown that was cancelled', async () => {
        const { service, read } = await fillLobby()
        await service.declineGame({ user: users[2], gameId: 'lobby' })
        vi.mocked(Date.now).mockReturnValue(now + 5_000)
        await service.joinGame({ user: users[2], gameId: 'lobby' })
        await service.autoStartGame({ gameId: 'lobby', autoStartAt })
        expect(read().status).toBe(GameStatus.WaitingToStart)
    })

    it('ignores the task when the owner already started the game', async () => {
        const { service, read, store } = await fillLobby()
        await service.startGame({
            definition: SyntheticDefinition,
            gameId: 'lobby',
            user: users[0]
        })
        const write = vi.spyOn(store, 'updateGame')
        await service.autoStartGame({ gameId: 'lobby', autoStartAt })
        expect(read().status).toBe(GameStatus.Started)
        expect(write).not.toHaveBeenCalled()
    })
})
