import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { Definition } from './definition/gameDefinition.js'
import { lateCompanyHomes } from './lateCompanies.js'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'

describe('late companies (§11.3.3)', () => {
    it('opens in the brown phase with a home its president chooses', () => {
        const yellow = playExample(EighteenNinetyFourScenarios, 'trading', 3)
        const buyer = { kind: 'player', playerId: yellow.state.activePlayerIds[0] }
        const start = {
            buyer,
            companyId: 'LF',
            marketSpaceId: '7:5',
            expectedPrice: 134,
            homeLocationId: 'B9'
        }
        expect(() => yellow.act('StartCompany', start)).toThrow()

        const brown = playExample(EighteenNinetyFourScenarios, 'trading', 3, (state) => {
            state.phaseId = 'brown'
        })
        const state = Definition.runtime.hydrator.hydrateState(structuredClone(brown.state))
        const homes = lateCompanyHomes(state, 'LF') ?? []
        // Untracked French cities only, and not Paris or Reims, which carry track.
        expect(homes.map((home) => home.locationId)).toContain('B9')
        expect(homes.map((home) => home.locationId)).not.toContain('I10')
        expect(lateCompanyHomes(state, 'LB')?.map((home) => home.locationId)).toContain('C14')
        expect(() => brown.act('StartCompany', { ...start, homeLocationId: 'C14' })).toThrow()
        brown.act('StartCompany', {
            ...start,
            buyer: { kind: 'player', playerId: brown.state.activePlayerIds[0] }
        })
        expect(brown.state.stationReservations).toContainEqual({
            companyId: 'LF',
            locationId: 'B9',
            nodeId: 'city'
        })
    })
})
