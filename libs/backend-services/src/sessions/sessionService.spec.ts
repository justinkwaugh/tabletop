import { describe, expect, it } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { SessionService, SESSION_LIFETIME_SECONDS } from './sessionService.js'
import { MemorySessionStore } from '../persistence/memory/sessionStore.js'
import { AccountUnavailableError } from '../users/errors.js'

function account(status: UserStatus, id = 'account-1'): User {
    return { id, status, roles: [Role.User], externalIds: [] }
}

function fixture(start = new Date('2026-10-27T12:00:00.000Z')) {
    let now = start
    const store = new MemorySessionStore()
    const sessions = new SessionService(store, { now: () => now })
    return { store, sessions, advance: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000)) }
}

describe('Authenticated Session lifecycle', () => {
    it('establishes an unguessable durable session for an Active or Incomplete Account', async () => {
        const { sessions, store } = fixture()
        for (const status of [UserStatus.Active, UserStatus.Incomplete]) {
            const session = await sessions.establish(account(status))
            expect(session.id).toMatch(/^[0-9A-Za-z]{32}$/)
            expect(session.userId).toBe('account-1')
            expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(
                SESSION_LIFETIME_SECONDS * 1000
            )
            expect(session.authenticatedAt).toEqual(session.createdAt)
            await expect(sessions.authorize(session.id)).resolves.toEqual(session)
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
        const { sessions } = fixture()
        await expect(sessions.authorize('not-a-session')).resolves.toBeUndefined()
    })

    it('stops authorizing a session once it is revoked', async () => {
        const { sessions } = fixture()
        const session = await sessions.establish(account(UserStatus.Active))
        await sessions.revoke(session.id)
        await expect(sessions.authorize(session.id)).resolves.toBeUndefined()
    })

    it('keeps concurrent sessions independent', async () => {
        const { sessions } = fixture()
        const first = await sessions.establish(account(UserStatus.Active))
        const second = await sessions.establish(account(UserStatus.Active))
        expect(first.id).not.toBe(second.id)
        await sessions.revoke(first.id)
        await expect(sessions.authorize(second.id)).resolves.toEqual(second)
    })

    it('expires a session thirty days after it was established, with no sliding extension', async () => {
        const { sessions, advance, store } = fixture()
        const session = await sessions.establish(account(UserStatus.Active))
        advance(SESSION_LIFETIME_SECONDS - 1)
        await expect(sessions.authorize(session.id)).resolves.toEqual(session)
        advance(1)
        await expect(sessions.authorize(session.id)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
    })

    it('revokes every session of one Account, optionally sparing one', async () => {
        const { sessions } = fixture()
        const kept = await sessions.establish(account(UserStatus.Active))
        const other = await sessions.establish(account(UserStatus.Active))
        const someoneElse = await sessions.establish(account(UserStatus.Active, 'account-2'))
        await sessions.revokeAll('account-1', { except: kept.id })
        await expect(sessions.authorize(kept.id)).resolves.toEqual(kept)
        await expect(sessions.authorize(other.id)).resolves.toBeUndefined()
        await expect(sessions.authorize(someoneElse.id)).resolves.toEqual(someoneElse)
        await sessions.revokeAll('account-1')
        await expect(sessions.authorize(kept.id)).resolves.toBeUndefined()
        await expect(sessions.authorize(someoneElse.id)).resolves.toEqual(someoneElse)
    })
})
