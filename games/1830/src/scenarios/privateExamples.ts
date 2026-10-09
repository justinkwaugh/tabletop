import { EighteenThirtyPrivates } from '../index.js'
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
        const definition = EighteenThirtyPrivates.find((item) => item.id === id)
        assert(definition, 'Missing private definition')
        const { name, revenue } = definition
        state.companies.push({ id, name, kind: 'private', privateRevenue: revenue })
        state.certificates.push({
            id: `${id}:charter`,
            companyId: id,
            kind: 'private',
            retired: false,
            owner: { kind: 'player', playerId: players[playerIndex].playerId }
        })
    }
}
