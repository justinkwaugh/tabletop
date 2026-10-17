import { describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import { UserService } from './userService.js'
import { InvalidTimeZoneError } from './errors.js'
import type { UserStore } from '../persistence/stores/userStore.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'

const user: User = {
    id: 'a',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

function fixture() {
    const updateUser = vi.fn<UserStore['updateUser']>(async ({ fields }) => [
        { ...user, ...fields },
        Object.keys(fields),
        user
    ])
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
        expect(updateUser).toHaveBeenCalledExactlyOnceWith({
            userId: 'a',
            fields: { timeZone: 'America/Chicago' }
        })
    })

    it('rejects an unknown time zone', async () => {
        const { service, updateUser } = fixture()
        await expect(service.updateUserTimeZone('a', 'Mars/Olympus_Mons')).rejects.toThrow(
            InvalidTimeZoneError
        )
        expect(updateUser).not.toHaveBeenCalled()
    })
})
