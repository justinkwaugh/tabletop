import { TokenType } from '../tokens/dataToken.js'
import { createClient, type RedisClientType } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { FirestoreUserStore } from '../persistence/firestore/userStore.js'
import { FirestoreSessionStore } from '../persistence/firestore/sessionStore.js'
import type { TransactionParticipant } from '../persistence/stores/transaction.js'
import type { TaskService } from '../tasks/taskService.js'
import { TokenService } from '../tokens/tokenService.js'
import { FirestoreTokenStore } from '../persistence/firestore/tokenStore.js'
import { UserService } from '../users/userService.js'
import { SessionService } from './sessionService.js'

const ORIGINAL_PASSWORD = 'original-password-value'
const NEW_PASSWORD = 'replacement-password-value'

class UndeletableSessionStore extends FirestoreSessionStore {
    override async deleteForUser(): Promise<void> {
        throw new Error('synthetic revocation failure')
    }
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Password Credential changes and Authenticated Sessions in Firestore and Redis',
    { timeout: 20_000 },
    () => {
        const run = `credential-${Date.now()}`
        const firestore = isolatedFirestore()
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const userStore = new FirestoreUserStore(cache, firestore)
        const sessionStore = new UndeletableSessionStore(cache, firestore)
        const sessions = new SessionService(sessionStore)
        const tasks: TaskService = Object.create(null)
        tasks.sendAccountChangeNotificationEmail = async () => {}
        const challenges = new TokenService(new FirestoreTokenStore(firestore))
        const users = new UserService(userStore, challenges, tasks)
        const findAccount = (id: string) => users.getUser(id)
        const authorize = (sessionId: string) => sessions.authorize(sessionId, findAccount)
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

        async function createAccount() {
            const index = sequence++
            const username = `Person-${run}-${index}`
            const email = `person-${run}-${index}@example.test`
            const account: User = {
                id: `${run}-${index}`,
                status: UserStatus.Active,
                username,
                email,
                emailVerified: true,
                roles: [Role.User],
                externalIds: []
            }
            return { ...(await userStore.createUser(account, ORIGINAL_PASSWORD)), username, email }
        }

        function replacementIdentity(account: { id: string }) {
            return {
                username: `Renamed-${account.id}`,
                email: `renamed-${account.id}@example.test`
            }
        }

        async function uniquenessEntries(identity: { username: string; email: string }) {
            const [username, email] = await Promise.all([
                firestore.collection('userUsernames').doc(identity.username.toLowerCase()).get(),
                firestore.collection('userEmails').doc(identity.email).get()
            ])
            return { username: username.exists, email: email.exists }
        }

        async function holderOf(username: string, password: string): Promise<User> {
            const user = await userStore.findByUsernameAndPassword(username, password)
            if (!user) throw new Error(`${username} cannot sign in with that password`)
            return user
        }

        async function tryLogin(username: string, password: string) {
            const user = await userStore.findByUsernameAndPassword(username, password)
            return user ? sessions.establish(user, 'authentication-method') : undefined
        }

        async function login(username: string, password: string) {
            return sessions.establish(await holderOf(username, password), 'authentication-method')
        }

        async function setPassword(account: { id: string; email: string }, password: string) {
            const { secret } = await challenges.issueChallenge({
                type: TokenType.PasswordReset,
                userId: account.id,
                email: account.email
            })
            return users.setPassword({ userId: account.id, secret, password })
        }

        async function storedGeneration(id: string) {
            return (await firestore.collection('users').doc(id).get()).get('sessionGeneration')
        }

        async function sessionsStored(userId: string) {
            const snapshot = await firestore
                .collection('sessions')
                .where('userId', '==', userId)
                .get()
            return snapshot.size
        }

        async function cachedUser(id: string) {
            for (let attempt = 0; attempt < 40; attempt++) {
                if ((await cache.cacheGet(`user-${id}`)).cached) return true
                await new Promise((resolve) => setTimeout(resolve, 50))
            }
            return false
        }

        async function expectEveryOldSessionEnded(
            account: User & { username: string },
            change: () => Promise<User>,
            copied: { id: string }
        ) {
            const own = await login(account.username, ORIGINAL_PASSWORD)
            await expect(authorize(copied.id)).resolves.toMatchObject({ session: copied })
            await users.getUser(account.id)
            expect(await cachedUser(account.id)).toBe(true)

            const changed = await change()
            expect(changed.sessionGeneration).toBe(1)
            expect(await storedGeneration(account.id)).toBe(1)

            await expect(authorize(copied.id)).resolves.toBeUndefined()
            await expect(authorize(own.id)).resolves.toBeUndefined()
            expect(await sessionsStored(account.id)).toBe(0)
            await expect(tryLogin(account.username, ORIGINAL_PASSWORD)).resolves.toBeUndefined()

            const renewed = await sessions.establish(changed, 'authentication-method')
            await expect(authorize(renewed.id)).resolves.toMatchObject({ session: renewed })
            const fresh = await login(account.username, NEW_PASSWORD)
            await expect(authorize(fresh.id)).resolves.toMatchObject({ session: fresh })
            await expect(authorize(renewed.id)).resolves.toMatchObject({ session: renewed })
        }

        it('ends every session when Set Password commits, even though the store cannot delete them', async () => {
            const account = await createAccount()
            const copied = await login(account.username, ORIGINAL_PASSWORD)
            await expectEveryOldSessionEnded(
                account,
                () => setPassword(account, NEW_PASSWORD),
                copied
            )
        })

        it('ends every session when the password changes through a profile update', async () => {
            const account = await createAccount()
            const copied = await login(account.username, ORIGINAL_PASSWORD)
            await expectEveryOldSessionEnded(
                account,
                () => users.updateUser(copied, {}, NEW_PASSWORD),
                copied
            )
        })

        it('refuses a session established by a login that read the Account before the change', async () => {
            const account = await createAccount()
            const readBeforeChange = await holderOf(account.username, ORIGINAL_PASSWORD)
            await setPassword(account, NEW_PASSWORD)
            const raced = await sessions.establish(readBeforeChange, 'authentication-method')
            await expect(authorize(raced.id)).resolves.toBeUndefined()
            expect(await sessionsStored(account.id)).toBe(0)
        })

        it('keeps the old credential and its sessions when a transaction participant fails', async () => {
            const account = await createAccount()
            const copied = await login(account.username, ORIGINAL_PASSWORD)
            const failing: TransactionParticipant = async () => {
                throw new Error('synthetic participant failure')
            }
            await expect(
                userStore.updatePassword(account.id, NEW_PASSWORD, { participant: failing })
            ).rejects.toThrow()
            await expect(
                userStore.updateUser({
                    userId: account.id,
                    fields: {},
                    password: NEW_PASSWORD,
                    currentPassword: ORIGINAL_PASSWORD,
                    participant: failing
                })
            ).rejects.toThrow()
            expect(await storedGeneration(account.id)).toBeUndefined()
            await expect(tryLogin(account.username, NEW_PASSWORD)).resolves.toBeUndefined()
            await expect(authorize(copied.id)).resolves.toMatchObject({ session: copied })
        })

        it('refuses validation before consuming the challenge or changing credentials', async () => {
            const account = await createAccount()
            const copied = await login(account.username, ORIGINAL_PASSWORD)
            const claim = {
                type: TokenType.PasswordReset,
                userId: account.id,
                email: account.email
            } as const
            const { secret } = await challenges.issueChallenge(claim)
            await expect(
                userStore.updatePassword(account.id, NEW_PASSWORD, {
                    validate: () => {
                        throw new Error('synthetic validation refusal')
                    },
                    participant: challenges.consumeChallenge(secret, claim)
                })
            ).rejects.toThrow()
            expect(await storedGeneration(account.id)).toBeUndefined()
            await expect(authorize(copied.id)).resolves.toMatchObject({ session: copied })
            await expect(tryLogin(account.username, NEW_PASSWORD)).resolves.toBeUndefined()
            await expect(
                users.setPassword({ userId: account.id, secret, password: NEW_PASSWORD })
            ).resolves.toBeDefined()
            await expect(authorize(copied.id)).resolves.toBeUndefined()
        })

        it('commits a transaction participant together with the new credential', async () => {
            const account = await createAccount()
            const challenges = firestore.collection('challenges')
            await challenges.doc(`${account.id}-set`).set({ consumed: false })
            await challenges.doc(`${account.id}-update`).set({ consumed: false })
            const consume =
                (challengeId: string): TransactionParticipant =>
                async (transaction) => {
                    const challenge = await transaction.get(challenges.doc(challengeId))
                    expect(challenge.get('consumed')).toBe(false)
                    transaction.update(challenges.doc(challengeId), { consumed: true })
                }
            await userStore.updatePassword(account.id, NEW_PASSWORD, {
                participant: consume(`${account.id}-set`)
            })
            await userStore.updateUser({
                userId: account.id,
                fields: {},
                password: ORIGINAL_PASSWORD,
                currentPassword: NEW_PASSWORD,
                participant: consume(`${account.id}-update`)
            })
            expect(await storedGeneration(account.id)).toBe(2)
            expect((await challenges.doc(`${account.id}-set`).get()).get('consumed')).toBe(true)
            expect((await challenges.doc(`${account.id}-update`).get()).get('consumed')).toBe(true)
            await expect(login(account.username, ORIGINAL_PASSWORD)).resolves.toBeDefined()
        })

        it('commits a new username and email, the new credential and a reading participant together', async () => {
            const account = await createAccount()
            const replacement = replacementIdentity(account)
            const copied = await login(account.username, ORIGINAL_PASSWORD)
            const challenge = firestore.collection('challenges').doc(`${account.id}-combined`)
            await challenge.set({ consumed: false })
            const consume: TransactionParticipant = async (transaction) => {
                expect((await transaction.get(challenge)).get('consumed')).toBe(false)
                transaction.update(challenge, { consumed: true })
            }

            const [updated, updatedFields] = await userStore.updateUser({
                userId: account.id,
                fields: replacement,
                password: NEW_PASSWORD,
                currentPassword: ORIGINAL_PASSWORD,
                participant: consume
            })

            expect(updatedFields).toEqual(expect.arrayContaining(['username', 'email', 'password']))
            expect(updated).toMatchObject({ ...replacement, sessionGeneration: 1 })
            expect(await storedGeneration(account.id)).toBe(1)
            expect(await uniquenessEntries(account)).toEqual({ username: false, email: false })
            expect(await uniquenessEntries(replacement)).toEqual({ username: true, email: true })
            expect((await challenge.get()).get('consumed')).toBe(true)
            await expect(authorize(copied.id)).resolves.toBeUndefined()
            await expect(tryLogin(account.username, NEW_PASSWORD)).resolves.toBeUndefined()
            await expect(tryLogin(replacement.username, ORIGINAL_PASSWORD)).resolves.toBeUndefined()
            await expect(login(replacement.username, NEW_PASSWORD)).resolves.toBeDefined()
        })

        it('leaves the Account, its uniqueness entries and its sessions unchanged when the participant refuses a combined update', async () => {
            const account = await createAccount()
            const replacement = replacementIdentity(account)
            const copied = await login(account.username, ORIGINAL_PASSWORD)
            const challenge = firestore.collection('challenges').doc(`${account.id}-consumed`)
            await challenge.set({ consumed: true })
            const consumeOnce: TransactionParticipant = async (transaction) => {
                if ((await transaction.get(challenge)).get('consumed')) {
                    throw new Error('synthetic challenge already consumed')
                }
                transaction.update(challenge, { consumed: true })
            }

            await expect(
                userStore.updateUser({
                    userId: account.id,
                    fields: replacement,
                    password: NEW_PASSWORD,
                    currentPassword: ORIGINAL_PASSWORD,
                    participant: consumeOnce
                })
            ).rejects.toThrow()

            const stored = await userStore.findById(account.id)
            expect(stored).toMatchObject({
                username: account.username,
                email: account.email,
                status: UserStatus.Active
            })
            expect(stored?.sessionGeneration).toBeUndefined()
            expect(await uniquenessEntries(account)).toEqual({ username: true, email: true })
            expect(await uniquenessEntries(replacement)).toEqual({ username: false, email: false })
            await expect(authorize(copied.id)).resolves.toMatchObject({ session: copied })
            await expect(tryLogin(replacement.username, NEW_PASSWORD)).resolves.toBeUndefined()
            await expect(login(account.username, ORIGINAL_PASSWORD)).resolves.toBeDefined()
        })

        it('leaves sessions of other Accounts and Logout All untouched', async () => {
            const account = await createAccount()
            const bystander = await createAccount()
            const bystanderSession = await login(bystander.username, ORIGINAL_PASSWORD)
            await setPassword(account, NEW_PASSWORD)
            await expect(authorize(bystanderSession.id)).resolves.toMatchObject({
                session: bystanderSession
            })
            const plainStore = new FirestoreSessionStore(cache, firestore)
            await plainStore.deleteForUser(bystander.id)
            await expect(authorize(bystanderSession.id)).resolves.toBeUndefined()
        })
    }
)
