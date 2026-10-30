import type { Transaction } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import {
    InvalidChallengeError,
    parseSetPasswordChallenge
} from '../tokens/authenticationChallenge.js'
import { TokenType, type DataToken } from '../tokens/dataToken.js'
import { TokenService } from '../tokens/tokenService.js'
import { FirestoreTokenStore } from '../persistence/firestore/tokenStore.js'
import { FirestoreSessionStore } from '../persistence/firestore/sessionStore.js'
import { FirestoreUserStore } from '../persistence/firestore/userStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import type { TokenStore } from '../persistence/stores/tokenStore.js'
import { UnknownStorageError } from '../persistence/stores/errors.js'
import { SessionService } from '../sessions/sessionService.js'
import type { TaskService } from '../tasks/taskService.js'
import { UnauthenticatedUpdateError } from './errors.js'
import { UserService } from './userService.js'

const ORIGINAL_PASSWORD = 'original-password-value'
const NEW_PASSWORD = 'replacement-password-value'

class FailingOnceTokenStore extends FirestoreTokenStore {
    failNextFind = false

    override async find(key: string, transaction?: Transaction): Promise<DataToken | undefined> {
        if (this.failNextFind) {
            this.failNextFind = false
            throw new Error('synthetic challenge storage failure')
        }
        return super.find(key, transaction)
    }
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Authentication Challenges consumed with their protected Account mutation',
    { timeout: 30_000 },
    () => {
        const run = `challenge-${Date.now()}`
        const firestore = isolatedFirestore()
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const userStore = new FirestoreUserStore(cache, firestore)
        const sessions = new SessionService(new FirestoreSessionStore(cache, firestore))
        const tokenStore = new FailingOnceTokenStore(firestore)
        let now = new Date('2026-10-27T12:00:00.000Z')
        const challenges = new TokenService(tokenStore, { now: () => now })
        const mails: { kind: string; userId: string; token: string }[] = []
        const notifications: { email: string; changeType: string }[] = []
        let noticeQueueRejects = false
        const tasks: TaskService = Object.create(null)
        tasks.sendPasswordResetEmail = async (mail) => {
            mails.push({ kind: 'reset', ...mail })
        }
        tasks.sendVerificationEmail = async (mail) => {
            mails.push({ kind: 'verification', ...mail })
        }
        tasks.sendAuthVerificationEmail = async (mail) => {
            mails.push({ kind: 'sensitive', ...mail })
        }
        tasks.sendAccountChangeNotificationEmail = async ({ email, changeType }) => {
            if (noticeQueueRejects) {
                throw new Error(`synthetic queue rejection for ${email}`)
            }
            notifications.push({ email, changeType })
        }
        const users = new UserService(userStore, challenges, tasks)
        const authorize = (sessionId: string) =>
            sessions.authorize(sessionId, (id) => users.getUser(id))
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

        async function createAccount(
            overrides: Partial<User> = {},
            { withPassword = true }: { withPassword?: boolean } = {}
        ) {
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
                externalIds: [],
                ...overrides
            }
            const password = withPassword ? ORIGINAL_PASSWORD : undefined
            return { ...(await userStore.createUser(account, password)), username, email }
        }

        function lastMail(kind: string) {
            const mail = [...mails].reverse().find((candidate) => candidate.kind === kind)
            if (!mail) throw new Error(`no ${kind} mail was sent`)
            return mail
        }

        function lastResetSecret(): { userId: string; secret: string } {
            const presented = parseSetPasswordChallenge(lastMail('reset').token)
            if (!presented) throw new Error('reset mail carries no Set Password challenge')
            return presented
        }

        async function login(username: string, password: string) {
            const user = await userStore.findByUsernameAndPassword(username, password)
            return user ? sessions.establish(user, 'authentication-method') : undefined
        }

        async function stored(id: string) {
            return (await firestore.collection('users').doc(id).get()).data()
        }

        async function challengeDocuments(userId: string) {
            const documents = await Promise.all(
                [
                    TokenType.PasswordReset,
                    TokenType.EmailVerification,
                    TokenType.SensitiveChange
                ].map((type) => firestore.collection('tokens').doc(`${type}:${userId}`).get())
            )
            return documents.filter((doc) => doc.exists).map((doc) => doc.id)
        }

        describe('Set Password', () => {
            it('consumes the challenge, writes the credential and advances the Session Generation in one commit', async () => {
                const account = await createAccount()
                const copied = await login(account.username, ORIGINAL_PASSWORD)
                expect(copied).toBeDefined()
                const issued = await users.sendPasswordResetEmail(account)
                expect(issued?.expiresAt).toEqual(new Date('2026-10-27T12:15:00.000Z'))
                expect(await challengeDocuments(account.id)).toEqual([
                    `${TokenType.PasswordReset}:${account.id}`
                ])
                const { userId, secret } = lastResetSecret()
                expect(userId).toBe(account.id)
                expect(notifications).toContainEqual({
                    email: account.email,
                    changeType: 'passwordReset'
                })

                const updated = await users.setPassword({ userId, secret, password: NEW_PASSWORD })
                expect(updated.sessionGeneration).toBe(1)
                expect(updated.status).toBe(UserStatus.Active)
                expect((await stored(account.id))?.sessionGeneration).toBe(1)
                expect(await challengeDocuments(account.id)).toEqual([])
                expect(notifications).toContainEqual({
                    email: account.email,
                    changeType: 'password'
                })
                await expect(authorize(copied!.id)).resolves.toBeUndefined()
                await expect(login(account.username, ORIGINAL_PASSWORD)).resolves.toBeUndefined()
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeDefined()
            })

            it('commits the reset and ends the copied session even when the change notice is not queued', async () => {
                const account = await createAccount()
                const copied = await login(account.username, ORIGINAL_PASSWORD)
                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                const noticesBefore = notifications.length
                const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
                noticeQueueRejects = true
                let diagnostics: string
                try {
                    const updated = await users.setPassword({
                        ...presented,
                        password: NEW_PASSWORD
                    })
                    expect(updated.sessionGeneration).toBe(1)
                    expect(logged).toHaveBeenCalledOnce()
                    diagnostics = JSON.stringify(logged.mock.calls)
                } finally {
                    noticeQueueRejects = false
                    logged.mockRestore()
                }
                expect(notifications).toHaveLength(noticesBefore)
                expect(diagnostics).toContain(account.id)
                expect(diagnostics).not.toContain(account.email)
                expect(diagnostics).not.toContain(presented.secret)
                expect((await stored(account.id))?.sessionGeneration).toBe(1)
                expect(await challengeDocuments(account.id)).toEqual([])
                await expect(authorize(copied!.id)).resolves.toBeUndefined()
                await expect(login(account.username, ORIGINAL_PASSWORD)).resolves.toBeUndefined()
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeDefined()
                await expect(
                    users.setPassword({ ...presented, password: 'yet-another-password-value' })
                ).rejects.toThrow(InvalidChallengeError)
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeDefined()
            })

            it('refuses a replayed challenge and leaves the new credential as it is', async () => {
                const account = await createAccount()
                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                await users.setPassword({ ...presented, password: NEW_PASSWORD })
                await expect(
                    users.setPassword({ ...presented, password: 'yet-another-password-value' })
                ).rejects.toThrow(InvalidChallengeError)
                expect((await stored(account.id))?.sessionGeneration).toBe(1)
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeDefined()
            })

            it('lets exactly one of two concurrent submissions through', async () => {
                const account = await createAccount()
                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                const outcomes = await Promise.allSettled([
                    users.setPassword({ ...presented, password: NEW_PASSWORD }),
                    users.setPassword({ ...presented, password: 'the-other-password-value' })
                ])
                const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled')
                const rejected = outcomes.filter((outcome) => outcome.status === 'rejected')
                expect(fulfilled).toHaveLength(1)
                expect(rejected).toHaveLength(1)
                // The loser sees the consumed challenge after the winner commits, or the emulator
                // reports the document contention itself; neither grants anything.
                expect(rejected[0].status === 'rejected' && rejected[0].reason).toSatisfy(
                    (reason: unknown) =>
                        reason instanceof InvalidChallengeError ||
                        reason instanceof UnknownStorageError
                )
                expect((await stored(account.id))?.sessionGeneration).toBe(1)
                const winners = await Promise.all([
                    login(account.username, NEW_PASSWORD),
                    login(account.username, 'the-other-password-value')
                ])
                expect(winners.filter((session) => session !== undefined)).toHaveLength(1)
            })

            it('invalidates the earlier link when a second reset is requested', async () => {
                const account = await createAccount()
                await users.sendPasswordResetEmail(account)
                const first = lastResetSecret()
                await users.sendPasswordResetEmail(account)
                const second = lastResetSecret()
                expect(second.secret).not.toBe(first.secret)
                expect(await challengeDocuments(account.id)).toEqual([
                    `${TokenType.PasswordReset}:${account.id}`
                ])
                await expect(
                    users.setPassword({ ...first, password: NEW_PASSWORD })
                ).rejects.toThrow(InvalidChallengeError)
                expect((await stored(account.id))?.sessionGeneration).toBeUndefined()
                await expect(
                    users.setPassword({ ...second, password: NEW_PASSWORD })
                ).resolves.toBeDefined()
            })

            it('rejects a challenge of another purpose, another Account or a changed address', async () => {
                const account = await createAccount()
                const other = await createAccount()
                await users.sendVerificationEmail(account)
                const code = lastMail('verification').token
                await expect(
                    users.setPassword({ userId: account.id, secret: code, password: NEW_PASSWORD })
                ).rejects.toThrow(InvalidChallengeError)

                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                await expect(
                    users.setPassword({
                        userId: other.id,
                        secret: presented.secret,
                        password: NEW_PASSWORD
                    })
                ).rejects.toThrow(InvalidChallengeError)

                await userStore.updateUser({
                    userId: account.id,
                    fields: { email: `moved-${account.id}@example.test` }
                })
                await expect(
                    users.setPassword({ ...presented, password: NEW_PASSWORD })
                ).rejects.toThrow(InvalidChallengeError)
                for (const id of [account.id, other.id]) {
                    expect((await stored(id))?.sessionGeneration).toBeUndefined()
                }
                await expect(login(other.username, ORIGINAL_PASSWORD)).resolves.toBeDefined()
            })

            it('rejects an expired challenge', async () => {
                const account = await createAccount()
                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                const issuedAt = now
                now = new Date(issuedAt.getTime() + 15 * 60 * 1000)
                try {
                    await expect(
                        users.setPassword({ ...presented, password: NEW_PASSWORD })
                    ).rejects.toThrow(InvalidChallengeError)
                } finally {
                    now = issuedAt
                }
                expect((await stored(account.id))?.sessionGeneration).toBeUndefined()
            })

            it('fails safely when the challenge store fails and keeps the challenge usable afterwards', async () => {
                const account = await createAccount()
                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                tokenStore.failNextFind = true
                await expect(
                    users.setPassword({ ...presented, password: NEW_PASSWORD })
                ).rejects.toThrow()
                expect((await stored(account.id))?.sessionGeneration).toBeUndefined()
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeUndefined()
                await expect(
                    users.setPassword({ ...presented, password: NEW_PASSWORD })
                ).resolves.toBeDefined()
            })

            it('issues nothing for an Inactive or Deleted Account and refuses one that became Inactive', async () => {
                const mailsBefore = mails.length
                for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
                    const account = await createAccount({ status })
                    await expect(users.sendPasswordResetEmail(account)).resolves.toBeUndefined()
                    expect(await challengeDocuments(account.id)).toEqual([])
                }
                expect(mails.length).toBe(mailsBefore)

                const account = await createAccount()
                await users.sendPasswordResetEmail(account)
                const presented = lastResetSecret()
                await firestore
                    .collection('users')
                    .doc(account.id)
                    .update({ status: UserStatus.Inactive })
                await cache.delete(`user-${account.id}`)
                await expect(
                    users.setPassword({ ...presented, password: NEW_PASSWORD })
                ).rejects.toThrow(InvalidChallengeError)
                expect((await stored(account.id))?.passwordHash).toBeDefined()
                expect((await stored(account.id))?.sessionGeneration).toBeUndefined()
            })

            it('gives an Incomplete provider-only Account its first Password Credential without changing status', async () => {
                const account = await createAccount(
                    {
                        status: UserStatus.Incomplete,
                        emailVerified: false,
                        externalIds: ['google:g-1']
                    },
                    { withPassword: false }
                )
                await users.sendPasswordResetEmail(account)
                const updated = await users.setPassword({
                    ...lastResetSecret(),
                    password: NEW_PASSWORD
                })
                expect(updated).toMatchObject({
                    status: UserStatus.Incomplete,
                    emailVerified: false,
                    hasPassword: true,
                    sessionGeneration: 1
                })
            })
        })

        describe('Email Verification', () => {
            it('verifies the exact address with a single-use code and completes the Account', async () => {
                const account = await createAccount({
                    status: UserStatus.Incomplete,
                    emailVerified: false
                })
                const issued = await users.sendVerificationEmail(account)
                expect(issued.expiresAt).toEqual(new Date('2026-10-27T12:15:00.000Z'))
                const code = lastMail('verification').token
                expect(code).toHaveLength(6)
                await expect(users.verifyEmail(account, 'WRONG1')).rejects.toThrow(
                    InvalidChallengeError
                )
                const verified = await users.verifyEmail(account, code)
                expect(verified).toMatchObject({ emailVerified: true, status: UserStatus.Active })
                expect(await challengeDocuments(account.id)).toEqual([])
                await expect(users.verifyEmail(verified, code)).rejects.toThrow(
                    InvalidChallengeError
                )
            })

            it('rejects a code issued for an address the Account no longer has', async () => {
                const account = await createAccount({
                    status: UserStatus.Incomplete,
                    emailVerified: false
                })
                await users.sendVerificationEmail(account)
                const stale = lastMail('verification').token
                const moved = await users.updateUser(
                    account.id,
                    { email: `moved-${account.id}@example.test` },
                    undefined,
                    ORIGINAL_PASSWORD
                )
                const fresh = lastMail('verification').token
                expect(fresh).not.toBe(stale)
                await expect(users.verifyEmail(moved, stale)).rejects.toThrow(InvalidChallengeError)
                expect((await stored(account.id))?.emailVerified).toBe(false)
                await expect(users.verifyEmail(moved, fresh)).resolves.toMatchObject({
                    emailVerified: true
                })
            })
        })

        describe('Sensitive Change', () => {
            it('commits the bound email and password change, the uniqueness entries and the challenge together', async () => {
                const account = await createAccount(
                    { externalIds: ['google:g-2'] },
                    { withPassword: false }
                )
                const copied = await sessions.establish(account, 'authentication-method')
                const newEmail = `next-${account.id}@example.test`
                const issued = await users.sendSensitiveChangeChallenge(account, {
                    email: newEmail.toUpperCase(),
                    password: true
                })
                expect(issued.expiresAt).toEqual(new Date('2026-10-27T12:15:00.000Z'))
                const code = lastMail('sensitive').token

                await expect(
                    users.updateUser(
                        account.id,
                        { email: newEmail },
                        NEW_PASSWORD,
                        undefined,
                        undefined
                    )
                ).rejects.toThrow(UnauthenticatedUpdateError)
                await expect(
                    users.updateUser(
                        account.id,
                        { email: `else-${account.id}@example.test` },
                        NEW_PASSWORD,
                        undefined,
                        code
                    )
                ).rejects.toThrow(InvalidChallengeError)
                await expect(
                    users.updateUser(account.id, { email: newEmail }, undefined, undefined, code)
                ).rejects.toThrow(InvalidChallengeError)
                expect(await stored(account.id)).toMatchObject({ email: account.email })

                const updated = await users.updateUser(
                    account.id,
                    { email: newEmail },
                    NEW_PASSWORD,
                    undefined,
                    code
                )
                expect(updated).toMatchObject({
                    email: newEmail,
                    emailVerified: false,
                    hasPassword: true,
                    sessionGeneration: 1
                })
                expect(await challengeDocuments(account.id)).toEqual([
                    `${TokenType.EmailVerification}:${account.id}`
                ])
                expect((await firestore.collection('userEmails').doc(newEmail).get()).exists).toBe(
                    true
                )
                expect(
                    (await firestore.collection('userEmails').doc(account.email).get()).exists
                ).toBe(false)
                await expect(authorize(copied.id)).resolves.toBeUndefined()
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeDefined()
                await expect(
                    users.updateUser(account.id, {}, 'another-password-value-1', undefined, code)
                ).rejects.toThrow(UnauthenticatedUpdateError)
            })

            it('does not accept a Set Password or verification challenge as a Sensitive Change proof', async () => {
                const account = await createAccount(
                    { externalIds: ['google:g-3'] },
                    { withPassword: false }
                )
                await users.sendPasswordResetEmail(account)
                const { secret } = lastResetSecret()
                await expect(
                    users.updateUser(account.id, {}, NEW_PASSWORD, undefined, secret)
                ).rejects.toThrow(InvalidChallengeError)
                await users.sendVerificationEmail(account)
                await expect(
                    users.updateUser(
                        account.id,
                        {},
                        NEW_PASSWORD,
                        undefined,
                        lastMail('verification').token
                    )
                ).rejects.toThrow(InvalidChallengeError)
                expect((await stored(account.id))?.passwordHash).toBeUndefined()
            })
        })

        it('keeps a failing store from granting anything', async () => {
            const failing: TokenStore = {
                create: async (token) => token,
                replace: async () => {
                    throw new Error('synthetic replace failure')
                },
                find: async () => undefined,
                delete: async () => {}
            }
            const brokenUsers = new UserService(userStore, new TokenService(failing), tasks)
            const account = await createAccount()
            const mailsBefore = mails.length
            await expect(brokenUsers.sendPasswordResetEmail(account)).rejects.toThrow(
                'synthetic replace failure'
            )
            expect(mails.length).toBe(mailsBefore)
        })
    }
)
