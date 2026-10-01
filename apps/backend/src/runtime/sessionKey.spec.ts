import SecureSession from '@fastify/secure-session'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { deriveSessionKey } from './sessionKey.js'

declare module '@fastify/secure-session' {
    interface SessionData {
        probe: string
    }
}

const secret = 'a-session-secret-that-is-long-enough-to-use'

async function sessionServer(options: { secret: string; salt?: string } | { key: string }) {
    const server = Fastify()
    await server.register(SecureSession, {
        sessionName: 'session',
        cookieName: 'probe',
        ...options
    })
    server.get('/write', async (request) => {
        request.session.set('probe', 'written by the secret-derived key')
        return {}
    })
    server.get('/read', async (request) => ({ probe: request.session.get('probe') ?? null }))
    return server
}

describe('deriveSessionKey', () => {
    it.each([
        ['a configured salt', 'sixteen-byte-slt'],
        ["the plugin's default salt", '']
    ])('reads sessions written with secret and %s', async (_label, salt) => {
        const writer = await sessionServer({ secret, ...(salt ? { salt } : {}) })
        const reader = await sessionServer({ key: await deriveSessionKey(secret, salt) })
        try {
            const written = await writer.inject({ method: 'GET', url: '/write' })
            const cookie = written.cookies.find((candidate) => candidate.name === 'probe')
            expect(cookie).toBeDefined()
            const read = await reader.inject({
                method: 'GET',
                url: '/read',
                cookies: { probe: cookie?.value ?? '' }
            })
            expect(read.json()).toEqual({ probe: 'written by the secret-derived key' })
        } finally {
            await Promise.all([writer.close(), reader.close()])
        }
    })

    it('rejects the secrets and salts the plugin would reject', async () => {
        await expect(deriveSessionKey('too short', '')).rejects.toThrow('at least 32 bytes')
        await expect(deriveSessionKey(secret, 'short')).rejects.toThrow('16 bytes')
    })
})
