import { assert, type PlayerState } from '@tabletop/common'
import type { CompanyState } from '@tabletop/18xx'
export function prepareShikoku1889Privates(
    state: CompanyState,
    players: readonly PlayerState[]
): void {
    assert(players.length === 4, 'Private examples include the four-player Uno-Takamatsu Ferry')
    for (const [id, name, revenue, playerIndex] of [
        ['DR', 'Dôgo Railway', 15, 0],
        ['UTF', 'Uno-Takamatsu Ferry', 30, 3],
        ['TE', 'Takamatsu Electric Track', 5, 1],
        ['SRR', 'Sumitomo Besshi Mine Railroad', 15, 2],
        ['PR', 'Pilgrimage Railway', 20, 2]
    ] as const) {
        state.companies.push({ id, name, kind: 'private', privateRevenue: revenue })
        state.certificates.push({
            id: `${id}:charter`,
            companyId: id,
            kind: 'private',
            certificateLimitCount: 1,
            retired: false,
            owner: { kind: 'player', playerId: players[playerIndex].playerId }
        })
    }
}
