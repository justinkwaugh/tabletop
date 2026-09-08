import { afterEach, describe, expect, it, vi } from 'vitest'
import {
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
        Object.assign(stored, fields)
        return transaction
    })
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
    const service = new GameService(
        store,
        UserService.prototype,
        TokenService.prototype,
        LocalTaskService.prototype,
        notifications,
        cache,
        {}
    )
    return { service, store, cache, addKeys, notifications, read: () => stored, initial }
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
