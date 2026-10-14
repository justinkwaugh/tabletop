import { assert, type PlayerState } from '@tabletop/common'
import type { CompanyState } from '@tabletop/18xx'
import { EighteenThirtyTwoPrivates } from '../index.js'

export function prepareEighteenThirtyTwoPrivates(
    state: CompanyState,
    players: readonly PlayerState[]
): void {
    assert(players.length === 4, 'Private examples use four players')
    for (const [id, playerIndex] of [
        ['P4', 0],
        ['P7', 3],
        ['P1', 1],
        ['P3', 2]
    ] as const) {
        const definition = EighteenThirtyTwoPrivates.find((item) => item.id === id)
        assert(definition, 'Missing private definition')
        const { revenue } = definition
        state.companies.push({ id, kind: 'private', privateRevenue: revenue })
        state.certificates.push({
            id: `${id}:charter`,
            companyId: id,
            kind: 'private',
            owner: { kind: 'player', playerId: players[playerIndex].playerId }
        })
    }
}
