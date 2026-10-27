import type { Transaction } from '@google-cloud/firestore'
import { describe, expect, it } from 'vitest'
import { AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS } from '@tabletop/common'
import { MemoryAuthenticationChallengeStore } from '../persistence/memory/authenticationChallengeStore.js'
import type { AuthenticationChallengeStore } from '../persistence/stores/authenticationChallengeStore.js'
import {
    type AuthenticationChallengeClaim,
    authenticationChallengeKey,
    formatSetPasswordChallenge,
    InvalidChallengeError,
    parseSetPasswordChallenge
} from './authenticationChallenge.js'
import { AuthenticationChallengeService } from './authenticationChallengeService.js'

const transaction: Transaction = Object.create(null)

const setPassword: AuthenticationChallengeClaim = {
    purpose: 'set-password',
    userId: 'account-a',
    email: 'a@example.test'
}
const verification: AuthenticationChallengeClaim = {
    purpose: 'email-verification',
    userId: 'account-a',
    email: 'a@example.test'
}
const emailChange: AuthenticationChallengeClaim = {
    purpose: 'sensitive-change',
    userId: 'account-a',
    email: 'a@example.test',
    operation: { email: 'next@example.test', password: false }
}

function fixture(start = new Date('2026-10-27T12:00:00.000Z')) {
    let now = start
    const store = new MemoryAuthenticationChallengeStore()
    const service = new AuthenticationChallengeService(store, { now: () => now })
    const consume = (secret: string, expected: AuthenticationChallengeClaim) =>
        service.consumption(secret, expected)(transaction, { addKeys: async () => {} })
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
        const { secret, expiresAt } = await service.issue(setPassword)
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
        const { secret } = await service.issue(verification)
        expect(secret).toMatch(/^[2-9A-HJ-NP-Za-km-z]{6}$/)
        const stored = store.stored(authenticationChallengeKey(verification))
        expect(stored).toBeDefined()
        expect(JSON.stringify(stored)).not.toContain(secret)
        expect(stored?.secretHash).not.toBe(secret)
    })

    it('rejects a wrong secret without consuming the challenge', async () => {
        const { service, consume } = fixture()
        const { secret } = await service.issue(verification)
        expect(await rejection(consume('wrong1', verification))).toBe('secret')
        await expect(consume(secret, verification)).resolves.toBeUndefined()
    })

    it('rejects an expired challenge', async () => {
        const { service, consume, advance } = fixture()
        const { secret } = await service.issue(setPassword)
        advance(AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS - 1)
        expect(await rejection(consume('x'.repeat(32), setPassword))).toBe('secret')
        advance(1)
        expect(await rejection(consume(secret, setPassword))).toBe('expired')
    })

    it('invalidates the earlier challenge when a replacement is issued', async () => {
        const { service, consume, store } = fixture()
        const first = await service.issue(setPassword)
        const second = await service.issue(setPassword)
        expect(store.size).toBe(1)
        expect(await rejection(consume(first.secret, setPassword))).toBe('secret')
        await expect(consume(second.secret, setPassword)).resolves.toBeUndefined()
    })

    it('keeps challenges of different purposes and Accounts apart', async () => {
        const { service, consume } = fixture()
        const reset = await service.issue(setPassword)
        const verify = await service.issue(verification)
        const other = await service.issue({
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
        const reset = await service.issue(setPassword)
        expect(
            await rejection(consume(reset.secret, { ...setPassword, email: 'moved@example.test' }))
        ).toBe('binding')
        const change = await service.issue(emailChange)
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

    it('surfaces a storage failure instead of treating it as consumed', async () => {
        const failing: AuthenticationChallengeStore = {
            replace: async () => {},
            find: async () => {
                throw new Error('synthetic storage failure')
            },
            delete: () => {}
        }
        const service = new AuthenticationChallengeService(failing)
        await expect(
            service.consumption('secret', setPassword)(transaction, { addKeys: async () => {} })
        ).rejects.toThrow('synthetic storage failure')
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
