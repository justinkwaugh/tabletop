import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { Role, UserStatus, type User } from '@tabletop/common'
import { TabletopApi, VisibilityService } from '@tabletop/frontend-components'
import type { RealtimeConnection } from '$lib/network/realtimeConnection'
import { AuthorizationService } from './authorizationService.svelte.js'
import { NotificationService } from './notificationService.svelte.js'
import { stubLocalStorage } from '$lib/test/localStorageStub'

vi.mock('$env/static/public', () => ({
    PUBLIC_VAPID_KEY:
        'BPT9XmXgYYJyoO0KIH_tqHW1LQ41eqR7q0m8IojcT-7L8I7zIGgc0CkiJkUOb3iMLYuQP27Ce6KTF2Hm1_hSBmU'
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }))
vi.mock('@tabletop/frontend-components', () => ({
    NotificationChannel: { User: 'user', Global: 'global', GameInstance: 'gameInstance' },
    NotificationEventType: { Data: 'data', Discontinuity: 'discontinuity' },
    VisibilityService: class {
        visible = true
    },
    TabletopApi: class {
        subscribeToPushNotifications = vi.fn(async () => {})
        unsubscribeFromPushNotifications = vi.fn(async () => {})
    }
}))

type FakeSubscription = {
    endpoint: string
    unsubscribe: () => Promise<boolean>
    toJSON: () => object
}
type ServiceWorkerMessageListener = (event: MessageEvent) => Promise<void>

const serviceWorkerListeners: ServiceWorkerMessageListener[] = []
let permission: NotificationPermission
let currentSubscription: FakeSubscription | undefined
let subscribeCount: number

function makeSubscription(): FakeSubscription {
    subscribeCount += 1
    const subscription: FakeSubscription = {
        endpoint: `https://push.example/sub-${subscribeCount}`,
        unsubscribe: async () => {
            if (currentSubscription === subscription) currentSubscription = undefined
            return true
        },
        toJSON: () => ({
            endpoint: subscription.endpoint,
            expirationTime: null,
            keys: { p256dh: 'p', auth: 'a' }
        })
    }
    return subscription
}

const registration = {
    pushManager: {
        subscribe: async () => {
            if (!currentSubscription) currentSubscription = makeSubscription()
            return currentSubscription
        },
        getSubscription: async () => currentSubscription ?? null
    }
}

beforeEach(() => {
    permission = 'default'
    currentSubscription = undefined
    subscribeCount = 0
    serviceWorkerListeners.length = 0
    stubLocalStorage()
    vi.stubGlobal('navigator', {
        serviceWorker: {
            ready: Promise.resolve(registration),
            addEventListener: (_type: string, listener: ServiceWorkerMessageListener) =>
                serviceWorkerListeners.push(listener)
        }
    })
    vi.stubGlobal('window', {
        Notification: {
            get permission() {
                return permission
            },
            requestPermission: async () => {
                permission = 'granted'
                return permission
            }
        }
    })
})

function createUser(): User {
    return { id: 'user-id', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
}

function createService(user: User | undefined) {
    const realtimeConnection: RealtimeConnection = {
        setHandler: vi.fn(),
        addChannel: vi.fn(async () => {}),
        removeChannel: vi.fn(async () => {}),
        connect: vi.fn(async () => {}),
        disconnect: vi.fn()
    }
    const api = new TabletopApi()
    const authorizationService = new AuthorizationService(api, vi.fn(), vi.fn())
    if (user) authorizationService.setSessionUser(user)
    const service = new NotificationService(
        realtimeConnection,
        new VisibilityService(),
        authorizationService,
        api
    )
    return {
        service,
        subscribe: vi.mocked(api.subscribeToPushNotifications),
        unsubscribe: vi.mocked(api.unsubscribeFromPushNotifications)
    }
}

async function settled(assertion: () => void) {
    flushSync()
    await vi.waitFor(assertion)
}

describe('NotificationService push subscription lifecycle', () => {
    it('registers a push subscription on mount when permission was already granted', async () => {
        permission = 'granted'
        const { service, subscribe } = createService(createUser())
        service.onMounted()
        await settled(() => expect(subscribe).toHaveBeenCalledTimes(1))
        expect(subscribe.mock.calls[0][0]).toBe(currentSubscription)
    })

    it('registers a push subscription once the user grants permission after login', async () => {
        const { service, subscribe } = createService(createUser())
        service.onMounted()
        await settled(() => expect(subscribe).not.toHaveBeenCalled())

        const granted = await service.requestWebNotificationPermission()
        expect(granted).toBe(true)
        await settled(() => expect(subscribe).toHaveBeenCalledTimes(1))
    })

    it('replaces a rotated subscription reported by the service worker', async () => {
        permission = 'granted'
        const { service, subscribe, unsubscribe } = createService(createUser())
        service.onMounted()
        await settled(() => expect(subscribe).toHaveBeenCalledTimes(1))
        const oldEndpoint = currentSubscription?.endpoint
        currentSubscription = makeSubscription()
        for (const listener of serviceWorkerListeners) {
            await listener(
                new MessageEvent('message', {
                    data: { type: 'pushSubscriptionChanged', oldEndpoint }
                })
            )
        }
        await settled(() => expect(subscribe).toHaveBeenCalledTimes(2))
        expect(unsubscribe).toHaveBeenCalledWith(oldEndpoint)
        expect(subscribe.mock.calls[1][0]).toBe(currentSubscription)
    })

    it('does not register a subscription while no user is logged in', async () => {
        permission = 'granted'
        const { service, subscribe } = createService(undefined)
        currentSubscription = makeSubscription()
        service.onMounted()
        await settled(() => expect(subscribe).not.toHaveBeenCalled())
    })
})
