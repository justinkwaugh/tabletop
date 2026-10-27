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

        it('finds several users in one call, in request order, with missing users undefined', async () => {
            const username = `batched-${userId.slice(-8)}`
            await users.createUser({
                id: userId,
                status: UserStatus.Active,
                username,
                roles: [Role.User],
                externalIds: []
            })
            try {
                const missing = `${userId}-missing`
                const first = await users.findByIds([missing, userId])
                expect(first.map((user) => user?.username)).toEqual([undefined, username])
                const cached = await users.findByIds([userId, missing])
                expect(cached.map((user) => user?.username)).toEqual([username, undefined])
                const repeated = await users.findByIds([userId, missing, userId])
                expect(repeated.map((user) => user?.username)).toEqual([
                    username,
                    undefined,
                    username
                ])
            } finally {
                await db.doc(`userUsernames/${username}`).delete()
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

        it('stamps activatedAt the first time the account becomes active', async () => {
            const username = `activated-${userId.slice(-8)}`
            const email = `${userId}@example.com`
            const changedEmail = `${userId}-changed@example.com`
            await users.createUser({
                id: userId,
                status: UserStatus.Incomplete,
                username,
                email,
                emailVerified: false,
                roles: [Role.User],
                externalIds: []
            })
            try {
                const [activated] = await users.updateUser({
                    userId,
                    fields: { emailVerified: true }
                })
                expect(activated.status).toBe(UserStatus.Active)
                expect(activated.activatedAt).toBeInstanceOf(Date)
                const activatedAt = activated.activatedAt

                const [changed] = await users.updateUser({
                    userId,
                    fields: { email: changedEmail }
                })
                expect(changed.status).toBe(UserStatus.Incomplete)
                const [reactivated] = await users.updateUser({
                    userId,
                    fields: { emailVerified: true }
                })
                expect(reactivated.status).toBe(UserStatus.Active)
                expect(reactivated.activatedAt).toEqual(activatedAt)
                expect((await users.findById(userId))?.activatedAt).toEqual(activatedAt)
            } finally {
                await db.doc(`userUsernames/${username}`).delete()
                await db.doc(`userEmails/${email}`).delete()
                await db.doc(`userEmails/${changedEmail}`).delete()
            }
        })

        it('stamps an account active before activatedAt existed with its creation time', async () => {
            const username = `legacy-${userId.slice(-8)}`
            const email = `${userId}@example.com`
            const changedEmail = `${userId}-changed@example.com`
            const created = await users.createUser({
                id: userId,
                status: UserStatus.Active,
                username,
                email,
                emailVerified: true,
                roles: [Role.User],
                externalIds: []
            })
            expect(created.activatedAt).toBeUndefined()
            try {
                const [changed] = await users.updateUser({
                    userId,
                    fields: { email: changedEmail }
                })
                expect(changed.status).toBe(UserStatus.Incomplete)
                expect(changed.activatedAt).toEqual(created.createdAt)
                const [reactivated] = await users.updateUser({
                    userId,
                    fields: { emailVerified: true }
                })
                expect(reactivated.activatedAt).toEqual(created.createdAt)
                expect((await users.findById(userId))?.activatedAt).toEqual(created.createdAt)
            } finally {
                await db.doc(`userUsernames/${username}`).delete()
                await db.doc(`userEmails/${email}`).delete()
                await db.doc(`userEmails/${changedEmail}`).delete()
            }
        })
    }
)
