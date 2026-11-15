import { TokenType } from './dataToken.js'
import type { Transaction } from '@google-cloud/firestore'
import { describe, expect, it } from 'vitest'
import { assertExists, AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS } from '@tabletop/common'
import { MemoryTokenStore } from '../persistence/memory/tokenStore.js'
import type { TokenStore } from '../persistence/stores/tokenStore.js'
import {
    type AuthenticationChallengeClaim,
    formatSetPasswordChallenge,
    InvalidChallengeError,
    parseSetPasswordChallenge
} from './authenticationChallenge.js'
import { TokenService } from './tokenService.js'

const transaction: Transaction = Object.create(null)

const setPassword: AuthenticationChallengeClaim = {
    type: TokenType.PasswordReset,
    userId: 'account-a',
    email: 'a@example.test'
}
const verification: AuthenticationChallengeClaim = {
    type: TokenType.EmailVerification,
    userId: 'account-a',
    email: 'a@example.test'
}
const emailChange: AuthenticationChallengeClaim = {
    type: TokenType.SensitiveChange,
    userId: 'account-a',
    email: 'a@example.test',
    operation: { email: 'next@example.test', password: false }
}

function fixture(start = new Date('2026-10-27T12:00:00.000Z')) {
    let now = start
    const store = new MemoryTokenStore()
    const service = new TokenService(store, { now: () => now })
    const consume = (secret: string, expected: AuthenticationChallengeClaim) =>
        service.consumeChallenge(secret, expected)(transaction, { addKeys: async () => {} })
    return {
        store,
        service,
        consume,
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000))
    }
}

async function rejection(promise: Promise<unknown>): Promise<string> {
    try {
        await promise
    } catch (error) {
        if (error instanceof InvalidChallengeError) {
            return String(error.metadata.reason)
        }
        throw error
    }
    throw new Error('expected the challenge to be rejected')
}

describe('Authentication Challenge issue and consumption', () => {
    it('issues a secret with the fifteen-minute expiry and consumes it exactly once', async () => {
        const { service, store, consume } = fixture()
        const { secret, expiresAt } = await service.issueChallenge(setPassword)
        expect(secret).toMatch(/^[2-9A-HJ-NP-Za-km-z]{32}$/)
        expect(expiresAt).toEqual(
            new Date(
                Date.parse('2026-10-27T12:00:00.000Z') +
                    AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS * 1000
            )
        )
        expect(expiresAt.getTime() - Date.parse('2026-10-27T12:00:00.000Z')).toBe(15 * 60 * 1000)
        await expect(consume(secret, setPassword)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
        expect(await rejection(consume(secret, setPassword))).toBe('unknown')
    })

    it('issues short codes for challenges typed by hand and never stores a secret in clear', async () => {
        const { service, store } = fixture()
        const { secret } = await service.issueChallenge(verification)
        expect(secret).toMatch(/^[2-9A-HJ-NP-Za-km-z]{6}$/)
        const stored = await store.find(`${TokenType.EmailVerification}:account-a`)
        expect(stored).toBeDefined()
        expect(JSON.stringify(stored)).not.toContain(secret)
        expect(stored?.data.secretHash).not.toBe(secret)
    })

    it('rejects a wrong secret without consuming the challenge', async () => {
        const { service, consume } = fixture()
        const { secret } = await service.issueChallenge(verification)
        expect(await rejection(consume('wrong1', verification))).toBe('secret')
        await expect(consume(secret, verification)).resolves.toBeUndefined()
    })

    it('rejects an expired challenge', async () => {
        const { service, consume, advance } = fixture()
        const { secret } = await service.issueChallenge(setPassword)
        advance(AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS - 1)
        expect(await rejection(consume('x'.repeat(32), setPassword))).toBe('secret')
        advance(1)
        expect(await rejection(consume(secret, setPassword))).toBe('expired')
    })

    it('invalidates the earlier challenge when a replacement is issued', async () => {
        const { service, consume, store } = fixture()
        const first = await service.issueChallenge(setPassword)
        const second = await service.issueChallenge(setPassword)
        expect(store.size).toBe(1)
        expect(await rejection(consume(first.secret, setPassword))).toBe('secret')
        await expect(consume(second.secret, setPassword)).resolves.toBeUndefined()
    })

    it('keeps challenges of different purposes and Accounts apart', async () => {
        const { service, consume } = fixture()
        const reset = await service.issueChallenge(setPassword)
        const verify = await service.issueChallenge(verification)
        const other = await service.issueChallenge({
            ...setPassword,
            userId: 'account-b',
            email: 'b@example.test'
        })
        expect(await rejection(consume(reset.secret, verification))).toBe('secret')
        expect(await rejection(consume(verify.secret, setPassword))).toBe('secret')
        expect(await rejection(consume(other.secret, setPassword))).toBe('secret')
        await expect(consume(reset.secret, setPassword)).resolves.toBeUndefined()
        await expect(consume(verify.secret, verification)).resolves.toBeUndefined()
        await expect(
            consume(other.secret, { ...setPassword, userId: 'account-b', email: 'b@example.test' })
        ).resolves.toBeUndefined()
    })

    it('rejects a challenge presented for another address or another operation', async () => {
        const { service, consume } = fixture()
        const reset = await service.issueChallenge(setPassword)
        expect(
            await rejection(consume(reset.secret, { ...setPassword, email: 'moved@example.test' }))
        ).toBe('binding')
        const change = await service.issueChallenge(emailChange)
        expect(
            await rejection(
                consume(change.secret, {
                    ...emailChange,
                    operation: { email: 'else@example.test', password: false }
                })
            )
        ).toBe('binding')
        expect(
            await rejection(
                consume(change.secret, {
                    ...emailChange,
                    operation: { email: 'next@example.test', password: true }
                })
            )
        ).toBe('binding')
        await expect(consume(change.secret, emailChange)).resolves.toBeUndefined()
    })

    it('checks the stored token type and claim even when the secret matches', async () => {
        const { service, store, consume } = fixture()
        const { secret } = await service.issueChallenge(setPassword)
        const token = await store.find(`${TokenType.PasswordReset}:account-a`)
        assertExists(token)
        await store.replace({ ...token, type: TokenType.SSEAuthorization })
        expect(await rejection(consume(secret, setPassword))).toBe('binding')
        await store.replace({ ...token, data: { ...token.data, email: 'changed@example.test' } })
        expect(await rejection(consume(secret, setPassword))).toBe('binding')
        await store.replace({ ...token, data: { userId: setPassword.userId } })
        expect(await rejection(consume(secret, setPassword))).toBe('binding')
        await store.replace(token)
        await expect(consume(secret, setPassword)).resolves.toBeUndefined()
    })

    it('surfaces a storage failure instead of treating it as consumed', async () => {
        const failing: TokenStore = {
            create: async (token) => token,
            replace: async () => {},
            find: async () => {
                throw new Error('synthetic storage failure')
            },
            delete: async () => {}
        }
        const service = new TokenService(failing)
        await expect(
            service.consumeChallenge('secret', setPassword)(transaction, {
                addKeys: async () => {}
            })
        ).rejects.toThrow('synthetic storage failure')
    })
})

describe('existing invitation and realtime tokens', () => {
    it.each([TokenType.GameInvitation, TokenType.SSEAuthorization] as const)(
        'keeps random IDs, lookup and explicit invalidation for %s',
        async (type) => {
            const { service, store } = fixture()
            const data = { userId: 'account-a', gameId: 'game-a' }
            const token = await service.createToken({ type, data })
            expect(token).toMatch(/^[2-9A-HJ-NP-Za-km-z]{16}$/)
            await expect(service.getData({ token, expectedType: type })).resolves.toEqual(data)
            await expect(service.getData({ token, expectedType: type })).resolves.toEqual(data)
            await service.issueChallenge(setPassword)
            await service.issueChallenge(setPassword)
            expect(store.size).toBe(2)
            await expect(service.getData({ token, expectedType: type })).resolves.toEqual(data)
            await service.invalidateToken(token)
            await expect(service.getData({ token, expectedType: type })).resolves.toBeUndefined()
        }
    )

    it('keeps expiry and wrong-type refusal on ordinary lookups', async () => {
        const { service, advance } = fixture()
        const token = await service.createToken({
            type: TokenType.SSEAuthorization,
            data: { userId: 'account-a' },
            expiresInSeconds: 60
        })
        await expect(
            service.getData({ token, expectedType: TokenType.GameInvitation })
        ).resolves.toBeUndefined()
        advance(61)
        await expect(
            service.getData({ token, expectedType: TokenType.SSEAuthorization })
        ).resolves.toBeUndefined()
    })
})

describe('Set Password challenge presentation', () => {
    it('round-trips the Account and secret through one opaque value', () => {
        const presented = formatSetPasswordChallenge({
            userId: 'V1StGXR8_Z5jdHi6B-myT',
            secret: 'abc'
        })
        expect(parseSetPasswordChallenge(presented)).toEqual({
            userId: 'V1StGXR8_Z5jdHi6B-myT',
            secret: 'abc'
        })
    })

    it('rejects a legacy token or a value without both parts', () => {
        expect(parseSetPasswordChallenge('Lk3mNp')).toBeUndefined()
        expect(parseSetPasswordChallenge('.secret')).toBeUndefined()
        expect(parseSetPasswordChallenge('account.')).toBeUndefined()
        expect(parseSetPasswordChallenge('')).toBeUndefined()
    })
})
