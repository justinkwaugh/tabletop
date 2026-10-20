import { assert, type PlayerState } from '@tabletop/common'
import type { CompanyState } from '@tabletop/18xx'
export function prepareShikoku1889Privates(
    state: CompanyState,
    players: readonly PlayerState[]
): void {
    assert(players.length === 4, 'Private examples include the four-player Uno-Takamatsu Ferry')
    for (const [id, playerIndex] of [
        ['DR', 0],
        ['UTF', 3],
        ['TE', 1],
        ['SRR', 2],
        ['PR', 2]
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
