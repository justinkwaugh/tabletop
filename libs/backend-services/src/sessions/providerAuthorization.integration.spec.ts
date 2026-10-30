import { createClient, type RedisClientType } from 'redis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ExternalAuthService, Role, UserStatus, type User } from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { FirestoreSessionStore } from '../persistence/firestore/sessionStore.js'
import { UnknownStorageError } from '../persistence/stores/errors.js'
import {
    InvalidOAuthStateError,
    OAUTH_STATE_LIFETIME_SECONDS,
    type ProviderAuthorizationRequest
} from '../oauth/providerAuthorization.js'
import { SESSION_LIFETIME_SECONDS, SessionNotLiveError, SessionService } from './sessionService.js'

const link: ProviderAuthorizationRequest = {
    provider: ExternalAuthService.Discord,
    purpose: 'link',
    redirectUri: 'https://site.test/oauth/discord/link'
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Provider Authorization Attempts on Authenticated Sessions in Firestore and Redis',
    { timeout: 20_000 },
    () => {
        const run = `provider-authorization-${Date.now()}`
        const firestore = isolatedFirestore()
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const store = new FirestoreSessionStore(cache, firestore)
        let now = new Date()
        const sessions = new SessionService(store, { now: () => now })
        let sequence = 0

        beforeAll(async () => {
            await client.connect()
        })
        afterAll(async () => {
            cache.destroy()
            for await (const keys of client.scanIterator({ MATCH: `*${run}-*`, COUNT: 100 })) {
                if (keys.length) await client.del(keys)
            }
            client.destroy()
            await firestore.terminate()
        })

        function account(): User {
            return {
                id: `${run}-${sequence++}`,
                status: UserStatus.Active,
                roles: [Role.User],
                externalIds: []
            }
        }

        async function cachedSession(id: string) {
            for (let attempt = 0; attempt < 40; attempt++) {
                const { cached } = await cache.cacheGet(`session-${id}`)
                if (cached) return true
                await new Promise((resolve) => setTimeout(resolve, 50))
            }
            return false
        }

        async function storedAttempt(id: string) {
            const snapshot = await firestore.collection('sessions').doc(id).get()
            return snapshot.exists ? (snapshot.get('providerAuthorization') ?? null) : undefined
        }

        it('keeps the attempt on the session record and loads records that never had one', async () => {
            const session = await sessions.establish(account())
            await expect(store.find(session.id)).resolves.toEqual(session)
            expect(await cachedSession(session.id)).toBe(true)
            const attempt = await sessions.beginProviderAuthorization(session, link)
            expect(attempt.state).toMatch(/^[0-9A-Za-z]{32}$/)
            expect(attempt.expiresAt).toEqual(
                new Date(now.getTime() + OAUTH_STATE_LIFETIME_SECONDS * 1000)
            )
            await expect(store.find(session.id)).resolves.toEqual({
                ...session,
                providerAuthorization: attempt
            })
            const restarted = new FirestoreSessionStore(cache, firestore)
            await expect(restarted.find(session.id)).resolves.toEqual({
                ...session,
                providerAuthorization: attempt
            })
        })

        it('hands concurrent callbacks with the same state to exactly one of them', async () => {
            const session = await sessions.establish(account())
            const { state } = await sessions.beginProviderAuthorization(session, link)
            await store.find(session.id)
            expect(await cachedSession(session.id)).toBe(true)
            const outcomes = await Promise.allSettled(
                Array.from({ length: 6 }, () =>
                    sessions.completeProviderAuthorization(session, state, link)
                )
            )
            expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
            for (const outcome of outcomes) {
                if (outcome.status === 'rejected') {
                    expect(outcome.reason).toBeInstanceOf(InvalidOAuthStateError)
                }
            }
            expect(await storedAttempt(session.id)).toBeNull()
            const cachedAfter = await store.find(session.id)
            expect(cachedAfter).toEqual(session)
            await expect(
                sessions.completeProviderAuthorization(session, state, link)
            ).rejects.toBeInstanceOf(InvalidOAuthStateError)
        })

        it('reads the attempt from the record, not from a stale request snapshot', async () => {
            const session = await sessions.establish(account())
            const { state } = await sessions.beginProviderAuthorization(session, link)
            const snapshot = await store.find(session.id)
            await sessions.completeProviderAuthorization(session, state, link)
            expect(snapshot?.providerAuthorization?.state).toBe(state)
            await expect(
                sessions.completeProviderAuthorization(snapshot ?? session, state, link)
            ).rejects.toBeInstanceOf(InvalidOAuthStateError)
        })

        it('lets a newer attempt replace an older one that can no longer clear it', async () => {
            const session = await sessions.establish(account())
            const older = await sessions.beginProviderAuthorization(session, link)
            const newer = await sessions.beginProviderAuthorization(session, link)
            await expect(
                sessions.completeProviderAuthorization(session, older.state, link)
            ).rejects.toBeInstanceOf(InvalidOAuthStateError)
            await expect(
                sessions.completeProviderAuthorization(session, newer.state, {
                    ...link,
                    purpose: 'login'
                })
            ).rejects.toBeInstanceOf(InvalidOAuthStateError)
            expect(await storedAttempt(session.id)).toEqual(
                expect.objectContaining({ state: newer.state })
            )
            await expect(
                sessions.completeProviderAuthorization(session, newer.state, link)
            ).resolves.toBeUndefined()
        })

        it('fails closed when the store cannot complete the transaction', async () => {
            const session = await sessions.establish(account())
            const { state } = await sessions.beginProviderAuthorization(session, link)
            const failure = vi
                .spyOn(firestore, 'runTransaction')
                .mockRejectedValueOnce(new Error('synthetic Firestore outage'))
            await expect(
                sessions.completeProviderAuthorization(session, state, link)
            ).rejects.toBeInstanceOf(UnknownStorageError)
            failure.mockRestore()
            expect(await storedAttempt(session.id)).toEqual(expect.objectContaining({ state }))
        })

        it('never recreates a revoked session or revives an expired one', async () => {
            const revoked = await sessions.establish(account())
            const { state } = await sessions.beginProviderAuthorization(revoked, link)
            await store.find(revoked.id)
            await sessions.revoke(revoked.id)
            await expect(
                sessions.completeProviderAuthorization(revoked, state, link)
            ).rejects.toBeInstanceOf(SessionNotLiveError)
            await expect(sessions.beginProviderAuthorization(revoked, link)).rejects.toBeInstanceOf(
                SessionNotLiveError
            )
            expect(await storedAttempt(revoked.id)).toBeUndefined()
            await expect(store.find(revoked.id)).resolves.toBeUndefined()

            const started = now
            const expired = await sessions.establish(account())
            const pending = await sessions.beginProviderAuthorization(expired, link)
            now = new Date(started.getTime() + SESSION_LIFETIME_SECONDS * 1000)
            try {
                await expect(
                    sessions.completeProviderAuthorization(expired, pending.state, link)
                ).rejects.toBeInstanceOf(SessionNotLiveError)
                await expect(
                    sessions.beginProviderAuthorization(expired, link)
                ).rejects.toBeInstanceOf(SessionNotLiveError)
            } finally {
                now = started
            }
            const stored = await new FirestoreSessionStore(cache, firestore).find(expired.id)
            expect(stored).toEqual({ ...expired, providerAuthorization: pending })
        })
    }
)
