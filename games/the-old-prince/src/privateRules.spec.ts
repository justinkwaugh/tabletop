import { expect, it } from 'vitest'
import { assertExists, Prng } from '@tabletop/common'
import { createTheOldPrinceOpening } from './openingAuction.js'
import { theOldPrinceRole } from './companies.js'
import { TheOldPrinceNames } from './names.js'
import { TheOldPrincePrivateRules, unionBankStartingCompanyIds } from './privateRules.js'

function opening() {
    const players = ['a', 'b', 'c'].map((playerId) => ({ playerId, color: 'blue' as const }))
    const { position, titleState } = createTheOldPrinceOpening({
        players,
        prng: new Prng({ seed: 1, invocations: 0 }),
        config: {}
    })
    return { ...position, ...titleState, players: [], phaseId: '2H' }
}
function moveShare(state: ReturnType<typeof opening>, companyId: string, toUnionBank: boolean) {
    const share = state.certificates.find(
        (item) =>
            item.companyId === companyId &&
            item.kind === 'share' &&
            (toUnionBank ? item.poolId === 'market' : item.owner.kind === 'company')
    )
    if (!share) throw new Error(`Missing a ${companyId} share to move`)
    share.owner = toUnionBank ? { kind: 'company', companyId: 'UB' } : { kind: 'bank' }
    share.poolId = toUnionBank ? undefined : 'market'
}

it('records the railway drawn for Union Bank and names it after the Mainline', () => {
    const state = opening()
    const mainline = theOldPrinceRole(state, 'mainline')
    const drawn = state.unionBankDrawnCompanyId
    assertExists(drawn, 'The opening records the drawn railway')
    const held = state.certificates
        .filter((item) => item.owner.kind === 'company' && item.owner.companyId === 'UB')
        .map((item) => item.companyId)
    expect(held.toSorted()).toEqual([mainline, drawn].toSorted())
    expect(TheOldPrincePrivateRules.description(state, 'UB')).toMatch(
        `**Includes one share each of ${TheOldPrinceNames.company(mainline)} and ${TheOldPrinceNames.company(drawn)}.**\n\n`
    )
})

it('keeps naming the starting pair after Union Bank buys or sells shares', () => {
    const state = opening()
    const mainline = theOldPrinceRole(state, 'mainline')
    const drawn = state.unionBankDrawnCompanyId
    assertExists(drawn, 'The opening records the drawn railway')
    const other = state.companies.find(
        (company) => company.kind === 'major' && ![mainline, drawn, 'PEIR'].includes(company.id)
    )?.id
    assertExists(other, 'A third railway exists')
    moveShare(state, other, true)
    moveShare(state, drawn, false)
    expect(unionBankStartingCompanyIds(state)).toEqual([mainline, drawn])
})

it('falls back to the railway Union Bank holds in games set up before the draw was recorded', () => {
    const { unionBankDrawnCompanyId: drawn, ...state } = opening()
    expect(unionBankStartingCompanyIds(state)).toEqual([theOldPrinceRole(state, 'mainline'), drawn])
})
