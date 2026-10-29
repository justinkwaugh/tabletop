import { describe, expect, it } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { SessionService, SESSION_LIFETIME_SECONDS } from './sessionService.js'
import { MemorySessionStore } from '../persistence/memory/sessionStore.js'
import { AccountUnavailableError } from '../users/errors.js'

function account(status: UserStatus, id = 'account-1', sessionGeneration?: number): User {
    return { id, status, roles: [Role.User], externalIds: [], sessionGeneration }
}

function fixture(start = new Date('2026-10-27T12:00:00.000Z')) {
    let now = start
    const store = new MemorySessionStore()
    const sessions = new SessionService(store, { now: () => now })
    const accounts = new Map<string, User>()
    const register = (user: User) => {
        accounts.set(user.id, user)
        return user
    }
    register(account(UserStatus.Active))
    const findAccount = async (id: string) => accounts.get(id)
    const authorize = (id: string) => sessions.authorize(id, findAccount)
    return {
        store,
        sessions,
        authorize,
        register,
        forget: (id: string) => accounts.delete(id),
        advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000))
    }
}

describe('Authenticated Session lifecycle', () => {
    it('establishes an unguessable durable session for an Active or Incomplete Account', async () => {
        const { sessions, store, authorize, register } = fixture()
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const user = register(account(status))
            const session = await sessions.establish(user)
            expect(session.id).toMatch(/^[0-9A-Za-z]{32}$/)
            expect(session.userId).toBe('account-1')
            expect(session.generation).toBe(0)
            expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(
                SESSION_LIFETIME_SECONDS * 1000
            )
            expect(session.authenticatedAt).toEqual(session.createdAt)
            await expect(authorize(session.id)).resolves.toEqual({ session, user })
        }
        expect(store.size).toBe(2)
    })

    it('refuses an Inactive or Deleted Account a session', async () => {
        const { sessions, store } = fixture()
        for (const status of [UserStatus.Inactive, UserStatus.Deleted]) {
            await expect(sessions.establish(account(status))).rejects.toThrow(
                AccountUnavailableError
            )
        }
        expect(store.size).toBe(0)
    })

    it('does not authorize an unknown session id', async () => {
        const { authorize } = fixture()
        await expect(authorize('not-a-session')).resolves.toBeUndefined()
    })

    it('does not authorize a session whose Account no longer exists', async () => {
        const { sessions, authorize, forget } = fixture()
        const session = await sessions.establish(account(UserStatus.Active))
        forget('account-1')
        await expect(authorize(session.id)).resolves.toBeUndefined()
    })

    it('stops authorizing a session once it is revoked', async () => {
        const { sessions, authorize } = fixture()
        const session = await sessions.establish(account(UserStatus.Active))
        await sessions.revoke(session.id)
        await expect(authorize(session.id)).resolves.toBeUndefined()
    })

    it('keeps concurrent sessions independent', async () => {
        const { sessions, authorize } = fixture()
        const first = await sessions.establish(account(UserStatus.Active))
        const second = await sessions.establish(account(UserStatus.Active))
        expect(first.id).not.toBe(second.id)
        await sessions.revoke(first.id)
        await expect(authorize(second.id)).resolves.toMatchObject({ session: second })
    })

    it('expires a session thirty days after it was established, with no sliding extension', async () => {
        const { sessions, authorize, advance, store } = fixture()
        const session = await sessions.establish(account(UserStatus.Active))
        advance(SESSION_LIFETIME_SECONDS - 1)
        await expect(authorize(session.id)).resolves.toMatchObject({ session })
        advance(1)
        await expect(authorize(session.id)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
    })

    it('revokes every session of one Account, optionally sparing one', async () => {
        const { sessions, authorize, register } = fixture()
        register(account(UserStatus.Active, 'account-2'))
        const kept = await sessions.establish(account(UserStatus.Active))
        const other = await sessions.establish(account(UserStatus.Active))
        const someoneElse = await sessions.establish(account(UserStatus.Active, 'account-2'))
        await sessions.revokeAll('account-1', { except: kept.id })
        await expect(authorize(kept.id)).resolves.toMatchObject({ session: kept })
        await expect(authorize(other.id)).resolves.toBeUndefined()
        await expect(authorize(someoneElse.id)).resolves.toMatchObject({ session: someoneElse })
        await sessions.revokeAll('account-1')
        await expect(authorize(kept.id)).resolves.toBeUndefined()
        await expect(authorize(someoneElse.id)).resolves.toMatchObject({ session: someoneElse })
    })
})

describe('Session Generation', () => {
    it('records the Account generation at establishment and authorizes while it matches', async () => {
        const { sessions, authorize, register } = fixture()
        const user = register(account(UserStatus.Active, 'account-1', 3))
        const session = await sessions.establish(user)
        expect(session.generation).toBe(3)
        await expect(authorize(session.id)).resolves.toEqual({ session, user })
    })

    it('stops authorizing every session once the Account generation advances, without any revocation call', async () => {
        const { sessions, authorize, register, store } = fixture()
        const before = account(UserStatus.Active)
        const copied = await sessions.establish(before)
        const own = await sessions.establish(before)
        register(account(UserStatus.Active, 'account-1', 1))
        await expect(authorize(copied.id)).resolves.toBeUndefined()
        await expect(authorize(own.id)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
    })

    it('refuses a session established from a stale Account read after the generation advanced', async () => {
        const { sessions, authorize, register } = fixture()
        const staleRead = account(UserStatus.Active)
        const current = register(account(UserStatus.Active, 'account-1', 1))
        const raced = await sessions.establish(staleRead)
        const fresh = await sessions.establish(current)
        await expect(authorize(raced.id)).resolves.toBeUndefined()
        await expect(authorize(fresh.id)).resolves.toEqual({ session: fresh, user: current })
    })
})
