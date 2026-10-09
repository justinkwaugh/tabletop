import {
    getCompany,
    certificatesOwnedBy,
    getTreasury,
    privateOwner,
    controllingOwner
} from '@tabletop/18xx'
import { expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { removeCertificates, validateFinances } from '@tabletop/18xx'
import { peirEntitlement, peirPresident, peirShares } from './index.js'
import { createTheOldPrinceFinanceExample } from './scenarios/index.js'
const players = [
    { playerId: 'alex', color: Color.Blue },
    { playerId: 'blair', color: Color.Red },
    { playerId: 'casey', color: Color.Green }
]

it('separates Union Bank ownership, Souris presidency and the controlling owner', () => {
    const state = createTheOldPrinceFinanceExample(players)
    validateFinances(
        state,
        players.map((player) => player.playerId)
    )
    const alex = { kind: 'player', playerId: 'alex' } as const
    expect(
        certificatesOwnedBy(state, alex).some((certificate) => certificate.id === 'UB:charter')
    ).toBe(true)
    expect(
        certificatesOwnedBy(state, alex).some((certificate) => certificate.id === 'So:president')
    ).toBe(false)
    expect(
        getTreasury(state, 'UB').portfolio.some((certificate) => certificate.id === 'So:president')
    ).toBe(true)
    expect(getCompany(state, 'UB').president).toBeUndefined()
    expect(privateOwner(state, 'UB')).toEqual(alex)
    expect(getCompany(state, 'So').president).toEqual({ kind: 'company', companyId: 'UB' })
    expect(controllingOwner(state, 'So')).toEqual(alex)
})

it('uses numbered shares for PEIR and derives entitlement and presidency from outstanding shares', () => {
    const state = createTheOldPrinceFinanceExample(players)
    validateFinances(
        state,
        players.map((player) => player.playerId)
    )
    const alex = { kind: 'player', playerId: 'alex' } as const
    expect(peirPresident(state)).toBe('blair')
    expect(peirEntitlement(state, alex)).toEqual({ owned: 1, outstanding: 5 })
    removeCertificates(state, ['PEIR:share:5'])
    expect(peirShares(state)).toHaveLength(4)
    expect(peirEntitlement(state, alex)).toEqual({ owned: 1, outstanding: 4 })
    expect(peirPresident(state)).toBe('casey')
    expect(getCompany(state, 'PEIR').lastIssuedNumber).toBe(5)
})
