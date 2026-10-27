import type { Principal, User } from '@tabletop/common'
import type { AuthenticatedSession } from '@tabletop/backend-services'

type AuthorizedRequest = {
    user?: User
    principal?: Principal
    authenticatedSession?: AuthenticatedSession
}

// Stands in for the authorization plugin's guards: the request carries the Account, the
// Principal the guards would have derived from its session, and the session when given.
export function authorizedAs(principal: Principal, session?: AuthenticatedSession) {
    return async (request: AuthorizedRequest) => {
        request.user = principal.user
        request.principal = principal
        request.authenticatedSession = session
    }
}
