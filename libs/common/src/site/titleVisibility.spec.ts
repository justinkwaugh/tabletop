import { describe, expect, it } from 'vitest'
import { GameVisibility } from '../game/definition/gameMetadata.js'
import { canDiscoverTitle, getTitleVisibility } from './titleVisibility.js'
import { Role, User, UserStatus } from './user.js'
import { Value } from 'typebox/value'

const metadata = {
    name: 'Test title',
    designer: '',
    description: '',
    year: '',
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayerCount: 3,
    version: '1',
    beta: false
}

describe('title catalog visibility', () => {
    it.each([
        { roles: [Role.User], alpha: false, beta: false },
        { roles: [Role.BetaTester], alpha: false, beta: true },
        { roles: [Role.AlphaTester], alpha: true, beta: false },
        { roles: [Role.AlphaTester, Role.BetaTester], alpha: true, beta: true },
        { roles: [Role.Admin], alpha: true, beta: true },
        { roles: [Role.Developer], alpha: false, beta: false }
    ])('respects independent grants for $roles', ({ roles, alpha, beta }) => {
        expect(canDiscoverTitle(metadata, roles)).toBe(true)
        expect(canDiscoverTitle({ ...metadata, beta: true }, roles)).toBe(beta)
        expect(
            canDiscoverTitle({ ...metadata, beta: true, visibility: GameVisibility.Alpha }, roles)
        ).toBe(alpha)
        expect(canDiscoverTitle({ ...metadata, visibility: GameVisibility.Alpha }, roles)).toBe(
            alpha
        )
    })

    it('prefers explicit visibility while supporting older beta metadata', () => {
        expect(getTitleVisibility(metadata)).toBe(GameVisibility.Public)
        expect(getTitleVisibility({ ...metadata, beta: true })).toBe(GameVisibility.Beta)
        expect(
            canDiscoverTitle({ ...metadata, beta: true, visibility: GameVisibility.Public }, [
                Role.User
            ])
        ).toBe(true)
    })

    it('accepts both existing accounts and the new alpha role', () => {
        for (const roles of [
            [Role.User, Role.BetaTester],
            [Role.User, Role.AlphaTester]
        ]) {
            expect(
                Value.Check(User, {
                    id: 'tester',
                    status: UserStatus.Active,
                    roles,
                    externalIds: []
                })
            ).toBe(true)
        }
    })
})
