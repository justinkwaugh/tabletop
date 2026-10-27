import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Role, sessionGenerationOf, UserStatus, type User } from '@tabletop/common'
import { AccountStatusTransitionError } from '../stores/errors.js'
import { cacheFixture, cacheTestClient } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreUserStore } from './userStore.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'User Account status in the Firestore user store',
    { timeout: 15_000 },
    () => {
        const run = `status-${Date.now()}`
        const firestore = isolatedFirestore()
        const client = cacheTestClient()
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

        async function storedRecord(id: string) {
            const stored = (await firestore.collection('users').doc(id).get()).data()
            expect(stored).toBeDefined()
            return stored ?? {}
        }

        async function warmCache(id: string) {
            await store.findById(id)
            await vi.waitFor(async () => expect(await client.get(`user-${id}`)).toMatch(/^V:/))
        }

        async function expectNoCachedCopy(id: string) {
            expect(await client.get(`user-${id}`)).not.toMatch(/^V:/)
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

        it('deactivates an Active or Incomplete Account, advancing the Session Generation in the same write', async () => {
            for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
                const account = await createAccount(status)
                await warmCache(account.id)

                const updated = await store.transitionAccountStatus(account.id, 'deactivate')

                expect(updated.status).toBe(UserStatus.Inactive)
                expect(sessionGenerationOf(updated)).toBe(sessionGenerationOf(account) + 1)
                const stored = await storedRecord(account.id)
                expect(stored.status).toBe(UserStatus.Inactive)
                expect(stored.sessionGeneration).toBe(sessionGenerationOf(account) + 1)
                await expectNoCachedCopy(account.id)
                expect((await store.findById(account.id))?.status).toBe(UserStatus.Inactive)
            }
        })

        it('leaves an Inactive Account as it is when deactivated again', async () => {
            const account = await createAccount(UserStatus.Active)
            const deactivated = await store.transitionAccountStatus(account.id, 'deactivate')

            const again = await store.transitionAccountStatus(account.id, 'deactivate')

            expect(again.status).toBe(UserStatus.Inactive)
            expect(sessionGenerationOf(again)).toBe(sessionGenerationOf(deactivated))
            expect(again.updatedAt).toEqual(deactivated.updatedAt)
        })

        it('reactivates to Active when Account Completion is satisfied, keeping earlier sessions behind', async () => {
            const account = await createAccount(UserStatus.Active)
            const deactivated = await store.transitionAccountStatus(account.id, 'deactivate')
            await warmCache(account.id)

            const reactivated = await store.transitionAccountStatus(account.id, 'reactivate')

            expect(reactivated.status).toBe(UserStatus.Active)
            expect(sessionGenerationOf(reactivated)).toBe(sessionGenerationOf(deactivated))
            expect(reactivated.activatedAt).toBeInstanceOf(Date)
            expect(await storedStatus(account.id)).toBe(UserStatus.Active)
            await expectNoCachedCopy(account.id)
        })

        it('reactivates a nameless Account to Incomplete', async () => {
            const account = await store.createUser(newAccount(UserStatus.Inactive))

            const reactivated = await store.transitionAccountStatus(account.id, 'reactivate')

            expect(reactivated.status).toBe(UserStatus.Incomplete)
            expect(await storedStatus(account.id)).toBe(UserStatus.Incomplete)
        })

        it('refuses every transition of a Deleted Account', async () => {
            const account = await createAccount(UserStatus.Deleted)
            for (const transition of ['deactivate', 'reactivate'] as const) {
                await expect(
                    store.transitionAccountStatus(account.id, transition)
                ).rejects.toBeInstanceOf(AccountStatusTransitionError)
            }
            const stored = await storedRecord(account.id)
            expect(stored.status).toBe(UserStatus.Deleted)
            expect(stored.sessionGeneration).toBeUndefined()
        })

        it('leaves status and Session Generation unchanged when the transaction fails', async () => {
            const account = await createAccount(UserStatus.Active)
            await warmCache(account.id)

            await expect(
                store.transitionAccountStatus(account.id, 'deactivate', {
                    participant: async () => {
                        throw new Error('synthetic transaction failure')
                    }
                })
            ).rejects.toThrow()

            const stored = await storedRecord(account.id)
            expect(stored.status).toBe(UserStatus.Active)
            expect(stored.sessionGeneration).toBeUndefined()
            expect((await store.findById(account.id))?.status).toBe(UserStatus.Active)
        })
    }
)
