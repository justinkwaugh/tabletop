import { describe, expect, it } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { SessionService, SESSION_LIFETIME_SECONDS } from './sessionService.js'
import { MemorySessionStore } from '../persistence/memory/sessionStore.js'
import { AccountUnavailableError } from '../users/errors.js'
import {
    hasRecentAuthentication,
    RECENT_AUTHENTICATION_SECONDS,
    RecentAuthenticationRequiredError,
    SessionNotLiveError
} from './recentAuthentication.js'
import { AdministratorRequiredError } from './adminMode.js'

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
            const session = await sessions.establish(user, 'authentication-method')
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
            await expect(
                sessions.establish(account(status), 'authentication-method')
            ).rejects.toThrow(AccountUnavailableError)
        }
        expect(store.size).toBe(0)
    })

    it('does not authorize an unknown session id', async () => {
        const { authorize } = fixture()
        await expect(authorize('not-a-session')).resolves.toBeUndefined()
    })

    it('does not authorize a session whose Account no longer exists', async () => {
        const { sessions, authorize, forget } = fixture()
        const session = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        forget('account-1')
        await expect(authorize(session.id)).resolves.toBeUndefined()
    })

    it('stops authorizing a session once it is revoked', async () => {
        const { sessions, authorize } = fixture()
        const session = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        await sessions.revoke(session.id)
        await expect(authorize(session.id)).resolves.toBeUndefined()
    })

    it('keeps concurrent sessions independent', async () => {
        const { sessions, authorize } = fixture()
        const first = await sessions.establish(account(UserStatus.Active), 'authentication-method')
        const second = await sessions.establish(account(UserStatus.Active), 'authentication-method')
        expect(first.id).not.toBe(second.id)
        await sessions.revoke(first.id)
        await expect(authorize(second.id)).resolves.toMatchObject({ session: second })
    })

    it('expires a session thirty days after it was established, with no sliding extension', async () => {
        const { sessions, authorize, advance, store } = fixture()
        const session = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        advance(SESSION_LIFETIME_SECONDS - 1)
        await expect(authorize(session.id)).resolves.toMatchObject({ session })
        advance(1)
        await expect(authorize(session.id)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
    })

    it('revokes every session of one Account, optionally sparing one', async () => {
        const { sessions, authorize, register } = fixture()
        register(account(UserStatus.Active, 'account-2'))
        const kept = await sessions.establish(account(UserStatus.Active), 'authentication-method')
        const other = await sessions.establish(account(UserStatus.Active), 'authentication-method')
        const someoneElse = await sessions.establish(
            account(UserStatus.Active, 'account-2'),
            'authentication-method'
        )
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
        const session = await sessions.establish(user, 'authentication-method')
        expect(session.generation).toBe(3)
        await expect(authorize(session.id)).resolves.toEqual({ session, user })
    })

    it('stops authorizing every session once the Account generation advances, without any revocation call', async () => {
        const { sessions, authorize, register, store } = fixture()
        const before = account(UserStatus.Active)
        const copied = await sessions.establish(before, 'authentication-method')
        const own = await sessions.establish(before, 'authentication-method')
        register(account(UserStatus.Active, 'account-1', 1))
        await expect(authorize(copied.id)).resolves.toBeUndefined()
        await expect(authorize(own.id)).resolves.toBeUndefined()
        expect(store.size).toBe(0)
    })

    it('refuses a session established from a stale Account read after the generation advanced', async () => {
        const { sessions, authorize, register } = fixture()
        const staleRead = account(UserStatus.Active)
        const current = register(account(UserStatus.Active, 'account-1', 1))
        const raced = await sessions.establish(staleRead, 'authentication-method')
        const fresh = await sessions.establish(current, 'authentication-method')
        await expect(authorize(raced.id)).resolves.toBeUndefined()
        await expect(authorize(fresh.id)).resolves.toEqual({ session: fresh, user: current })
    })
})

describe('Recent Authentication on an Authenticated Session', () => {
    it('records proof through an Authentication Method at establishment but not a challenge', async () => {
        const { sessions } = fixture()
        const now = new Date('2026-10-27T12:00:00.000Z')
        const proved = await sessions.establish(account(UserStatus.Active), 'authentication-method')
        expect(proved.authenticatedAt).toEqual(proved.createdAt)
        expect(hasRecentAuthentication(proved, now)).toBe(true)
        const challenged = await sessions.establish(account(UserStatus.Active), 'challenge')
        expect(challenged.authenticatedAt).toBeUndefined()
        expect(hasRecentAuthentication(challenged, now)).toBe(false)
    })

    it('lasts fifteen minutes and is not refreshed by ordinary authorization', async () => {
        const { sessions, authorize, advance } = fixture()
        const session = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        const almost = advance(RECENT_AUTHENTICATION_SECONDS - 1)
        const authorized = await authorize(session.id)
        expect(authorized && hasRecentAuthentication(authorized.session, almost)).toBe(true)
        const lapsed = advance(1)
        const again = await authorize(session.id)
        expect(again && hasRecentAuthentication(again.session, lapsed)).toBe(false)
    })

    it('refreshes only authenticatedAt when proof is recorded again', async () => {
        const { sessions, store, advance } = fixture()
        const session = await sessions.establish(account(UserStatus.Active), 'challenge')
        const later = advance(60 * 60)
        const refreshed = await sessions.recordAuthentication(session)
        expect(refreshed.authenticatedAt).toEqual(later)
        expect(refreshed.expiresAt).toEqual(session.expiresAt)
        expect(refreshed.createdAt).toEqual(session.createdAt)
        expect(refreshed.generation).toBe(session.generation)
        await expect(store.find(session.id)).resolves.toEqual(refreshed)
        expect(hasRecentAuthentication(refreshed, later)).toBe(true)
    })

    it('never resurrects a revoked or expired session through reauthentication', async () => {
        const { sessions, store, advance } = fixture()
        const revoked = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        await sessions.revoke(revoked.id)
        await expect(sessions.recordAuthentication(revoked)).rejects.toBeInstanceOf(
            SessionNotLiveError
        )
        expect(store.size).toBe(0)
        const expired = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        advance(SESSION_LIFETIME_SECONDS)
        await expect(sessions.recordAuthentication(expired)).rejects.toBeInstanceOf(
            SessionNotLiveError
        )
        await expect(store.find(expired.id)).resolves.toMatchObject({
            authenticatedAt: expired.createdAt
        })
    })
})

describe('Admin Mode on an Authenticated Session', () => {
    const administrator = (status = UserStatus.Active): User => ({
        ...account(status),
        roles: [Role.User, Role.Admin]
    })

    it('is off for every new session, even an Administrator proved moments ago', async () => {
        const { sessions } = fixture()
        const session = await sessions.establish(administrator(), 'authentication-method')
        expect(session.adminModeExpiresAt).toBeUndefined()
        expect(sessions.isInAdminMode(session)).toBe(false)
    })

    it('activates for an Administrator with Recent Authentication until that proof lapses', async () => {
        const { sessions, store, advance } = fixture()
        const session = await sessions.establish(administrator(), 'authentication-method')
        advance(60)
        const activated = await sessions.activateAdminMode(session, administrator())
        expect(activated.adminModeExpiresAt).toEqual(
            new Date(session.createdAt.getTime() + RECENT_AUTHENTICATION_SECONDS * 1000)
        )
        expect(activated).toMatchObject({
            id: session.id,
            generation: session.generation,
            authenticatedAt: session.authenticatedAt,
            expiresAt: session.expiresAt
        })
        await expect(store.find(session.id)).resolves.toEqual(activated)
        expect(sessions.isInAdminMode(activated)).toBe(true)
        advance(RECENT_AUTHENTICATION_SECONDS - 60 - 1)
        expect(sessions.isInAdminMode(activated)).toBe(true)
        advance(1)
        expect(sessions.isInAdminMode(activated)).toBe(false)
    })

    it('refuses activation without Recent Authentication', async () => {
        const { sessions, store, advance } = fixture()
        const challenged = await sessions.establish(administrator(), 'challenge')
        await expect(
            sessions.activateAdminMode(challenged, administrator())
        ).rejects.toBeInstanceOf(RecentAuthenticationRequiredError)
        const stale = await sessions.establish(administrator(), 'authentication-method')
        advance(RECENT_AUTHENTICATION_SECONDS)
        await expect(sessions.activateAdminMode(stale, administrator())).rejects.toBeInstanceOf(
            RecentAuthenticationRequiredError
        )
        await expect(store.find(stale.id)).resolves.toEqual(stale)
    })

    it('refuses activation for an Account that is not an Administrator', async () => {
        const { sessions } = fixture()
        const session = await sessions.establish(
            account(UserStatus.Active),
            'authentication-method'
        )
        await expect(
            sessions.activateAdminMode(session, account(UserStatus.Active))
        ).rejects.toBeInstanceOf(AdministratorRequiredError)
        await expect(
            sessions.activateAdminMode(session, administrator(UserStatus.Incomplete))
        ).rejects.toBeInstanceOf(AdministratorRequiredError)
        await expect(
            sessions.activateAdminMode(session, { ...administrator(), id: 'account-2' })
        ).rejects.toBeInstanceOf(SessionNotLiveError)
    })

    it('never activates a revoked or expired session', async () => {
        const { sessions, store, advance } = fixture()
        const revoked = await sessions.establish(administrator(), 'authentication-method')
        await sessions.revoke(revoked.id)
        await expect(sessions.activateAdminMode(revoked, administrator())).rejects.toBeInstanceOf(
            SessionNotLiveError
        )
        expect(store.size).toBe(0)
        const expiring = await sessions.establish(
            { ...administrator(), id: 'account-1' },
            'authentication-method'
        )
        advance(SESSION_LIFETIME_SECONDS)
        await expect(sessions.activateAdminMode(expiring, administrator())).rejects.toBeInstanceOf(
            SessionNotLiveError
        )
    })

    it('does not revive an expired mode through reauthentication alone', async () => {
        const { sessions, advance } = fixture()
        const session = await sessions.establish(administrator(), 'authentication-method')
        const activated = await sessions.activateAdminMode(session, administrator())
        advance(RECENT_AUTHENTICATION_SECONDS)
        expect(sessions.isInAdminMode(activated)).toBe(false)
        const reproved = await sessions.recordAuthentication(activated)
        expect(reproved.adminModeExpiresAt).toEqual(activated.adminModeExpiresAt)
        expect(sessions.isInAdminMode(reproved)).toBe(false)
        const reactivated = await sessions.activateAdminMode(reproved, administrator())
        expect(sessions.isInAdminMode(reactivated)).toBe(true)
    })

    it('does not extend an active mode when proof is recorded again', async () => {
        const { sessions, advance } = fixture()
        const session = await sessions.establish(administrator(), 'authentication-method')
        const activated = await sessions.activateAdminMode(session, administrator())
        advance(RECENT_AUTHENTICATION_SECONDS - 10)
        const reproved = await sessions.recordAuthentication(activated)
        expect(reproved.adminModeExpiresAt).toEqual(activated.adminModeExpiresAt)
        const afterModeExpiry = advance(10)
        expect(hasRecentAuthentication(reproved, afterModeExpiry)).toBe(true)
        expect(sessions.isInAdminMode(reproved)).toBe(false)
    })

    it('ends with deactivation and is bounded by the session lifetime', async () => {
        const { sessions, store, advance } = fixture()
        const session = await sessions.establish(administrator(), 'authentication-method')
        const activated = await sessions.activateAdminMode(session, administrator())
        await sessions.deactivateAdminMode(activated)
        const deactivated = await store.find(session.id)
        expect(deactivated?.adminModeExpiresAt).toBeUndefined()
        expect(deactivated && sessions.isInAdminMode(deactivated)).toBe(false)
        advance(SESSION_LIFETIME_SECONDS - 60)
        const reproved = await sessions.recordAuthentication(activated)
        const lateActivation = await sessions.activateAdminMode(reproved, administrator())
        expect(lateActivation.adminModeExpiresAt).toEqual(session.expiresAt)
    })
})
