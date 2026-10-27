import { createClient, type RedisClientType } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreUserStore } from './userStore.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'User Account status in the Firestore user store',
    { timeout: 15_000 },
    () => {
        const run = `status-${Date.now()}`
        const firestore = isolatedFirestore()
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const store = new FirestoreUserStore(cache, firestore)
        let sequence = 0

        beforeAll(async () => {
            await client.connect()
        })
        afterAll(async () => {
            cache.destroy()
            for await (const keys of client.scanIterator({ MATCH: `user-${run}-*`, COUNT: 100 })) {
                if (keys.length) await client.del(keys)
            }
            client.destroy()
            await firestore.terminate()
        })

        function newAccount(status: UserStatus): User {
            const index = sequence++
            return {
                id: `${run}-${index}`,
                status,
                email: `person-${run}-${index}@example.test`,
                emailVerified: true,
                roles: [Role.User],
                externalIds: []
            }
        }

        async function createAccount(status: UserStatus, fields: Partial<User> = {}) {
            const account = newAccount(status)
            return store.createUser({ ...account, username: `Person${account.id}`, ...fields })
        }

        async function storedStatus(id: string) {
            const snapshot = await firestore.collection('users').doc(id).get()
            return snapshot.get('status')
        }

        it('keeps an Inactive or Deleted Account unchanged through ordinary updates', async () => {
            for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
                const account = await createAccount(status)
                const updates: Partial<User>[] = [
                    {},
                    { username: account.username, email: account.email },
                    {
                        preferences: {
                            preventWebNotificationPrompt: true,
                            preferredColorsEnabled: false,
                            preferredColors: []
                        }
                    },
                    { timeZone: 'Europe/London' },
                    { emailVerified: true },
                    { roles: [Role.User, Role.BetaTester] }
                ]
                for (const fields of updates) {
                    const [updated, updatedFields] = await store.updateUser({
                        userId: account.id,
                        fields
                    })
                    expect(updated.status).toBe(status)
                    expect(updatedFields).not.toContain('status')
                }
                expect(await storedStatus(account.id)).toBe(status)
            }
        })

        it('promotes an Incomplete Account when its email becomes verified', async () => {
            const account = await createAccount(UserStatus.Incomplete, { emailVerified: false })
            const [updated, updatedFields] = await store.updateUser({
                userId: account.id,
                fields: { emailVerified: true }
            })
            expect(updated.status).toBe(UserStatus.Active)
            expect(updated.activatedAt).toBeInstanceOf(Date)
            expect(updatedFields).toEqual(
                expect.arrayContaining(['emailVerified', 'status', 'updatedAt'])
            )
            expect(await storedStatus(account.id)).toBe(UserStatus.Active)
        })

        it('leaves an Incomplete Account Incomplete until Account Completion is satisfied', async () => {
            const account = await store.createUser(newAccount(UserStatus.Incomplete))
            const [updated] = await store.updateUser({
                userId: account.id,
                fields: { timeZone: 'Europe/London' }
            })
            expect(updated.status).toBe(UserStatus.Incomplete)
            const [named] = await store.updateUser({
                userId: account.id,
                fields: { username: `Named${run}` }
            })
            expect(named.status).toBe(UserStatus.Active)
        })

        it('keeps an Active Account Active through an empty update', async () => {
            const account = await createAccount(UserStatus.Active)
            const [updated, updatedFields] = await store.updateUser({
                userId: account.id,
                fields: {}
            })
            expect(updated.status).toBe(UserStatus.Active)
            expect(updatedFields).toEqual([])
        })
    }
)
