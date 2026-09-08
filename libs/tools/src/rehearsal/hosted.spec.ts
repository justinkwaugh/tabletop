import { describe, expect, it } from 'vitest'
const hostedModule = './hosted.mjs'
const { runHosted } = await import(hostedModule)

const local = {
    site: 'http://localhost:5173',
    backend: 'http://localhost:3000',
    firestoreHost: 'firebase:8080',
    redisHost: 'cache:6379',
    project: 'demo-tabletop'
}

describe('hosted rehearsal isolation', () => {
    it.each([
        [{ site: 'https://example.com' }, 'loopback'],
        [{ backend: 'http://example.com' }, 'loopback'],
        [{ firestoreHost: 'firestore.googleapis.com:443' }, 'local emulator'],
        [{ redisHost: 'redis.example.com:6379' }, 'local emulator'],
        [{ project: 'production-tabletop' }, 'demo-']
    ])(
        'rejects nonlocal configuration before importing any fixtures: %j',
        async (override, message) => {
            await expect(
                runHosted(undefined, undefined, { ...local, ...override })
            ).rejects.toThrow(message)
        }
    )
})
