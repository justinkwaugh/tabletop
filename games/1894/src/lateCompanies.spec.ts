import { describe, expect, it } from 'vitest'
import { claimStartHome } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { Definition } from './definition/gameDefinition.js'
import { lateCompanyHomes } from './lateCompanies.js'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'

describe('late companies (§11.3.3)', () => {
    it('opens in phase 5+1 with a home its president chooses', () => {
        const yellow = playExample(EighteenNinetyFourScenarios, 'trading', 3)
        const buyer = { kind: 'player', playerId: yellow.state.activePlayerIds[0] }
        const start = {
            buyer,
            companyId: 'LF',
            marketSpaceId: '7:5',
            expectedPrice: 134,
            home: { locationId: 'B9', nodeId: 'city' }
        }
        expect(() => yellow.act('StartCompany', start)).toThrow()

        const brown = playExample(EighteenNinetyFourScenarios, 'trading', 3, (state) => {
            state.phaseId = '5+1'
        })
        const state = Definition.runtime.hydrator.hydrateState(structuredClone(brown.state))
        const homes = lateCompanyHomes(state, 'LF') ?? []
        // Untracked French cities only, and not Paris or Reims, which carry track.
        expect(homes.map((home) => home.locationId)).toContain('B9')
        expect(homes.map((home) => home.locationId)).not.toContain('I10')
        expect(lateCompanyHomes(state, 'LB')?.map((home) => home.locationId)).toContain('C14')
        expect(() =>
            brown.act('StartCompany', { ...start, home: { locationId: 'C14', nodeId: 'city' } })
        ).toThrow()
        brown.act('StartCompany', {
            ...start,
            buyer: { kind: 'player', playerId: brown.state.activePlayerIds[0] }
        })
        expect(brown.state.stationReservations).toContainEqual({
            companyId: 'LF',
            locationId: 'B9',
            nodeId: 'city'
        })
        expect(brown.state.stations.find((station) => station.id === 'LF:home')?.status).toBe(
            'available'
        )
    })

    it('offers the start when only companies choosing a home remain', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'trading', 3, (state) => {
            state.phaseId = '5+1'
            for (const company of state.companies)
                if (company.kind === 'major' && !company.started && !company.id.startsWith('L'))
                    company.closed = true
        })
        expect(play.valid(play.state.activePlayerIds[0])).toContain('StartCompany')
    })

    it('claims a split hex rather than a city while several of its cities are open', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'trading', 3, (state) => {
            state.phaseId = '5+1'
        })
        const state = Definition.runtime.hydrator.hydrateState(structuredClone(play.state))
        expect(
            lateCompanyHomes(state, 'LF')?.find((home) => home.locationId === 'B9')?.claims
        ).toBe('city')
        const home = {
            companyId: 'LF',
            stationId: 'LF:home',
            position: { locationId: 'I10', nodeId: 'city-0', slot: 0 },
            cost: 0
        }
        claimStartHome(state, home, 'hex')
        expect(state.hexReservations).toContainEqual({ companyId: 'LF', locationId: 'I10' })
    })
})
