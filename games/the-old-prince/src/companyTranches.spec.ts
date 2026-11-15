import { expect, it } from 'vitest'
import { getCompany } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import {
    availableTheOldPrinceTranche,
    nextTheOldPrinceTranche,
    theOldPrinceCompanyRole,
    theOldPrinceRole
} from './index.js'
import { TheOldPrinceScenarios } from './scenarios/index.js'

it('holds Tranche 1 until the Mainline and Shortline have each operated or sold out', () => {
    const { state } = exampleGame(TheOldPrinceScenarios, 'opening', 3, 5)
    const mainline = theOldPrinceRole(state, 'mainline')
    const shortline = theOldPrinceRole(state, 'shortline')
    expect(nextTheOldPrinceTranche(state)).toMatchObject({
        tranche: { id: '1' },
        waitingCompanyIds: [mainline, shortline]
    })
    expect(availableTheOldPrinceTranche(state)).toBeUndefined()

    getCompany(state, mainline).operated = true
    expect(nextTheOldPrinceTranche(state)?.waitingCompanyIds).toEqual([shortline])

    for (const certificate of state.certificates) {
        if (certificate.kind === 'share' && certificate.companyId === shortline) {
            certificate.owner = { kind: 'player', playerId: state.players[0].playerId }
        }
    }
    expect(nextTheOldPrinceTranche(state)?.waitingCompanyIds).toEqual([])
    expect(availableTheOldPrinceTranche(state)?.id).toBe('1')
})

it('names the role of the Mainline and Shortline companies only', () => {
    const { state } = exampleGame(TheOldPrinceScenarios, 'opening', 3, 5)
    expect(theOldPrinceCompanyRole(state, theOldPrinceRole(state, 'mainline'))).toBe('mainline')
    expect(theOldPrinceCompanyRole(state, theOldPrinceRole(state, 'shortline'))).toBe('shortline')
    expect(theOldPrinceCompanyRole(state, 'PEIR')).toBeUndefined()
})
