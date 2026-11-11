import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { cacheFixture, cacheTestClient } from '../../cache/tests/cacheFixture.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'
import { FirestoreUserStore } from './userStore.js'
import { AlreadyExistsError } from '../stores/errors.js'

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
                ageConfirmedAt: new Date(),
                roles: [Role.User],
                externalIds: []
            }
        }

        async function createAccount(status: UserStatus, fields: Partial<User> = {}) {
            const account = newAccount(status)
            return store.createUser({ ...account, username: `Person${account.id}`, ...fields })
        }

        async function createUnconfirmedAccount(status: UserStatus, fields: Partial<User> = {}) {
            const account = newAccount(status)
            delete account.ageConfirmedAt
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

        it('ends every session in the commit that makes an Account Inactive', async () => {
            const account = await createAccount(UserStatus.Active)
            const [banned, updatedFields] = await store.updateUser({
                userId: account.id,
                fields: { status: UserStatus.Inactive }
            })
            expect(banned.status).toBe(UserStatus.Inactive)
            expect(banned.sessionGeneration).toBe(1)
            expect(updatedFields).toContain('status')
            expect(await storedStatus(account.id)).toBe(UserStatus.Inactive)
        })

        it('restores a complete Account to Active, and an unfinished one to Incomplete', async () => {
            const complete = await createAccount(UserStatus.Active)
            await store.updateUser({ userId: complete.id, fields: { status: UserStatus.Inactive } })
            const [restored] = await store.updateUser({
                userId: complete.id,
                fields: { status: UserStatus.Incomplete }
            })
            expect(restored.status).toBe(UserStatus.Active)
            expect(restored.sessionGeneration).toBe(1)
            expect(await storedStatus(complete.id)).toBe(UserStatus.Active)

            const unfinished = await createAccount(UserStatus.Incomplete, { emailVerified: false })
            await store.updateUser({
                userId: unfinished.id,
                fields: { status: UserStatus.Inactive }
            })
            const [stillUnfinished] = await store.updateUser({
                userId: unfinished.id,
                fields: { status: UserStatus.Incomplete }
            })
            expect(stillUnfinished.status).toBe(UserStatus.Incomplete)
        })

        it('lists only Active usernames, while every username stays reserved', async () => {
            const active = await createAccount(UserStatus.Active)
            const banned = await createAccount(UserStatus.Active)
            await store.updateUser({ userId: banned.id, fields: { status: UserStatus.Inactive } })

            const listed = await store.findActiveUsernames()
            expect(listed).toContain(active.username?.toLowerCase())
            expect(listed).not.toContain(banned.username?.toLowerCase())

            await expect(
                store.createUser({
                    ...newAccount(UserStatus.Incomplete),
                    username: banned.username
                })
            ).rejects.toThrow(AlreadyExistsError)
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

        describe('Age Confirmation', () => {
            const BEFORE_INTRODUCTION = new Date('2026-11-01T00:00:00Z')
            const AFTER_INTRODUCTION = new Date('2026-12-01T00:00:00Z')

            function setClock(now: Date) {
                vi.useFakeTimers({ toFake: ['Date'] })
                vi.setSystemTime(now)
            }

            afterEach(() => {
                vi.useRealTimers()
            })

            it('keeps a new password Account Incomplete until it confirms its age', async () => {
                setClock(AFTER_INTRODUCTION)
                const account = await createUnconfirmedAccount(UserStatus.Incomplete, {
                    emailVerified: false
                })
                const [verified] = await store.updateUser({
                    userId: account.id,
                    fields: { emailVerified: true }
                })
                expect(verified.status).toBe(UserStatus.Incomplete)

                const [confirmed, updatedFields] = await store.updateUser({
                    userId: account.id,
                    fields: {},
                    confirmAge: true
                })
                expect(confirmed.status).toBe(UserStatus.Active)
                expect(updatedFields).toEqual(expect.arrayContaining(['ageConfirmedAt', 'status']))
                const stored = await firestore.collection('users').doc(account.id).get()
                expect(stored.get('ageConfirmedAt').toDate()).toEqual(AFTER_INTRODUCTION)
            })

            it('keeps a new provider Account Incomplete after it chooses a username', async () => {
                setClock(AFTER_INTRODUCTION)
                const account = newAccount(UserStatus.Incomplete)
                delete account.ageConfirmedAt
                await store.createUser(account)
                const [named] = await store.updateUser({
                    userId: account.id,
                    fields: { username: `Provider${account.id}` }
                })
                expect(named.status).toBe(UserStatus.Incomplete)
            })

            it('records the confirmation when an Account is created with it', async () => {
                setClock(AFTER_INTRODUCTION)
                const account = newAccount(UserStatus.Incomplete)
                delete account.ageConfirmedAt
                const created = await store.createUser(account, undefined, { confirmAge: true })
                expect(created.ageConfirmedAt).toEqual(AFTER_INTRODUCTION)
            })

            it('keeps the first confirmation time', async () => {
                const account = await createAccount(UserStatus.Active)
                const [updated, updatedFields] = await store.updateUser({
                    userId: account.id,
                    fields: {},
                    confirmAge: true
                })
                expect(updated.ageConfirmedAt).toEqual(account.ageConfirmedAt)
                expect(updatedFields).toEqual([])
            })

            it('does not ask Accounts created before Age Confirmation was introduced', async () => {
                setClock(BEFORE_INTRODUCTION)
                const unfinished = await createUnconfirmedAccount(UserStatus.Incomplete, {
                    emailVerified: false
                })
                setClock(AFTER_INTRODUCTION)
                const [verified] = await store.updateUser({
                    userId: unfinished.id,
                    fields: { emailVerified: true }
                })
                expect(verified.status).toBe(UserStatus.Active)
            })

            it('does not ask Accounts activated before it was introduced, even after a ban', async () => {
                setClock(AFTER_INTRODUCTION)
                const legacy = await createUnconfirmedAccount(UserStatus.Active)
                const [updated] = await store.updateUser({
                    userId: legacy.id,
                    fields: { timeZone: 'Europe/London' }
                })
                expect(updated.status).toBe(UserStatus.Active)

                await store.updateUser({
                    userId: legacy.id,
                    fields: { status: UserStatus.Inactive }
                })
                const [restored] = await store.updateUser({
                    userId: legacy.id,
                    fields: { status: UserStatus.Incomplete }
                })
                expect(restored.status).toBe(UserStatus.Active)
            })
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
