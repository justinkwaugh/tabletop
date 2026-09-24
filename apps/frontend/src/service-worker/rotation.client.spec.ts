import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$env/static/public', () => ({
    PUBLIC_VAPID_KEY:
        'BPT9XmXgYYJyoO0KIH_tqHW1LQ41eqR7q0m8IojcT-7L8I7zIGgc0CkiJkUOb3iMLYuQP27Ce6KTF2Hm1_hSBmU'
}))

type Listener = (event: unknown) => void
type ShownNotification = { title: string; options: NotificationOptions }

const listeners = new Map<string, Listener>()
const shown: ShownNotification[] = []
const posted: unknown[] = []
const subscribed: PushSubscriptionOptionsInit[] = []
let subscribeError: Error | undefined
let permission: NotificationPermission

const workerScope = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    registration: {
        showNotification: async (title: string, options: NotificationOptions) => {
            shown.push({ title, options })
        },
        pushManager: {
            subscribe: async (options: PushSubscriptionOptionsInit) => {
                if (subscribeError) throw subscribeError
                subscribed.push(options)
            }
        }
    },
    clients: {
        matchAll: async () => [
            { url: 'https://site.test/game/g1', postMessage: (m: unknown) => posted.push(m) }
        ],
        openWindow: async () => {}
    }
}

vi.stubGlobal('self', workerScope)
vi.stubGlobal('Notification', {
    get permission() {
        return permission
    }
})

await import('../service-worker')

function dispatch(type: string, event: Record<string, unknown>) {
    const pending: Promise<unknown>[] = []
    listeners.get(type)?.({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) })
    return Promise.all(pending)
}

const game = { id: 'g1', typeId: 'top', name: 'Test Game' }

beforeEach(() => {
    shown.length = 0
    posted.length = 0
    subscribed.length = 0
    subscribeError = undefined
    permission = 'granted'
})

describe('service worker push handling', () => {
    it('shows a turn notification and forwards it to open windows', async () => {
        const data = {
            id: 'n1',
            type: 'user',
            action: 'isYourTurn',
            data: { user: { id: 'u1' }, game }
        }
        await dispatch('push', { data: { json: () => data } })
        expect(shown.map((s) => s.title)).toEqual(["It's your turn!"])
        expect(posted).toEqual([data])
    })

    it('shows other notifications without forwarding them', async () => {
        const data = {
            id: 'n2',
            type: 'user',
            action: 'playerJoined',
            data: { user: { id: 'u1' }, game, player: { id: 'p1', name: 'Pat' } }
        }
        await dispatch('push', { data: { json: () => data } })
        expect(shown.map((s) => s.title)).toEqual(['Player joined!'])
        expect(posted).toEqual([])
    })
})

describe('service worker subscription rotation', () => {
    it('resubscribes with the old key and tells windows which endpoint to replace', async () => {
        const key = new Uint8Array([1, 2, 3])
        await dispatch('pushsubscriptionchange', {
            oldSubscription: {
                endpoint: 'https://push.test/old',
                options: { applicationServerKey: key }
            }
        })
        expect(subscribed).toEqual([{ userVisibleOnly: true, applicationServerKey: key }])
        expect(posted).toEqual([
            { type: 'pushSubscriptionChanged', oldEndpoint: 'https://push.test/old' }
        ])
    })

    it('falls back to the configured VAPID key when the old subscription is gone', async () => {
        await dispatch('pushsubscriptionchange', { oldSubscription: null })
        expect(subscribed[0].applicationServerKey).toHaveLength(65)
        expect(posted).toEqual([{ type: 'pushSubscriptionChanged', oldEndpoint: undefined }])
    })

    it('does nothing once permission has been revoked', async () => {
        permission = 'denied'
        await dispatch('pushsubscriptionchange', { oldSubscription: null })
        expect(subscribed).toEqual([])
        expect(posted).toEqual([])
    })

    it('does not notify windows when resubscribing fails', async () => {
        subscribeError = new Error('push service unavailable')
        await dispatch('pushsubscriptionchange', { oldSubscription: null })
        expect(posted).toEqual([])
    })
})
