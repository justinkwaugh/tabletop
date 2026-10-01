import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { Role, UserStatus } from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { FirestoreUserStore } from './userStore.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'FirestoreUserStore.updateUser',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let users: FirestoreUserStore
        let userId: string

        beforeEach(async () => {
            userId = `user-store-test-${randomUUID()}`
            db = new Firestore({ projectId: 'demo-tabletop' })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            users = new FirestoreUserStore(live.cache, db)
        })

        afterEach(async () => {
            try {
                await db.doc(`users/${userId}`).delete()
                for await (const keys of client.scanIterator({
                    MATCH: `*${userId}*`,
                    COUNT: 100
                })) {
                    if (keys.length) await client.del(keys)
                }
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        it('persists and returns updated roles', async () => {
            await users.createUser({
                id: userId,
                status: UserStatus.Incomplete,
                roles: [Role.User],
                externalIds: []
            })

            const [updated, updatedFields] = await users.updateUser({
                userId,
                fields: { roles: [Role.User, Role.BetaTester] }
            })

            expect(updated.roles).toEqual([Role.User, Role.BetaTester])
            expect(updatedFields).toContain('roles')
            expect((await users.findById(userId))?.roles).toEqual([Role.User, Role.BetaTester])
        })

        it('does not report roles as updated when they are unchanged', async () => {
            await users.createUser({
                id: userId,
                status: UserStatus.Incomplete,
                roles: [Role.User, Role.Admin],
                externalIds: []
            })

            const [, updatedFields] = await users.updateUser({
                userId,
                fields: { roles: [Role.User, Role.Admin] }
            })

            expect(updatedFields).not.toContain('roles')
        })
    }
)
