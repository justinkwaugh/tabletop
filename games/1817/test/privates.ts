import type { EighteenXXState, Owner } from '@tabletop/18xx'

/** Brings a private the prepared positions leave out, such as Volatility's, into the game. */
export function addPrivate(state: EighteenXXState, privateId: string, owner: Owner) {
    state.companies.push({
        id: privateId,
        kind: 'private',
        privateRevenue: 0
    })
    state.certificates.push({
        id: `${privateId}:charter`,
        companyId: privateId,
        kind: 'private',
        owner
    })
}
