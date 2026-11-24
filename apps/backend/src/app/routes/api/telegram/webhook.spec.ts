import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import webhookRoute from './webhook.js'

const update = { update_id: 1, message: { chat: { id: 42, type: 'private' }, text: '/stop' } }

async function createServer(handleUpdate = vi.fn(async () => undefined)) {
    const server = Fastify()
    Reflect.set(server, 'telegramService', {
        isWebhookSecret: (header: string | undefined) => header === 'webhook-secret',
        handleUpdate
    })
    await server.register(webhookRoute)
    return { server, handleUpdate }
}

describe('Telegram webhook route', () => {
    it('hands an update with the right secret to the Telegram service', async () => {
        const { server, handleUpdate } = await createServer()

        const response = await server.inject({
            method: 'POST',
            url: '/webhook',
            headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' },
            payload: update
        })

        expect(response.statusCode).toBe(200)
        expect(handleUpdate).toHaveBeenCalledWith(update)
    })

    it('rejects an update without the secret', async () => {
        const { server, handleUpdate } = await createServer()

        const response = await server.inject({ method: 'POST', url: '/webhook', payload: update })

        expect(response.statusCode).toBe(401)
        expect(handleUpdate).not.toHaveBeenCalled()
    })

    it('still answers 200 when handling fails, so Telegram does not redeliver', async () => {
        const { server } = await createServer(
            vi.fn(async () => {
                throw new Error('Firestore down')
            })
        )
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const response = await server.inject({
            method: 'POST',
            url: '/webhook',
            headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' },
            payload: update
        })

        expect(response.statusCode).toBe(200)
    })
})
