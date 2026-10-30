import { createClient, type RedisClientType } from 'redis'
import { inspect } from 'node:util'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ExternalAuthService } from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreSessionStore, sessionCacheKey } from './sessionStore.js'
import type { AuthenticatedSession } from '../../sessions/authenticatedSession.js'
import { secretReference } from '../../security/secretReference.js'
import { errorText } from './tests/errorText.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Authenticated Sessions in the Firestore session store',
    { timeout: 15_000 },
    () => {
        const run = `session-${Date.now()}`
        const firestore = isolatedFirestore()
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const store = new FirestoreSessionStore(cache, firestore)
        const cacheKeys: string[] = []
        let sequence = 0

        beforeAll(async () => {
            await client.connect()
        })
        afterEach(() => {
            vi.restoreAllMocks()
        })
        afterAll(async () => {
            cache.destroy()
            if (cacheKeys.length) await client.del(cacheKeys)
            client.destroy()
            await firestore.terminate()
        })

        function newSession(userId: string): AuthenticatedSession {
            const createdAt = new Date('2026-10-27T12:00:00.000Z')
            const id = `${run}-${sequence++}`
            cacheKeys.push(sessionCacheKey(id))
            return {
                id,
                userId,
                generation: 0,
                createdAt,
                authenticatedAt: createdAt,
                expiresAt: new Date('2026-11-26T12:00:00.000Z')
            }
        }

        async function cachedAfterFill(id: string) {
            const key = sessionCacheKey(id)
            for (let attempt = 0; attempt < 40; attempt++) {
                if ((await cache.cacheGet(key)).cached) return true
                await new Promise((resolve) => setTimeout(resolve, 50))
            }
            return false
        }

        async function storedIds(userId: string) {
            const snapshot = await firestore
                .collection('sessions')
                .where('userId', '==', userId)
                .get()
            return snapshot.docs.map((doc) => doc.id).sort()
        }

        it('stores and reads a session with its dates, from Firestore and from the cache', async () => {
            const session = newSession(`${run}-reader`)
            await store.create(session)
            await expect(store.find(session.id)).resolves.toEqual(session)
            expect(await cachedAfterFill(session.id)).toBe(true)
            await firestore.collection('sessions').doc(session.id).delete()
            await expect(store.find(session.id)).resolves.toEqual(session)
        })

        it('refuses to create the same session id twice and reports it only by reference', async () => {
            const session = newSession(`${run}-twice`)
            await store.create(session)
            const failure = await store.create(session).catch((error: unknown) => error)
            expect(failure).toBeInstanceOf(Error)
            if (!(failure instanceof Error)) throw new Error('unexpected')
            expect(failure.name).toBe('AlreadyExistsError')
            expect(errorText(failure)).toContain('ALREADY_EXISTS')
            expect(errorText(failure)).toContain(secretReference(session.id))
            expect(errorText(failure)).not.toContain(session.id)
        })

        it('keeps the cache identity every compatible revision derives', () => {
            const session = newSession(`${run}-identity`)
            expect(sessionCacheKey(session.id)).toBe(`session-${session.id}`)
        })

        it('keeps the Session ID out of cache diagnostics for a failed write and a malformed entry', async () => {
            const session = newSession(`${run}-diagnostics`)
            const reported: string[] = []
            const record = (...args: unknown[]) => {
                reported.push(inspect(args, { depth: 20 }))
            }
            vi.spyOn(console, 'log').mockImplementation(record)
            vi.spyOn(console, 'error').mockImplementation(record)

            await store.create(session)
            await expect(store.create(session)).rejects.toThrow()
            await client.set(sessionCacheKey(session.id), `V:{"id":"${session.id}"`)
            await expect(store.find(session.id)).resolves.toEqual(session)

            const text = reported.join('\n')
            expect(text).toContain('Cache write outcome is uncertain')
            expect(text).toContain("keyFamilies: [ 'session' ]")
            expect(text).toContain('unable to parse cache value')
            expect(text).toContain("name: 'SyntaxError'")
            expect(text).not.toContain(session.id)
        })

        it('does not resurrect a deleted session from the cache or after a restart', async () => {
            const session = newSession(`${run}-deleted`)
            await store.create(session)
            await expect(store.find(session.id)).resolves.toEqual(session)
            expect(await cachedAfterFill(session.id)).toBe(true)
            await store.delete(session.id)
            await expect(store.find(session.id)).resolves.toBeUndefined()
            const restarted = new FirestoreSessionStore(cache, firestore)
            await expect(restarted.find(session.id)).resolves.toBeUndefined()
        })

        it('deletes every session of one Account except the spared one', async () => {
            const userId = `${run}-all`
            const kept = newSession(userId)
            const other = newSession(userId)
            const someoneElse = newSession(`${run}-someone-else`)
            for (const session of [kept, other, someoneElse]) {
                await store.create(session)
                await store.find(session.id)
                expect(await cachedAfterFill(session.id)).toBe(true)
            }
            await store.deleteForUser(userId, { except: kept.id })
            expect(await storedIds(userId)).toEqual([kept.id])
            await expect(store.find(other.id)).resolves.toBeUndefined()
            await expect(store.find(kept.id)).resolves.toEqual(kept)
            await expect(store.find(someoneElse.id)).resolves.toEqual(someoneElse)
            await store.deleteForUser(userId)
            expect(await storedIds(userId)).toEqual([])
            await expect(store.find(kept.id)).resolves.toBeUndefined()
        })

        it('stores a session without Recent Authentication or an attempt and changes it later', async () => {
            const { authenticatedAt: _unproved, ...session } = newSession(`${run}-challenge`)
            await store.create(session)
            await expect(store.find(session.id)).resolves.toEqual(session)
            expect(await cachedAfterFill(session.id)).toBe(true)
            const changed = {
                ...session,
                authenticatedAt: new Date('2026-10-27T13:00:00.000Z'),
                providerAuthorization: {
                    provider: ExternalAuthService.Discord,
                    purpose: 'link' as const,
                    redirectUri: 'https://site.test/oauth/discord/link',
                    state: 'link.state',
                    expiresAt: new Date('2026-10-27T13:10:00.000Z')
                }
            }
            await expect(store.update(session.id, () => changed)).resolves.toEqual(changed)
            await expect(store.find(session.id)).resolves.toEqual(changed)
            const restarted = new FirestoreSessionStore(cache, firestore)
            await expect(restarted.find(session.id)).resolves.toEqual(changed)
            const { providerAuthorization: _cleared, ...cleared } = changed
            await expect(store.update(session.id, () => cleared)).resolves.toEqual(cleared)
            await expect(restarted.find(session.id)).resolves.toEqual(cleared)
        })

        it('stores, reads back and clears Admin Mode, through the cache and after a restart', async () => {
            const session = newSession(`${run}-admin-mode`)
            await store.create(session)
            await expect(store.find(session.id)).resolves.toEqual(session)
            expect(await cachedAfterFill(session.id)).toBe(true)
            const activated = {
                ...session,
                adminModeExpiresAt: new Date('2026-10-27T12:15:00.000Z')
            }
            await expect(store.update(session.id, () => activated)).resolves.toEqual(activated)
            await expect(store.find(session.id)).resolves.toEqual(activated)
            const restarted = new FirestoreSessionStore(cache, firestore)
            await expect(restarted.find(session.id)).resolves.toEqual(activated)
            await expect(
                store.update(session.id, ({ adminModeExpiresAt: _ended, ...live }) => live)
            ).resolves.toEqual(session)
            await expect(store.find(session.id)).resolves.toEqual(session)
            await expect(restarted.find(session.id)).resolves.toEqual(session)
            const stored = (await firestore.collection('sessions').doc(session.id).get()).data()
            expect(stored).not.toHaveProperty('adminModeExpiresAt')
        })

        it('does not change or recreate a session that no longer exists', async () => {
            const session = newSession(`${run}-gone`)
            await store.create(session)
            await store.delete(session.id)
            await expect(
                store.update(session.id, (stored) => ({
                    ...stored,
                    authenticatedAt: new Date('2026-10-27T13:00:00.000Z')
                }))
            ).resolves.toBeUndefined()
            await expect(store.find(session.id)).resolves.toBeUndefined()
            const snapshot = await firestore.collection('sessions').doc(session.id).get()
            expect(snapshot.exists).toBe(false)
        })

        it('writes nothing when the change refuses', async () => {
            const session = newSession(`${run}-refused`)
            await store.create(session)
            await expect(
                store.update(session.id, () => {
                    throw new Error('refused')
                })
            ).rejects.toThrow()
            const restarted = new FirestoreSessionStore(cache, firestore)
            await expect(restarted.find(session.id)).resolves.toEqual(session)
        })

        it('treats an invalid id as an unknown session', async () => {
            await expect(store.find('../escape')).resolves.toBeUndefined()
        })
    }
)
