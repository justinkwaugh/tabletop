import { canHoldAuthenticatedSession, type User } from '@tabletop/common'
import { AccountUnavailableError } from './errors.js'

export function requireSessionEligibleAccount(user: User): void {
    if (!canHoldAuthenticatedSession(user)) {
        throw new AccountUnavailableError(user.status)
    }
}
