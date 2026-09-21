import { Shikoku1889Privates } from '@tabletop/shikoku-1889'
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
        const definition = Shikoku1889Privates.find((item) => item.id === id)
        assert(definition, 'Missing private definition')
        const { name, revenue } = definition
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
