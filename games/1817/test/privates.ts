import type { EighteenXXState, Owner } from '@tabletop/18xx'
import { EighteenSeventeenPrivateCatalog } from '../src/privates.js'

/** Brings a private the prepared positions leave out, such as Volatility's, into the game. */
export function addPrivate(state: EighteenXXState, privateId: string, owner: Owner) {
    const definition = EighteenSeventeenPrivateCatalog.definition(privateId)
    state.companies.push({
        id: privateId,
        name: definition.name,
        kind: 'private',
        privateRevenue: 0
    })
    state.certificates.push({
        id: `${privateId}:charter`,
        companyId: privateId,
        kind: 'private',
        retired: false,
        owner
    })
}
