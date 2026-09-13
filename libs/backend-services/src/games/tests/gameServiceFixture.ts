import { vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import { PlayerStatus, type GameDefinition, type User } from '@tabletop/common'
import { SyntheticRuntime } from './syntheticGame.js'
import { GameService } from '../gameService.js'
import { FirestoreGameStore } from '../../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../../cache/cacheService.js'
import { UserService } from '../../users/userService.js'
import { TokenService } from '../../tokens/tokenService.js'
import type { TaskService } from '../../tasks/taskService.js'
import type { NotificationService } from '../../notifications/notificationService.js'

export function gameServiceFixture(
    definition: GameDefinition,
    admin: User,
    dependencies?: { firestore: Firestore; cache: RedisCacheService }
) {
    const firestore = dependencies?.firestore ?? new Firestore({ projectId: 'seeding-unit-test' })
    const cache: RedisCacheService =
        dependencies?.cache ?? Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, firestore)
    const unused = vi.fn(async () => {
        throw Error('Unexpected dependency call')
    })
    const tasks: TaskService = {
        createPushTask: unused,
        sendVerificationEmail: unused,
        sendPasswordResetEmail: unused,
        sendAuthVerificationEmail: unused,
        sendAccountChangeNotificationEmail: unused,
        sendGameInvitationEmail: unused,
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
    const users: UserService = Object.create(UserService.prototype)
    const service = new GameService(
        store,
        users,
        TokenService.prototype,
        tasks,
        notifications,
        cache,
        { synthetic: definition }
    )
    const game = SyntheticRuntime.initializer.initializeGame(
        {
            id: 'seeded-game',
            typeId: definition.info.id,
            ownerId: admin.id,
            isPublic: true,
            config: {},
            players: ['p1', 'p2', 'p3'].map((id) => ({
                id,
                name: '',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    return { service, store, firestore, cache, notifications, game, users }
}
