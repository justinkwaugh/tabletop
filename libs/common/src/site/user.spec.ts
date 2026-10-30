import { describe, expect, it } from 'vitest'
import {
    accountStatusAfterCompletionCheck,
    accountStatusAfterTransition,
    canHoldAuthenticatedSession,
    offeredAccountStatusTransition,
    Role,
    UserStatus,
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

describe('accountStatusAfterTransition', () => {
    it('deactivates an Active or Incomplete Account to Inactive', () => {
        expect(accountStatusAfterTransition(UserStatus.Active, 'deactivate', true)).toBe(
            UserStatus.Inactive
        )
        expect(accountStatusAfterTransition(UserStatus.Incomplete, 'deactivate', false)).toBe(
            UserStatus.Inactive
        )
    })

    it('leaves an Inactive Account Inactive when deactivated again', () => {
        expect(accountStatusAfterTransition(UserStatus.Inactive, 'deactivate', true)).toBe(
            UserStatus.Inactive
        )
    })

    it('reactivates to the status Account Completion decides', () => {
        expect(accountStatusAfterTransition(UserStatus.Inactive, 'reactivate', true)).toBe(
            UserStatus.Active
        )
        expect(accountStatusAfterTransition(UserStatus.Inactive, 'reactivate', false)).toBe(
            UserStatus.Incomplete
        )
    })

    it('refuses every transition of a Deleted Account', () => {
        expect(accountStatusAfterTransition(UserStatus.Deleted, 'deactivate', true)).toBeUndefined()
        expect(accountStatusAfterTransition(UserStatus.Deleted, 'reactivate', true)).toBeUndefined()
    })
})

describe('offeredAccountStatusTransition', () => {
    it('offers deactivation to Active and Incomplete, reactivation to Inactive, nothing to Deleted', () => {
        expect(offeredAccountStatusTransition(UserStatus.Active)).toBe('deactivate')
        expect(offeredAccountStatusTransition(UserStatus.Incomplete)).toBe('deactivate')
        expect(offeredAccountStatusTransition(UserStatus.Inactive)).toBe('reactivate')
        expect(offeredAccountStatusTransition(UserStatus.Deleted)).toBeUndefined()
    })
})
