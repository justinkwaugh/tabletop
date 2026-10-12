import type { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { cacheFixture } from '../../../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../gameStore.js'

export interface EmulatorStore {
    readonly db: Firestore
    readonly client: RedisClientType
    readonly live: ReturnType<typeof cacheFixture>
    readonly store: FirestoreGameStore
    close(gameId: string, cacheKeyPattern: string): Promise<void>
}

export async function openEmulatorStore(db: Firestore): Promise<EmulatorStore> {
    const client: RedisClientType = createClient({
        socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
    })
    await client.connect()
    const live = cacheFixture(client)
    const store = new FirestoreGameStore(live.cache, db)
    return {
        db,
        client,
        live,
        store,
        async close(gameId, cacheKeyPattern) {
            try {
                await db.recursiveDelete(db.doc(`games/${gameId}`))
                for await (const keys of client.scanIterator({
                    MATCH: cacheKeyPattern,
                    COUNT: 100
                })) {
                    if (keys.length) await client.del(keys)
                }
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        }
    }
}
