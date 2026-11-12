import { describe, expect, it } from 'vitest'
import {
    accountStatusAfterCompletionCheck,
    canHoldAuthenticatedSession,
    isAbandonedSignUp,
    Role,
    UserStatus,
    isReservedUsername,
    receivesGameAndCompetitionEmail,
    wantsGameAndCompetitionEmails,
    withAssignedRoles
} from './user.js'

describe('withAssignedRoles', () => {
    it('keeps non-assignable roles and replaces the assignable ones', () => {
        expect(
            withAssignedRoles([Role.User, Role.Admin, Role.BetaTester], [Role.AlphaTester])
        ).toEqual([Role.User, Role.Admin, Role.AlphaTester])
    })

    it('clears every assignable role when none are requested', () => {
        expect(withAssignedRoles([Role.User, Role.Developer, Role.AlphaTester], [])).toEqual([
            Role.User
        ])
    })

    it('stores assignable roles in a stable order without duplicates', () => {
        expect(
            withAssignedRoles([Role.User], [Role.Developer, Role.AlphaTester, Role.Developer])
        ).toEqual([Role.User, Role.AlphaTester, Role.Developer])
    })
})

describe('canHoldAuthenticatedSession', () => {
    it('admits Active and Incomplete Accounts', () => {
        expect(canHoldAuthenticatedSession({ status: UserStatus.Active })).toBe(true)
        expect(canHoldAuthenticatedSession({ status: UserStatus.Incomplete })).toBe(true)
    })

    it('refuses Inactive and Deleted Accounts', () => {
        expect(canHoldAuthenticatedSession({ status: UserStatus.Inactive })).toBe(false)
        expect(canHoldAuthenticatedSession({ status: UserStatus.Deleted })).toBe(false)
    })
})

describe('accountStatusAfterCompletionCheck', () => {
    it('promotes an Incomplete Account that satisfies Account Completion', () => {
        expect(accountStatusAfterCompletionCheck(UserStatus.Incomplete, true)).toBe(
            UserStatus.Active
        )
        expect(accountStatusAfterCompletionCheck(UserStatus.Incomplete, false)).toBe(
            UserStatus.Incomplete
        )
    })

    it('keeps an Active Account Active only while it satisfies Account Completion', () => {
        expect(accountStatusAfterCompletionCheck(UserStatus.Active, true)).toBe(UserStatus.Active)
        expect(accountStatusAfterCompletionCheck(UserStatus.Active, false)).toBe(
            UserStatus.Incomplete
        )
    })

    it('never moves an Inactive or Deleted Account', () => {
        for (const satisfiesCompletion of [true, false]) {
            expect(
                accountStatusAfterCompletionCheck(UserStatus.Inactive, satisfiesCompletion)
            ).toBe(UserStatus.Inactive)
            expect(accountStatusAfterCompletionCheck(UserStatus.Deleted, satisfiesCompletion)).toBe(
                UserStatus.Deleted
            )
        }
    })
})

describe('game and competition emails', () => {
    const preferences = {
        preventWebNotificationPrompt: false,
        preferredColorsEnabled: false,
        preferredColors: []
    }
    const optedOut = { ...preferences, gameAndCompetitionEmails: false }

    it('sends them unless they were turned off', () => {
        expect(wantsGameAndCompetitionEmails(undefined)).toBe(true)
        expect(wantsGameAndCompetitionEmails(preferences)).toBe(true)
        expect(
            wantsGameAndCompetitionEmails({ ...preferences, gameAndCompetitionEmails: true })
        ).toBe(true)
        expect(wantsGameAndCompetitionEmails(optedOut)).toBe(false)
    })

    it('needs an email address as well', () => {
        expect(receivesGameAndCompetitionEmail({ email: 'a@example.test' })).toBe(true)
        expect(receivesGameAndCompetitionEmail({})).toBe(false)
        expect(
            receivesGameAndCompetitionEmail({ email: 'a@example.test', preferences: optedOut })
        ).toBe(false)
    })
})

describe('isReservedUsername', () => {
    it('reserves any username containing the word deleted, however it is spaced', () => {
        expect(isReservedUsername('Deleted player 3')).toBe(true)
        expect(isReservedUsername('Deleted\u00a0 player 1')).toBe(true)
        expect(isReservedUsername('the.dele ted_one')).toBe(true)
        expect(isReservedUsername('Delete')).toBe(false)
        expect(isReservedUsername('Alice')).toBe(false)
    })
})

describe('isAbandonedSignUp', () => {
    const now = new Date('2026-11-12T12:00:00Z')
    const createdAt = new Date('2026-11-09T12:00:00Z')

    it('is an Incomplete Account never activated, three days after it was created', () => {
        expect(isAbandonedSignUp({ status: UserStatus.Incomplete, createdAt }, now)).toBe(true)
        expect(
            isAbandonedSignUp(
                { status: UserStatus.Incomplete, createdAt: new Date(createdAt.getTime() + 1) },
                now
            )
        ).toBe(false)
    })

    it('never covers an Account that was Active, or is not Incomplete', () => {
        expect(
            isAbandonedSignUp(
                { status: UserStatus.Incomplete, createdAt, activatedAt: createdAt },
                now
            )
        ).toBe(false)
        for (const status of [UserStatus.Active, UserStatus.Inactive, UserStatus.Deleted]) {
            expect(isAbandonedSignUp({ status, createdAt }, now)).toBe(false)
        }
        expect(isAbandonedSignUp({ status: UserStatus.Incomplete }, now)).toBe(false)
    })
})
