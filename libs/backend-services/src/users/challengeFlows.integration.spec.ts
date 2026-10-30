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
import { SessionNotLiveError, SessionService } from '../sessions/sessionService.js'
import { RecentAuthenticationRequiredError } from '../sessions/recentAuthentication.js'
import type { TaskService } from '../tasks/taskService.js'
import { UserService } from './userService.js'
import { EmailChangeError } from './errors.js'

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
        const mails: { kind: string; userId: string; token: string; email?: string }[] = []
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
                    TokenType.EmailChange,
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
                    await sessions.establish(account, 'authentication-method'),
                    { email: `moved-${account.id}@example.test` }
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

        describe('profile changes with Recent Authentication', () => {
            it('sets a provider Account password without changing its verified address or status', async () => {
                const account = await createAccount(
                    { externalIds: ['google:g-2'] },
                    { withPassword: false }
                )
                const copied = await sessions.establish(account, 'authentication-method')
                const updated = await users.updateUser(copied, {}, NEW_PASSWORD)
                expect(updated).toMatchObject({
                    email: account.email,
                    emailVerified: true,
                    status: UserStatus.Active,
                    hasPassword: true,
                    sessionGeneration: 1
                })
                expect(await challengeDocuments(account.id)).toEqual([])
                expect(
                    (await firestore.collection('userEmails').doc(account.email).get()).exists
                ).toBe(true)
                await expect(authorize(copied.id)).resolves.toBeUndefined()
                await expect(login(account.username, NEW_PASSWORD)).resolves.toBeDefined()
                expect(notifications).toContainEqual({
                    email: account.email,
                    changeType: 'password'
                })
            })

            it('leaves the Account, uniqueness entries and sessions unchanged when proof is stale', async () => {
                const account = await createAccount()
                const session = await sessions.establish(account, 'authentication-method')
                const original = await stored(account.id)
                const email = `refused-${account.id}@example.test`
                await expect(
                    users.updateUser(
                        { ...session, authenticatedAt: new Date(Date.now() - 16 * 60_000) },
                        { email, username: `Refused-${account.id}` },
                        NEW_PASSWORD
                    )
                ).rejects.toThrow(RecentAuthenticationRequiredError)
                expect(await stored(account.id)).toEqual(original)
                expect((await firestore.collection('userEmails').doc(email).get()).exists).toBe(
                    false
                )
                expect(
                    (await firestore.collection('userEmails').doc(account.email).get()).exists
                ).toBe(true)
                await expect(authorize(session.id)).resolves.toBeDefined()
            })

            it('refuses an update authorized before another credential change committed', async () => {
                const account = await createAccount()
                const staleRequest = await sessions.establish(account, 'authentication-method')
                await users.updateUser(staleRequest, {}, NEW_PASSWORD)
                const committed = await stored(account.id)
                const email = `late-${account.id}@example.test`
                await expect(
                    users.updateUser(staleRequest, { email }, ORIGINAL_PASSWORD)
                ).rejects.toThrow(SessionNotLiveError)
                expect(await stored(account.id)).toEqual(committed)
                expect((await firestore.collection('userEmails').doc(email).get()).exists).toBe(
                    false
                )
            })
        })

        describe('Pending Email Address', () => {
            async function pendingChange() {
                const account = await createAccount()
                const session = await sessions.establish(account, 'authentication-method')
                const email = `next-${account.id}@example.test`
                const original = await stored(account.id)
                const pending = await users.requestEmailChange(session, email.toUpperCase())
                const secret = lastMail('verification').token
                return { account, session, email, original, pending, secret }
            }

            it('keeps the verified address, Active status, cache, reservation and sessions until verification', async () => {
                const { account, session, original, pending, email } = await pendingChange()
                expect(await stored(account.id)).toEqual(original)
                expect(await users.getUser(account.id)).toMatchObject({
                    email: account.email,
                    emailVerified: true,
                    status: UserStatus.Active
                })
                expect(await users.getUserByEmail(account.email)).toMatchObject({ id: account.id })
                expect(await users.getUserByEmail(email)).toBeUndefined()
                expect(
                    (await firestore.collection('userEmails').doc(account.email).get()).exists
                ).toBe(true)
                expect((await firestore.collection('userEmails').doc(email).get()).exists).toBe(
                    false
                )
                expect(await authorize(session.id)).toBeDefined()
                expect(lastMail('verification')).toMatchObject({ userId: account.id, email })
                expect(await users.pendingEmailChange(account)).toEqual(pending)
                expect(notifications).toContainEqual({
                    email: account.email,
                    changeType: 'emailChangeRequested'
                })
                await users.sendPasswordResetEmail(account)
                expect(
                    (await tokenStore.find(`${TokenType.PasswordReset}:${account.id}`))?.data.email
                ).toBe(account.email)
            })

            it('promotes the verified replacement, consumes its challenge and ends old sessions in one commit', async () => {
                const { account, session, email, secret } = await pendingChange()
                const copied = await sessions.establish(account, 'authentication-method')
                const updated = await users.confirmEmailChange(session, email.toUpperCase(), secret)
                expect(updated).toMatchObject({
                    email,
                    emailVerified: true,
                    status: UserStatus.Active,
                    sessionGeneration: 1
                })
                expect(await users.getUser(account.id)).toMatchObject({
                    email,
                    emailVerified: true,
                    status: UserStatus.Active
                })
                expect(await challengeDocuments(account.id)).toEqual([])
                expect(
                    (await firestore.collection('userEmails').doc(account.email).get()).exists
                ).toBe(false)
                expect((await firestore.collection('userEmails').doc(email).get()).exists).toBe(
                    true
                )
                expect(await authorize(session.id)).toBeUndefined()
                expect(await authorize(copied.id)).toBeUndefined()
                expect(notifications).toContainEqual({ email: account.email, changeType: 'email' })
                expect(await users.pendingEmailChange(updated)).toBeUndefined()
                const renewed = await sessions.establish(updated, {
                    authenticatedAt: session.authenticatedAt
                })
                expect(await authorize(renewed.id)).toBeDefined()
                await expect(users.confirmEmailChange(renewed, email, secret)).rejects.toThrow(
                    InvalidChallengeError
                )
            })

            it('refuses wrong codes, destinations, accounts and onboarding-purpose codes without changing the Account', async () => {
                const { account, session, email, original, secret } = await pendingChange()
                await expect(users.confirmEmailChange(session, email, 'incorrect')).rejects.toThrow(
                    InvalidChallengeError
                )
                await expect(
                    users.confirmEmailChange(session, `wrong-${email}`, secret)
                ).rejects.toThrow(InvalidChallengeError)
                const other = await createAccount()
                const otherSession = await sessions.establish(other, 'authentication-method')
                await expect(users.confirmEmailChange(otherSession, email, secret)).rejects.toThrow(
                    InvalidChallengeError
                )
                await users.sendVerificationEmail(account)
                await expect(
                    users.confirmEmailChange(session, email, lastMail('verification').token)
                ).rejects.toThrow(InvalidChallengeError)
                expect(await stored(account.id)).toEqual(original)
                await expect(
                    users.confirmEmailChange(session, email, secret)
                ).resolves.toMatchObject({ email, status: UserStatus.Active })
            })

            it('reissuing or cancelling leaves the current address untouched and invalidates the earlier code', async () => {
                const { account, session, email, original, secret } = await pendingChange()
                const replacement = `replacement-${email}`
                await users.requestEmailChange(session, replacement)
                const newSecret = lastMail('verification').token
                await expect(users.confirmEmailChange(session, email, secret)).rejects.toThrow(
                    InvalidChallengeError
                )
                await users.cancelEmailChange(account.id)
                expect(await users.pendingEmailChange(account)).toBeUndefined()
                await expect(
                    users.confirmEmailChange(session, replacement, newSecret)
                ).rejects.toThrow(InvalidChallengeError)
                expect(await stored(account.id)).toEqual(original)
                expect(await authorize(session.id)).toBeDefined()
            })

            it('expired requests disappear and cannot change a verified address', async () => {
                const { account, session, email, original, secret } = await pendingChange()
                const before = now
                now = new Date(now.getTime() + 16 * 60_000)
                try {
                    expect(await users.pendingEmailChange(account)).toBeUndefined()
                    await expect(users.confirmEmailChange(session, email, secret)).rejects.toThrow(
                        InvalidChallengeError
                    )
                    expect(await stored(account.id)).toEqual(original)
                } finally {
                    now = before
                }
            })

            it('checks recent proof at request and confirmation and refuses the old direct-update path', async () => {
                const { account, session, email, original, secret } = await pendingChange()
                const stale = { ...session, authenticatedAt: new Date(Date.now() - 16 * 60_000) }
                await expect(users.requestEmailChange(stale, email)).rejects.toThrow(
                    RecentAuthenticationRequiredError
                )
                await expect(users.confirmEmailChange(stale, email, secret)).rejects.toThrow(
                    RecentAuthenticationRequiredError
                )
                await expect(users.updateUser(session, { email }, NEW_PASSWORD)).rejects.toThrow(
                    EmailChangeError
                )
                expect(await stored(account.id)).toEqual(original)
                expect(await authorize(session.id)).toBeDefined()
            })

            it('rolls back the entire confirmation if challenge storage fails', async () => {
                const { account, session, email, original, secret } = await pendingChange()
                tokenStore.failNextFind = true
                await expect(users.confirmEmailChange(session, email, secret)).rejects.toThrow()
                expect(await stored(account.id)).toEqual(original)
                expect(
                    (await firestore.collection('userEmails').doc(account.email).get()).exists
                ).toBe(true)
                expect((await firestore.collection('userEmails').doc(email).get()).exists).toBe(
                    false
                )
                expect(await users.pendingEmailChange(account)).toBeDefined()
                expect(await authorize(session.id)).toBeDefined()
                await expect(
                    users.confirmEmailChange(session, email, secret)
                ).resolves.toMatchObject({ email, status: UserStatus.Active })
            })

            it('keeps the old address and code when another Account acquires the proposed address', async () => {
                const { account, session, email, original, secret } = await pendingChange()
                await createAccount({ email })
                await expect(users.confirmEmailChange(session, email, secret)).rejects.toThrow()
                expect(await stored(account.id)).toEqual(original)
                expect(await users.pendingEmailChange(account)).toBeDefined()
                expect(await authorize(session.id)).toBeDefined()
            })

            it('admits exactly one concurrent confirmation', async () => {
                const { session, email, secret } = await pendingChange()
                const results = await Promise.allSettled(
                    Array.from({ length: 4 }, () =>
                        users.confirmEmailChange(session, email, secret)
                    )
                )
                expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
                expect(results.filter((result) => result.status === 'rejected')).toHaveLength(3)
                expect(await users.getUser(session.userId)).toMatchObject({
                    email,
                    emailVerified: true,
                    status: UserStatus.Active,
                    sessionGeneration: 1
                })
            })

            it('a later password change makes a pending email change unusable even in a fresh session', async () => {
                const { account, session, email, secret } = await pendingChange()
                const updated = await users.updateUser(session, {}, NEW_PASSWORD)
                const renewed = await sessions.establish(updated, 'authentication-method')
                expect(await users.pendingEmailChange(updated)).toBeUndefined()
                await expect(users.confirmEmailChange(renewed, email, secret)).rejects.toThrow(
                    InvalidChallengeError
                )
                expect(await users.getUser(account.id)).toMatchObject({
                    email: account.email,
                    emailVerified: true,
                    status: UserStatus.Active
                })
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
