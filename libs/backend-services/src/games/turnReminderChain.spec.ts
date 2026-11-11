import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import {
    GameStatus,
    NotificationCategory,
    PlayerStatus,
    Role,
    UserNotificationAction,
    UserStatus,
    weekReminderHours,
    type Game,
    type User
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import { DefaultNotificationService } from '../notifications/defaultNotificationService.js'
import { EnvService } from '../env/envService.js'
import { SyntheticDefinition } from './tests/syntheticGame.js'
import { TURN_REMINDER_DELAYS, TurnReminderTask } from './turnReminders.js'

const HOUR = 60 * 60
const LAST_REMINDER_INDEX = TURN_REMINDER_DELAYS.length - 1

afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
})

const players: User[] = ['a', 'b'].map((id) => ({
    id,
    username: id,
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}))

function fixture({
    activePlayerIds = ['p0'],
    local = false,
    recipient = {},
    status = GameStatus.Started
}: {
    activePlayerIds?: string[]
    local?: boolean
    recipient?: Partial<User>
    status?: GameStatus
} = {}) {
    const game: Game = {
        id: 'turns',
        typeId: 'synthetic',
        ownerId: 'a',
        name: 'Turns',
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status,
        activePlayerIds,
        players: players.map((player, index) => ({
            id: `p${index}`,
            userId: player.id,
            name: player.username ?? player.id,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    }
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const cached = new Map<string, unknown>()
    vi.spyOn(cache, 'get').mockImplementation(async (key) => ({
        value: cached.get(key),
        cached: cached.has(key)
    }))
    vi.spyOn(cache, 'set').mockImplementation(async (key, value) => {
        cached.set(key, value)
    })
    const store = new FirestoreGameStore(cache, new Firestore({ projectId: 'turn-reminder-test' }))
    vi.spyOn(store, 'findGameById').mockResolvedValue(structuredClone(game))
    vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) => {
        const player = players.find((candidate) => candidate.id === id)
        return player && id === 'a' ? { ...player, ...recipient } : player
    })
    const notifications: DefaultNotificationService = Object.create(
        DefaultNotificationService.prototype
    )
    vi.spyOn(notifications, 'sendNotification').mockResolvedValue()
    const tasks: LocalTaskService = Object.create(LocalTaskService.prototype)
    vi.spyOn(tasks, 'createPushTask').mockResolvedValue()
    vi.spyOn(EnvService, 'isLocal').mockReturnValue(local)
    const service = new GameService(
        store,
        UserService.prototype,
        TokenService.prototype,
        tasks,
        notifications,
        cache,
        { synthetic: SyntheticDefinition }
    )

    const chainKey = 'turn-notification-a-turns'
    const startChain = (fields: Pick<TurnReminderTask, 'reminderIndex' | 'delay'>) => {
        cached.set(chainKey, 'current')
        return { userId: 'a', gameId: 'turns', notificationId: 'current', ...fields }
    }
    const sentReminders = () =>
        vi
            .mocked(notifications.sendNotification)
            .mock.calls.map(([{ notification }]) => notification)
    const queuedReminders = () =>
        vi
            .mocked(tasks.createPushTask)
            .mock.calls.map(([{ payload }]) => payload)
            .filter((payload) => Value.Check(TurnReminderTask, payload))
    const queuedDelays = () =>
        vi.mocked(tasks.createPushTask).mock.calls.map(([{ inSeconds }]) => inSeconds)
    return {
        service,
        cached,
        chainKey,
        startChain,
        sentReminders,
        queuedReminders,
        queuedDelays
    }
}

describe('turn reminder chain', () => {
    it('sends the reminder and queues the next one after its delay', async () => {
        const { service, cached, chainKey, startChain, sentReminders, queuedReminders } = fixture()
        await service.notifyIsYourTurn(startChain({ reminderIndex: 0 }))

        expect(sentReminders()).toEqual([
            expect.objectContaining({
                id: 'current',
                type: NotificationCategory.User,
                action: UserNotificationAction.IsYourTurn,
                data: expect.objectContaining({ user: { id: 'a' } })
            })
        ])
        const [next] = queuedReminders()
        expect(next).toEqual({
            userId: 'a',
            gameId: 'turns',
            notificationId: expect.any(String),
            reminderIndex: 1,
            delay: HOUR
        })
        expect(cached.get(chainKey)).toBe(next.notificationId)
    })

    it('ends the chain after the last reminder', async () => {
        const { service, startChain, sentReminders, queuedReminders } = fixture()
        await service.notifyIsYourTurn(startChain({ reminderIndex: LAST_REMINDER_INDEX }))
        expect(sentReminders()).toHaveLength(1)
        expect(queuedReminders()).toEqual([])
    })

    it('sends only the first reminder when running locally', async () => {
        const { service, startChain, sentReminders, queuedReminders } = fixture({ local: true })
        await service.notifyIsYourTurn(startChain({ reminderIndex: 0 }))
        expect(sentReminders()).toHaveLength(1)
        expect(queuedReminders()).toEqual([])
    })

    it('drops a reminder from a chain that was replaced', async () => {
        const { service, cached, chainKey, startChain, sentReminders, queuedReminders } = fixture()
        const replaced = startChain({ reminderIndex: 0 })
        cached.set(chainKey, 'newer')
        await service.notifyIsYourTurn(replaced)
        expect(sentReminders()).toEqual([])
        expect(queuedReminders()).toEqual([])
    })

    it('stops once the player is no longer active', async () => {
        const { service, startChain, sentReminders, queuedReminders } = fixture({
            activePlayerIds: ['p1']
        })
        await service.notifyIsYourTurn(startChain({ reminderIndex: 0 }))
        expect(sentReminders()).toEqual([])
        expect(queuedReminders()).toEqual([])
    })

    it('stops once the game has ended, even if it still lists the player as active', async () => {
        const { service, startChain, sentReminders, queuedReminders } = fixture({
            status: GameStatus.Finished
        })
        await service.notifyIsYourTurn(startChain({ reminderIndex: 0 }))
        expect(sentReminders()).toEqual([])
        expect(queuedReminders()).toEqual([])
    })

    it('continues a task queued before reminders were numbered', async () => {
        const { service, startChain, queuedReminders } = fixture()
        await service.notifyIsYourTurn(startChain({ delay: 4 * HOUR }))
        expect(queuedReminders()).toEqual([
            expect.objectContaining({ reminderIndex: 3, delay: 8 * HOUR })
        ])
    })

    it('queues a later reminder for the start of the next reminder hour', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'))
        const { service, cached, chainKey, startChain, queuedReminders, queuedDelays } = fixture({
            recipient: {
                timeZone: 'America/Chicago',
                preferences: {
                    preventWebNotificationPrompt: false,
                    preferredColorsEnabled: false,
                    preferredColors: [],
                    reminderHours: weekReminderHours([18, 19, 20, 21])
                }
            }
        })
        await service.notifyIsYourTurn(startChain({ reminderIndex: 2 }))

        const [next] = queuedReminders()
        expect(next).toEqual(expect.objectContaining({ reminderIndex: 3, delay: 8 * HOUR }))
        expect(queuedDelays()).toEqual([11 * HOUR])
        expect(cached.get(chainKey)).toBe(next.notificationId)
    })
})
