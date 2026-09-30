import { generateKeyPairSync, sign } from 'node:crypto'
import Fastify from 'fastify'
import rawBody from 'fastify-raw-body'
import { describe, expect, it, vi } from 'vitest'

const signingKey = await vi.hoisted(async () => {
    const crypto = await import('node:crypto')
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
    const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
    process.env['DISCORD_PUBLIC_KEY'] = rawPublicKey.toString('hex')
    return privateKey
})

const { default: eventsRoute } = await import('./events.js')

const pingBody = JSON.stringify({ version: 1, application_id: 'app-1', type: 0 })

function signatureHeaders(body: string, key = signingKey) {
    const timestamp = '1790000000'
    return {
        'content-type': 'application/json',
        'x-signature-timestamp': timestamp,
        'x-signature-ed25519': sign(null, Buffer.from(timestamp + body), key).toString('hex')
    }
}

async function createServer() {
    const server = Fastify()
    await server.register(rawBody, { global: false, runFirst: true })
    const handleWebhookEvent = vi.fn(async () => undefined)
    Reflect.set(server, 'discordService', { handleWebhookEvent })
    await server.register(eventsRoute)
    return { server, handleWebhookEvent }
}

describe('Discord webhook events route', () => {
    it('acknowledges a signed event with 204 and hands it to the Discord service', async () => {
        const { server, handleWebhookEvent } = await createServer()

        const response = await server.inject({
            method: 'POST',
            url: '/events',
            headers: signatureHeaders(pingBody),
            payload: pingBody
        })

        expect(response.statusCode).toBe(204)
        expect(handleWebhookEvent).toHaveBeenCalledWith(JSON.parse(pingBody))
    })

    it('rejects an event signed with a different key', async () => {
        const { server, handleWebhookEvent } = await createServer()
        const { privateKey: otherKey } = generateKeyPairSync('ed25519')

        const response = await server.inject({
            method: 'POST',
            url: '/events',
            headers: signatureHeaders(pingBody, otherKey),
            payload: pingBody
        })

        expect(response.statusCode).toBe(401)
        expect(handleWebhookEvent).not.toHaveBeenCalled()
    })

    it('rejects an unsigned event', async () => {
        const { server, handleWebhookEvent } = await createServer()

        const response = await server.inject({
            method: 'POST',
            url: '/events',
            headers: { 'content-type': 'application/json' },
            payload: pingBody
        })

        expect(response.statusCode).toBe(401)
        expect(handleWebhookEvent).not.toHaveBeenCalled()
    })
})
