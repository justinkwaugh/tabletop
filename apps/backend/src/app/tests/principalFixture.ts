import type { Principal, User } from '@tabletop/common'

type AuthorizedRequest = { user?: User; principal?: Principal }

// Stands in for the authorization plugin's guards: the request carries the Account and the
// Principal the guards would have derived from its session.
export function authorizedAs(principal: Principal) {
    return async (request: AuthorizedRequest) => {
        request.user = principal.user
        request.principal = principal
    }
}
