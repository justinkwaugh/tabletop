import { createClient, type RedisClientType } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreSessionStore } from './sessionStore.js'
import type { AuthenticatedSession } from '../../sessions/authenticatedSession.js'

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
        let sequence = 0

        beforeAll(async () => {
            await client.connect()
        })
        afterAll(async () => {
            cache.destroy()
            for await (const keys of client.scanIterator({
                MATCH: `session-${run}-*`,
                COUNT: 100
            })) {
                if (keys.length) await client.del(keys)
            }
            client.destroy()
            await firestore.terminate()
        })

        function newSession(userId: string): AuthenticatedSession {
            const createdAt = new Date('2026-10-27T12:00:00.000Z')
            return {
                id: `${run}-${sequence++}`,
                userId,
                createdAt,
                authenticatedAt: createdAt,
                expiresAt: new Date('2026-11-26T12:00:00.000Z')
            }
        }

        async function cachedAfterFill(id: string) {
            const key = `session-${id}`
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

        it('refuses to create the same session id twice', async () => {
            const session = newSession(`${run}-twice`)
            await store.create(session)
            await expect(store.create(session)).rejects.toThrow()
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

        it('treats an invalid id as an unknown session', async () => {
            await expect(store.find('../escape')).resolves.toBeUndefined()
        })
    }
)
