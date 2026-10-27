import { type Notification, NotificationCategory } from '@tabletop/common'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import net from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    BlockedDestinationError,
    UnsupportedWebPushSubscriptionError
} from '../notificationErrors.js'
import { FCM_ENDPOINT, webPushClientData } from '../tests/webPushFixtures.js'
import type { WebPushSubscription } from '../subscriptions/webPushSubscription.js'
import { TransportType } from './notificationTransport.js'
import { PublicInternetHttpsAgent } from './publicInternetAgent.js'
import { WEB_PUSH_SOCKET_TIMEOUT_MS, WebPushTransport } from './webPushTransport.js'

const notification: Notification = {
    id: 'n1',
    type: NotificationCategory.User,
    action: 'test',
    data: {}
}

type ObservedRequest = https.RequestOptions

function acceptEveryRequest(): ObservedRequest[] {
    const observed: ObservedRequest[] = []
    vi.spyOn(https, 'request').mockImplementation((...args: unknown[]) => {
        const [options, onResponse] = args
        if (typeof options !== 'object' || options === null || typeof onResponse !== 'function') {
            throw new Error('unexpected https.request call shape')
        }
        observed.push(options)
        const request = Object.assign(new EventEmitter(), {
            write: () => true,
            end: () => {
                const response = Object.assign(new EventEmitter(), {
                    statusCode: 201,
                    headers: {}
                })
                onResponse(response)
                queueMicrotask(() => response.emit('end'))
                return request
            },
            destroy: () => request,
            setTimeout: () => request
        })
        return request as unknown as ReturnType<typeof https.request>
    })
    return observed
}

function storedSubscription(endpoint: string): WebPushSubscription {
    return {
        id: 'legacy',
        transport: TransportType.WebPush,
        ...webPushClientData(endpoint)
    }
}

describe('web push transport', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('rejects an unsupported destination before it can be registered', () => {
        expect(() =>
            WebPushTransport.webPushSubscriptionFromClientData(
                webPushClientData('https://127.0.0.1:8443/internal')
            )
        ).toThrow(UnsupportedWebPushSubscriptionError)
    })

    it('keeps only the subscription fields it understands', () => {
        const data = webPushClientData(FCM_ENDPOINT)
        const subscription = WebPushTransport.webPushSubscriptionFromClientData({
            ...data,
            ...{ extra: 'ignored' }
        })
        expect(subscription).toEqual({
            id: WebPushTransport.webPushSubscriptionIdentifierFromEndpoint(FCM_ENDPOINT).id,
            transport: TransportType.WebPush,
            endpoint: FCM_ENDPOINT,
            expirationTime: null,
            keys: data.keys
        })
    })

    it('purges a previously stored subscription whose destination is not a push service without connecting', async () => {
        const observed = acceptEveryRequest()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const transport = new WebPushTransport()
        const result = await transport.sendNotification(
            storedSubscription('https://127.0.0.1:8443/internal'),
            notification
        )
        expect(result).toEqual({ success: false, unregister: true })
        expect(observed).toHaveLength(0)
    })

    it('sends to a supported push service through the restricted agent with a socket timeout', async () => {
        const observed = acceptEveryRequest()
        const transport = new WebPushTransport()
        const result = await transport.sendNotification(
            storedSubscription(FCM_ENDPOINT),
            notification
        )
        expect(result).toEqual({ success: true, unregister: false })
        expect(observed).toHaveLength(1)
        expect(observed[0]).toMatchObject({
            hostname: 'fcm.googleapis.com',
            path: '/fcm/send/dGVzdA:APA91bFakeRegistrationToken',
            method: 'POST',
            timeout: WEB_PUSH_SOCKET_TIMEOUT_MS
        })
        expect(observed[0].agent).toBe(transport.agent)
        expect(transport.agent).toBeInstanceOf(PublicInternetHttpsAgent)
    })

    it('fails the attempt without unregistering when the push service resolves to a private address', async () => {
        const logged: unknown[][] = []
        vi.spyOn(console, 'log').mockImplementation((...args) => {
            logged.push(args)
        })
        const resolve = vi.fn(
            (
                _hostname: string,
                _options: unknown,
                callback: (error: null, addresses: { address: string; family: number }[]) => void
            ) => callback(null, [{ address: '10.0.0.5', family: 4 }])
        )
        const transport = new WebPushTransport(new PublicInternetHttpsAgent({ resolve }))
        const result = await transport.sendNotification(
            storedSubscription(FCM_ENDPOINT),
            notification
        )
        expect(result).toEqual({ success: false, unregister: false })
        expect(resolve).toHaveBeenCalledWith(
            'fcm.googleapis.com',
            expect.anything(),
            expect.any(Function)
        )
        expect(logged.flat().some((entry) => entry instanceof BlockedDestinationError)).toBe(true)
    })

    it('never opens a socket to an IP literal even if one reached the agent', async () => {
        const connect = vi.spyOn(net.Socket.prototype, 'connect')
        const transport = new WebPushTransport()
        const error = await new Promise<Error>((resolve, reject) => {
            const request = https.request(
                {
                    hostname: '169.254.169.254',
                    path: '/computeMetadata/v1/',
                    agent: transport.agent
                },
                () => reject(new Error('connected'))
            )
            request.on('error', resolve)
            request.end()
        })
        expect(error).toBeInstanceOf(BlockedDestinationError)
        expect(connect).not.toHaveBeenCalled()
    })
})
