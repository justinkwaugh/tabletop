import { Role, UserStatus, type User } from '@tabletop/common'
import { CompetitionError } from './tournamentError.js'

export function requireActiveAccount(user: User): void {
    if (user.status !== UserStatus.Active)
        throw new CompetitionError('An active account is required', 403)
}

export function requireAdministrator(user: User): void {
    requireActiveAccount(user)
    if (!user.roles.includes(Role.Admin))
        throw new CompetitionError('Administrator access is required', 403)
}

export function touchRevision(record: { revision: number; updatedAt: number }, now: number) {
    record.revision++
    record.updatedAt = now
}
