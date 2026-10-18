import { describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from './userService.js'
import { InvalidTimeZoneError } from './errors.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import type { StoredUser } from '../persistence/model/storedUser.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'

const user: User = {
    id: 'a',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

function fixture(existing: User = user) {
    const updateUser = vi.fn<UserStore['updateUser']>(async ({ fields, validator }) => {
        const stored: StoredUser = {
            ...existing,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt
        }
        if (validator?.(stored, fields) === UpdateValidationResult.Cancel) {
            return [existing, [], existing]
        }
        return [{ ...existing, ...fields }, Object.keys(fields), existing]
    })
    const store: UserStore = Object.create(null)
    store.updateUser = updateUser
    const service = new UserService(store, TokenService.prototype, LocalTaskService.prototype)
    return { service, updateUser }
}

describe('user time zone', () => {
    it('stores a known time zone', async () => {
        const { service, updateUser } = fixture()
        await expect(service.updateUserTimeZone('a', 'America/Chicago')).resolves.toEqual(
            expect.objectContaining({ timeZone: 'America/Chicago' })
        )
        expect(updateUser).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ userId: 'a', fields: { timeZone: 'America/Chicago' } })
        )
    })

    it('rejects an unknown time zone', async () => {
        const { service, updateUser } = fixture()
        await expect(service.updateUserTimeZone('a', 'Mars/Olympus_Mons')).rejects.toThrow(
            InvalidTimeZoneError
        )
        expect(updateUser).not.toHaveBeenCalled()
    })

    it('fills an empty time zone without replacing one already chosen', async () => {
        const empty = fixture()
        await expect(
            empty.service.updateUserTimeZone('a', 'America/Chicago', { onlyIfUnset: true })
        ).resolves.toEqual(expect.objectContaining({ timeZone: 'America/Chicago' }))

        const chosen = fixture({ ...user, timeZone: 'Europe/London' })
        await expect(
            chosen.service.updateUserTimeZone('a', 'America/Chicago', { onlyIfUnset: true })
        ).resolves.toEqual(expect.objectContaining({ timeZone: 'Europe/London' }))
        await expect(chosen.service.updateUserTimeZone('a', 'America/Chicago')).resolves.toEqual(
            expect.objectContaining({ timeZone: 'America/Chicago' })
        )
    })
})
