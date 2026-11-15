import fastifyAuth from '@fastify/auth'
import {
    RegistrationLimitExceededError,
    TransportType,
    userTopic,
    WebPushTransport
} from '@tabletop/backend-services'
import { Role, UserStatus, type User } from '@tabletop/common'
import Fastify from 'fastify'
import { createECDH, randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorStatusCode } from '../../../../lib/errorStatusCode.js'
import subscribeRoutes from './subscribe.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const user: User = { id: 'user-1', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/dGVzdA:APA91bFakeRegistrationToken'

function browserSubscription(endpoint: string) {
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    return {
        endpoint,
        expirationTime: null,
        keys: {
            p256dh: ecdh.getPublicKey().toString('base64url'),
            auth: randomBytes(16).toString('base64url')
        }
    }
}

async function createServer(register = vi.fn(async () => {})) {
    const server = Fastify()
    server.setErrorHandler((error, _request, reply) =>
        reply
            .code(errorStatusCode(error))
            .send({ status: 'error', error: { name: error.name, message: error.message } })
    )
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => {})
    Reflect.set(server, 'notificationService', { registerNotificationSubscription: register })
    await server.register(subscribeRoutes)
    return { server, register }
}

describe('web push subscribe route', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('registers a supported browser push subscription under the user topic', async () => {
        const { server, register } = await createServer()
        servers.add(server)
        const subscription = browserSubscription(FCM_ENDPOINT)
        const response = await server.inject({
            method: 'POST',
            url: '/subscribe',
            payload: { subscription }
        })
        expect(response.statusCode).toBe(200)
        expect(register).toHaveBeenCalledWith({
            topic: userTopic(user.id),
            subscription: expect.objectContaining({
                id: WebPushTransport.webPushSubscriptionIdentifierFromEndpoint(FCM_ENDPOINT).id,
                transport: TransportType.WebPush,
                endpoint: FCM_ENDPOINT,
                keys: subscription.keys
            })
        })
    })

    it.each([
        'https://127.0.0.1:8443/internal',
        'https://169.254.169.254/latest/meta-data/',
        'https://[::ffff:127.0.0.1]/internal',
        'http://fcm.googleapis.com/fcm/send/token',
        'https://fcm.googleapis.com.evil.test/fcm/send/token',
        'https://user:pass@fcm.googleapis.com/fcm/send/token'
    ])('refuses to register %s', async (endpoint) => {
        const { server, register } = await createServer()
        servers.add(server)
        const response = await server.inject({
            method: 'POST',
            url: '/subscribe',
            payload: { subscription: browserSubscription(endpoint) }
        })
        expect(response.statusCode).toBe(400)
        expect(response.json().error.name).toBe('UnsupportedWebPushSubscriptionError')
        expect(register).not.toHaveBeenCalled()
    })

    it('refuses a key that is not a point on the P-256 curve', async () => {
        const { server, register } = await createServer()
        servers.add(server)
        const subscription = browserSubscription(FCM_ENDPOINT)
        const offCurve = Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64)]).toString(
            'base64url'
        )
        const response = await server.inject({
            method: 'POST',
            url: '/subscribe',
            payload: {
                subscription: { ...subscription, keys: { ...subscription.keys, p256dh: offCurve } }
            }
        })
        expect(response.statusCode).toBe(400)
        expect(response.json().error.name).toBe('UnsupportedWebPushSubscriptionError')
        expect(response.json().error.message).toContain('P-256 curve')
        expect(register).not.toHaveBeenCalled()
    })

    it('refuses an oversized endpoint at the schema', async () => {
        const { server, register } = await createServer()
        servers.add(server)
        const response = await server.inject({
            method: 'POST',
            url: '/subscribe',
            payload: { subscription: browserSubscription(`${FCM_ENDPOINT}/${'a'.repeat(2048)}`) }
        })
        expect(response.statusCode).toBe(400)
        expect(register).not.toHaveBeenCalled()
    })

    it('reports a registration limit as a client error', async () => {
        const { server } = await createServer(
            vi.fn(async () => {
                throw new RegistrationLimitExceededError({
                    transport: TransportType.WebPush,
                    topic: userTopic(user.id),
                    limit: 20
                })
            })
        )
        servers.add(server)
        const response = await server.inject({
            method: 'POST',
            url: '/subscribe',
            payload: { subscription: browserSubscription(FCM_ENDPOINT) }
        })
        expect(response.statusCode).toBe(400)
        expect(response.json().error.name).toBe('RegistrationLimitExceededError')
    })
})
