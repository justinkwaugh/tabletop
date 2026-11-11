import { assert, type PlayerState } from '@tabletop/common'
import type { CompanyState } from '@tabletop/18xx'
export function prepareEighteenThirtyPrivates(
    state: CompanyState,
    players: readonly PlayerState[]
): void {
    assert(players.length === 4, 'Private examples use four players')
    for (const [id, playerIndex] of [
        ['MH', 0],
        ['BOP', 3],
        ['SV', 1],
        ['CA', 2]
    ] as const) {
        state.companies.push({ id, kind: 'private' })
        state.certificates.push({
            id: `${id}:charter`,
            companyId: id,
            kind: 'private',
            owner: { kind: 'player', playerId: players[playerIndex].playerId }
        })
    }
}
