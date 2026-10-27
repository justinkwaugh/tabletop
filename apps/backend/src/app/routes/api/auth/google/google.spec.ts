import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('FRONTEND_HOST', 'https://site.test')
})
vi.mock('google-auth-library', () => ({
    OAuth2Client: class {
        async verifyIdToken({ idToken }: { idToken: string }) {
            const subjects: Record<string, string> = {
                'victim-credential': 'victim-google-sub',
                'attacker-credential': 'attacker-google-sub'
            }
            const sub = subjects[idToken]
            return { getPayload: () => (sub ? { sub, email: `${sub}@example.test` } : undefined) }
        }
    }
}))
import googleLink from './link.js'
import googleReauthenticate from './reauthenticate.js'
import { closing, discordFixture, type DiscordFixture } from '../../../../tests/discordFixture.js'

const servers = new Set<FastifyInstance>()
afterEach(closing(servers))

async function fixture(): Promise<DiscordFixture> {
    const created = await discordFixture()
    await created.server.register(googleLink, { prefix: '/auth/google' })
    await created.server.register(googleReauthenticate, { prefix: '/auth/google' })
    servers.add(created.server)
    return created
}

describe('Google linking and reauthentication', () => {
    it('requires Recent Authentication to link a Google identity', async () => {
        const f = await fixture()
        const stale = await f.signIn('victim', 'challenge')
        const refused = await f.post(
            '/auth/google/link',
            { credential: 'victim-credential' },
            stale.cookie
        )
        expect(refused.statusCode).toBe(403)
        expect(f.linkExternalAccount).not.toHaveBeenCalled()
        const fresh = await f.signIn('victim')
        const linked = await f.post(
            '/auth/google/link',
            { credential: 'victim-credential' },
            fresh.cookie
        )
        expect(linked.statusCode).toBe(200)
        expect(linked.json().payload.user.externalIds).toEqual(['google:victim-google-sub'])
    })

    it('reauthenticates only through a Google identity linked to the Account', async () => {
        const f = await fixture()
        f.users.set('victim', {
            ...f.users.get('victim')!,
            externalIds: ['google:victim-google-sub']
        })
        const victim = await f.signIn('victim', 'challenge')
        const foreign = await f.post(
            '/auth/google/reauthenticate',
            { credential: 'attacker-credential' },
            victim.cookie
        )
        expect(foreign.statusCode).toBe(401)
        expect((await f.sessionStore.find(victim.sessionId))?.authenticatedAt).toBeUndefined()
        const own = await f.post(
            '/auth/google/reauthenticate',
            { credential: 'victim-credential' },
            victim.cookie
        )
        expect(own.statusCode).toBe(200)
        expect((await f.sessionStore.find(victim.sessionId))?.authenticatedAt).toEqual(
            new Date('2026-10-27T12:00:00.000Z')
        )
        expect(f.users.get('victim')?.externalIds).toEqual(['google:victim-google-sub'])
        expect(f.linkExternalAccount).not.toHaveBeenCalled()
    })
})
