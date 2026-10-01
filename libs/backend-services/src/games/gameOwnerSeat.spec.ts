import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import {
    findPlayerForUserId,
    gameUserIds,
    GameStatus,
    PlayerStatus,
    Role,
    UserNotificationAction,
    UserStatus,
    type Game,
    type Player,
    type User
} from '@tabletop/common'
import { SyntheticDefinition } from './tests/syntheticGame.js'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'

function user(id: string, roles: Role[] = [Role.User]): User {
    return {
        id,
        username: id,
        email: `${id}@example.com`,
        status: UserStatus.Active,
        roles,
        externalIds: []
    }
}

const developer = user('developer', [Role.User, Role.Developer])
const admin = user('admin', [Role.User, Role.Admin])
const regular = user('regular')
const invitees = [user('b'), user('c'), user('d')]
afterEach(() => vi.restoreAllMocks())

function fixture() {
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, new Firestore({ projectId: 'owner-seat-test' }))
    const users: UserService = Object.create(UserService.prototype)
    vi.spyOn(users, 'getUser').mockImplementation(async (id) =>
        [developer, admin, regular, ...invitees].find((candidate) => candidate.id === id)
    )
    const tokens: TokenService = Object.create(TokenService.prototype)
    vi.spyOn(tokens, 'createToken').mockResolvedValue('token')
    const unused = vi.fn(async () => {
        throw Error('Unexpected dependency call')
    })
    const tasks: TaskService = {
        createPushTask: unused,
        sendVerificationEmail: unused,
        sendPasswordResetEmail: unused,
        sendAuthVerificationEmail: unused,
        sendAccountChangeNotificationEmail: unused,
        sendGameInvitationEmail: vi.fn(async () => {}),
        sendTurnNotification: unused,
        sendGameEndEmail: unused
    }
    const notifications: NotificationService = {
        addTopicTransport: vi.fn(),
        addTopicListener: unused,
        removeTopicListener: unused,
        addTransport: vi.fn(),
        registerNotificationSubscription: unused,
        unregisterNotificationSubscription: unused,
        sendNotification: vi.fn(async () => {})
    }
    const service = new GameService(store, users, tokens, tasks, notifications, cache, {
        synthetic: SyntheticDefinition
    })
    const write = vi.spyOn(store, 'createGame').mockImplementation(async (game) => game)
    return { service, store, tasks, notifications, write }
}

function inviteesOnly(): Partial<Game> {
    return {
        id: 'invitees-only',
        typeId: SyntheticDefinition.info.id,
        name: 'Invitees only',
        isPublic: false,
        config: {},
        players: invitees.map(({ id }) => ({
            id: `player-${id}`,
            userId: id,
            name: '',
            isHuman: true,
            status: PlayerStatus.Reserved
        }))
    }
}

function seat(userId: string): Player {
    return {
        id: `player-${userId}`,
        userId,
        name: userId,
        isHuman: true,
        status: PlayerStatus.Reserved
    }
}

function storedGame(owner: User, playerUserIds: string[]): Game {
    return {
        id: 'owned',
        typeId: SyntheticDefinition.info.id,
        ownerId: owner.id,
        name: 'Owned',
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status: GameStatus.WaitingForPlayers,
        players: playerUserIds.map((userId) => ({
            ...seat(userId),
            status: userId === owner.id ? PlayerStatus.Joined : PlayerStatus.Reserved
        }))
    }
}

function acceptUpdates(store: FirestoreGameStore, existing: Game) {
    vi.spyOn(store, 'findGameById').mockResolvedValue(existing)
    vi.spyOn(store, 'updateGame').mockImplementation(async ({ game, fields, validator }) => {
        validator?.(game, fields)
        return [{ ...game, ...fields }, Object.keys(fields), game]
    })
}

describe('games whose owner is not a player', () => {
    it('lets a developer create a private game of invitees and keeps them informed', async () => {
        const { service, notifications, write } = fixture()
        const created = await service.createGame({
            definition: SyntheticDefinition,
            game: inviteesOnly(),
            owner: developer
        })
        expect(write).toHaveBeenCalled()
        expect(created.ownerId).toBe(developer.id)
        expect(created.players.map((player) => player.userId)).toEqual(['b', 'c', 'd'])
        expect(vi.mocked(notifications.sendNotification)).toHaveBeenCalledWith(
            expect.objectContaining({ topics: ['user-developer', 'user-b', 'user-c', 'user-d'] })
        )
    })

    it('rejects the same game from a regular user', async () => {
        const { service, write } = fixture()
        await expect(
            service.createGame({
                definition: SyntheticDefinition,
                game: inviteesOnly(),
                owner: regular
            })
        ).rejects.toThrow('must be one of its players')
        expect(write).not.toHaveBeenCalled()
    })

    it('lets a developer create a public game of open seats', async () => {
        const { service, write } = fixture()
        const openSeats = invitees.map(({ id }) => ({
            id: `player-${id}`,
            name: '',
            isHuman: true,
            status: PlayerStatus.Open
        }))
        const created = await service.createGame({
            definition: SyntheticDefinition,
            game: { ...inviteesOnly(), isPublic: true, players: openSeats },
            owner: developer
        })
        expect(write).toHaveBeenCalled()
        expect(created.ownerId).toBe(developer.id)
        expect(created.players.every((player) => player.userId === undefined)).toBe(true)
    })

    it('rejects a public game without its regular owner', async () => {
        const { service, write } = fixture()
        await expect(
            service.createGame({
                definition: SyntheticDefinition,
                game: { ...inviteesOnly(), isPublic: true },
                owner: regular
            })
        ).rejects.toThrow('must be one of its players')
        expect(write).not.toHaveBeenCalled()
    })

    it('rejects a regular owner removing themselves from their private game', async () => {
        const { service, store } = fixture()
        const existing = storedGame(regular, [regular.id, 'b', 'c'])
        acceptUpdates(store, existing)
        await expect(
            service.updateGame({
                gameId: existing.id,
                fields: { players: [...existing.players.slice(1), seat('d')] },
                user: regular
            })
        ).rejects.toThrow('must be one of its players')
    })

    it('judges an admin edit by the owner, not the admin', async () => {
        const { service, store } = fixture()
        const existing = storedGame(regular, [regular.id, 'b', 'c'])
        acceptUpdates(store, existing)
        await expect(
            service.updateGame({
                gameId: existing.id,
                fields: { players: [...existing.players.slice(1), seat('d')] },
                user: admin
            })
        ).rejects.toThrow('must be one of its players')
    })

    it("rejects a developer editing someone else's game", async () => {
        const { service, store } = fixture()
        const existing = storedGame(regular, [regular.id, 'b', 'c'])
        acceptUpdates(store, existing)
        await expect(
            service.updateGame({
                gameId: existing.id,
                fields: { players: [...existing.players.slice(1), seat('d')] },
                user: developer
            })
        ).rejects.toThrow('is not authorized')
    })

    it('allows edits that leave the players alone', async () => {
        const { service, store } = fixture()
        const existing = storedGame(regular, ['b', 'c', 'd'])
        acceptUpdates(store, existing)
        const updated = await service.updateGame({
            gameId: existing.id,
            fields: { name: 'Renamed' },
            user: regular
        })
        expect(updated.name).toBe('Renamed')
    })

    it('seats an owner who adds themselves without inviting them', async () => {
        const { service, store, tasks } = fixture()
        const existing = storedGame(developer, ['b', 'c', 'd'])
        acceptUpdates(store, existing)
        const updated = await service.updateGame({
            gameId: existing.id,
            fields: { players: [...existing.players.slice(1), seat(developer.id)] },
            user: developer
        })
        expect(findPlayerForUserId(updated, developer.id)?.status).toBe(PlayerStatus.Joined)
        expect(vi.mocked(tasks.sendGameInvitationEmail)).not.toHaveBeenCalledWith(
            expect.objectContaining({ toEmail: developer.email })
        )
    })
})

describe('owners joining their own public game', () => {
    it('seats the owner in an open seat without telling them they joined', async () => {
        const { service, store, notifications } = fixture()
        const existing: Game = {
            ...storedGame(developer, ['b']),
            isPublic: true,
            players: [
                { ...seat('b'), status: PlayerStatus.Joined },
                { id: 'open-1', name: '', isHuman: true, status: PlayerStatus.Open },
                { id: 'open-2', name: '', isHuman: true, status: PlayerStatus.Open }
            ]
        }
        acceptUpdates(store, existing)
        const joined = await service.joinGame({ user: developer, gameId: existing.id })
        expect(findPlayerForUserId(joined, developer.id)?.status).toBe(PlayerStatus.Joined)
        expect(JSON.stringify(vi.mocked(notifications.sendNotification).mock.calls)).not.toContain(
            UserNotificationAction.PlayerJoined
        )
    })
})

describe('game user ids', () => {
    const players = [
        { id: 'p1', userId: 'b', name: 'b', isHuman: true, status: PlayerStatus.Joined }
    ]

    it('lists the owner with the players', () => {
        expect(gameUserIds({ ownerId: 'owner', players })).toEqual(['owner', 'b'])
    })

    it('leaves tournament organizers out of their table games', () => {
        expect(
            gameUserIds({
                ownerId: 'organizer',
                players,
                tournament: { tournamentId: 't', stageId: 's', tableId: '1', scheduleId: 'x' }
            })
        ).toEqual(['b'])
    })
})
