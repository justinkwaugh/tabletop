import { describe, expect, it } from 'vitest'
import { Role, withAssignedRoles } from './user.js'

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
