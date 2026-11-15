import { describe, expect, it } from 'vitest'
import { ExternalAuthService } from '@tabletop/common'
import {
    InvalidOAuthStateError,
    issueProviderAuthorization,
    OAUTH_STATE_LIFETIME_SECONDS,
    type ProviderAuthorizationAttempt,
    type ProviderAuthorizationRequest,
    verifyProviderAuthorization
} from './providerAuthorization.js'

const NOW = new Date('2026-10-27T12:00:00.000Z')
const login: ProviderAuthorizationRequest = {
    provider: ExternalAuthService.Discord,
    purpose: 'login',
    redirectUri: 'https://site.test/oauth/discord'
}

function refusal(
    attempt: ProviderAuthorizationAttempt | undefined,
    state: string,
    expected: ProviderAuthorizationRequest = login,
    now = NOW
): string | undefined {
    try {
        verifyProviderAuthorization(attempt, state, expected, now)
    } catch (error) {
        if (error instanceof InvalidOAuthStateError) {
            return String(error.metadata.reason)
        }
        throw error
    }
    return undefined
}

describe('Provider Authorization Attempts', () => {
    it('issues an unpredictable state labelled with its purpose that lasts ten minutes', () => {
        const attempt = issueProviderAuthorization(login, NOW)
        expect(attempt).toEqual({
            ...login,
            state: expect.stringMatching(/^login\.[0-9A-Za-z]{32}$/),
            expiresAt: new Date(NOW.getTime() + OAUTH_STATE_LIFETIME_SECONDS * 1000)
        })
        expect(issueProviderAuthorization(login, NOW).state).not.toBe(attempt.state)
        expect(refusal(attempt, attempt.state)).toBeUndefined()
    })

    it('refuses a callback when no attempt is held or its state differs', () => {
        const attempt = issueProviderAuthorization(login, NOW)
        expect(refusal(undefined, attempt.state)).toBe('missing')
        expect(refusal(attempt, 'login.0123456789abcdefghijklmnopqrstuv')).toBe('state')
        expect(refusal(attempt, '')).toBe('state')
    })

    it('refuses an attempt presented for another purpose, redirect or provider', () => {
        const attempt = issueProviderAuthorization(login, NOW)
        expect(refusal(attempt, attempt.state, { ...login, purpose: 'link' })).toBe('binding')
        expect(
            refusal(attempt, attempt.state, {
                ...login,
                redirectUri: 'https://site.test/oauth/discord/link'
            })
        ).toBe('binding')
        expect(
            refusal(attempt, attempt.state, { ...login, provider: ExternalAuthService.Google })
        ).toBe('binding')
    })

    it('refuses an attempt from the end of its lifetime', () => {
        const attempt = issueProviderAuthorization(login, NOW)
        const almost = new Date(attempt.expiresAt.getTime() - 1)
        expect(refusal(attempt, attempt.state, login, almost)).toBeUndefined()
        expect(refusal(attempt, attempt.state, login, attempt.expiresAt)).toBe('expired')
    })
})
