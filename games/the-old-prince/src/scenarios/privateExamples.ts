import { TheOldPrincePrivates } from '../index.js'
import { assert, type PlayerState } from '@tabletop/common'
import { getCompany, type CompanyState } from '@tabletop/18xx'
export function prepareTheOldPrincePrivates(
    state: CompanyState,
    players: readonly PlayerState[]
): void {
    assert(players.length === 4, 'Private examples include the four-player Ice Boats')
    for (const [id, playerIndex] of [
        ['MC', 0],
        ['SB', 3],
        ['IB', 3],
        ['RA', 1],
        ['RF', 2],
        ['HS', 1],
        ['SBC', 2],
        ['MLC', 0],
        ['SLC', 1]
    ] as const) {
        const definition = TheOldPrincePrivates.find((privateCompany) => privateCompany.id === id)
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
    getCompany(state, 'ML').operated = false
    getCompany(state, 'So').operated = false
    getCompany(state, 'VR').privateRevenue = 5
    for (const id of ['So:share:6', 'So:share:7']) {
        const share = state.certificates.find((item) => item.id === id)
        assert(share && !share.retired, 'Private example requires reserved shares')
        share.owner = { kind: 'bank' }
        share.poolId = 'reserved'
    }
    const company = getCompany(state, 'A')
    Object.assign(company, {
        started: true,
        floated: true,
        funded: true,
        operated: true,
        parPrice: 80,
        president: { kind: 'player', playerId: players[3].playerId }
    })
    const president = state.certificates.find((item) => item.id === 'A:president')
    assert(president && !president.retired, 'Private example requires a president')
    president.owner = { kind: 'player', playerId: players[3].playerId }
    delete president.poolId
    state.tranches[1].companyIds.push('A')
}
