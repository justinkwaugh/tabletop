import { describe, expect, it } from 'vitest'
import { ExternalAuthService } from '@tabletop/common'
import { MemoryOAuthStateStore } from '../persistence/memory/oauthStateStore.js'
import {
    InvalidOAuthStateError,
    OAUTH_STATE_LIFETIME_SECONDS,
    type OAuthStateClaim
} from './oauthState.js'
import { OAuthStateService, oauthStatePurpose } from './oauthStateService.js'

const loginClaim: OAuthStateClaim = {
    provider: ExternalAuthService.Discord,
    purpose: 'login',
    redirectUri: 'https://site.test/oauth/discord',
    binding: { kind: 'attempt', attemptId: 'attempt-1' }
}
const linkClaim: OAuthStateClaim = {
    provider: ExternalAuthService.Discord,
    purpose: 'link',
    redirectUri: 'https://site.test/oauth/discord/link',
    binding: { kind: 'session', sessionId: 'session-a', userId: 'account-a' }
}

function fixture(start = new Date('2026-10-27T12:00:00.000Z')) {
    let now = start
    const store = new MemoryOAuthStateStore()
    const service = new OAuthStateService(store, { now: () => now })
    return {
        store,
        service,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000))
    }
}

async function rejection(promise: Promise<unknown>): Promise<string> {
    try {
        await promise
    } catch (error) {
        if (error instanceof InvalidOAuthStateError) {
            return String(error.metadata.reason)
        }
        throw error
    }
    throw new Error('expected the state to be rejected')
}

describe('OAuth state issue and consumption', () => {
    it('issues an unpredictable state labelled with its purpose and consumes it once', async () => {
        const { service, store } = fixture()
        const { state } = await service.issue(loginClaim)
        expect(state).toMatch(/^login\.[0-9A-Za-z]{32}$/)
        expect(oauthStatePurpose(state)).toBe('login')
        await expect(service.consume(state, loginClaim)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
        expect(await rejection(service.consume(state, loginClaim))).toBe('unknown')
    })

    it('rejects a state that was never issued', async () => {
        const { service } = fixture()
        expect(await rejection(service.consume('login.forged', loginClaim))).toBe('unknown')
        expect(await rejection(service.consume('', loginClaim))).toBe('purpose')
    })

    it('rejects a state after its lifetime and burns it', async () => {
        const { service, store, advance } = fixture()
        const { state } = await service.issue(loginClaim)
        advance(OAUTH_STATE_LIFETIME_SECONDS)
        expect(await rejection(service.consume(state, loginClaim))).toBe('expired')
        expect(store.size).toBe(0)
    })

    it('rejects a login state presented for linking and a link state presented for login', async () => {
        const { service } = fixture()
        const login = await service.issue(loginClaim)
        const link = await service.issue(linkClaim)
        expect(await rejection(service.consume(login.state, linkClaim))).toBe('purpose')
        expect(await rejection(service.consume(link.state, loginClaim))).toBe('purpose')
    })

    it('rejects a state presented by another session or attempt and burns it', async () => {
        const { service, store } = fixture()
        const { state } = await service.issue(linkClaim)
        expect(
            await rejection(
                service.consume(state, {
                    ...linkClaim,
                    binding: { kind: 'session', sessionId: 'session-b', userId: 'account-a' }
                })
            )
        ).toBe('binding')
        expect(store.size).toBe(0)
        const attempt = await service.issue(loginClaim)
        expect(
            await rejection(
                service.consume(attempt.state, {
                    ...loginClaim,
                    binding: { kind: 'attempt', attemptId: 'attempt-2' }
                })
            )
        ).toBe('binding')
    })

    it('rejects a state whose redirect or provider differs from the issued claim', async () => {
        const { service } = fixture()
        const redirect = await service.issue(loginClaim)
        expect(
            await rejection(
                service.consume(redirect.state, {
                    ...loginClaim,
                    redirectUri: 'https://site.test/oauth/discord/link'
                })
            )
        ).toBe('binding')
        const provider = await service.issue(loginClaim)
        expect(
            await rejection(
                service.consume(provider.state, {
                    ...loginClaim,
                    provider: ExternalAuthService.Google
                })
            )
        ).toBe('binding')
    })
})
