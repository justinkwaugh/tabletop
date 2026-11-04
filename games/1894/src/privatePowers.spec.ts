import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { cashOwnedBy } from '@tabletop/18xx'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'
import type { EighteenNinetyFourState } from './state.js'

/** The Belge owns the given privates as it builds track in phase 3. */
function belgeOwns(privateIds: readonly string[]) {
    return (state: EighteenNinetyFourState) => {
        for (const id of privateIds) {
            if (!state.companies.some((company) => company.id === id)) {
                state.companies.push({ id, kind: 'private' })
                state.certificates.push({
                    id: `${id}:charter`,
                    companyId: id,
                    kind: 'private',
                    owner: { kind: 'company', companyId: 'Belge' }
                })
            }
            const certificate = state.certificates.find((item) => item.id === `${id}:charter`)
            if (certificate) certificate.owner = { kind: 'company', companyId: 'Belge' }
        }
    }
}
const belgeCash = (state: EighteenNinetyFourState) =>
    cashOwnedBy(state, { kind: 'company', companyId: 'Belge' })

describe('Ligne de Reims à Charleville (§11.2.2.1)', () => {
    it('lays an extra yellow tile for F60 that cannot be upgraded the same round', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, belgeOwns(['LRC']))
        const before = belgeCash(play.state)
        play.act('LayPrivateTile', {
            privateCompanyId: 'LRC',
            companyId: 'Belge',
            locationId: 'D17',
            definitionId: '18xx:57',
            rotation: 0,
            nodeMapping: { city: 'city' },
            expectedCost: 60
        })
        expect(belgeCash(play.state)).toBe(Number(before) - 60)
        // Both ordinary track actions remain, but not on the tile just laid.
        expect(() =>
            play.act('LayTile', {
                companyId: 'Belge',
                locationId: 'D17',
                definitionId: '18xx:14',
                rotation: 0,
                nodeMapping: { city: 'city' },
                expectedCost: 0
            })
        ).toThrow()
        expect(() =>
            play.act('LayPrivateTile', {
                privateCompanyId: 'LRC',
                companyId: 'Belge',
                locationId: 'E18',
                definitionId: '18xx:9',
                rotation: 1,
                nodeMapping: {},
                expectedCost: 60
            })
        ).toThrow()
    })
})

describe('private lays keep 1894’s track limits (§7.3.3, §11.2.2.3)', () => {
    it('does not lay on a hex a player-owned private blocks', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            belgeOwns(['LRC'])(state)
            state.companies.push({ id: 'SAC', kind: 'private' })
            state.certificates.push({
                id: 'SAC:charter',
                companyId: 'SAC',
                kind: 'private',
                owner: { kind: 'player', playerId: state.players[2].playerId }
            })
        })
        expect(() =>
            play.act('LayPrivateTile', {
                privateCompanyId: 'LRC',
                companyId: 'Belge',
                locationId: 'D17',
                definitionId: '18xx:57',
                rotation: 0,
                nodeMapping: { city: 'city' },
                expectedCost: 60
            })
        ).toThrow()
    })

    it('does not upgrade the Liège tile it laid this round', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, belgeOwns(['GLG']))
        play.act('LayPrivateTile', {
            privateCompanyId: 'GLG',
            companyId: 'Belge',
            locationId: 'H17',
            definitionId: '18xx:57',
            rotation: 0,
            nodeMapping: { city: 'city' },
            expectedCost: 0
        })
        play.act('DeclinePrivateStation', { privateCompanyId: 'GLG' })
        expect(() =>
            play.act('LayPrivateTile', {
                privateCompanyId: 'GLG',
                companyId: 'Belge',
                locationId: 'H17',
                definitionId: '18xx:14',
                rotation: 2,
                nodeMapping: { city: 'city' },
                expectedCost: 0
            })
        ).toThrow()
    })
})

describe('Gare de Liège-Guillemins (§11.2.2.3)', () => {
    it('lays in Liège without a connection as a track action, then places a free station', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, belgeOwns(['GLG']))
        const before = belgeCash(play.state)
        play.act('LayPrivateTile', {
            privateCompanyId: 'GLG',
            companyId: 'Belge',
            locationId: 'H17',
            definitionId: '18xx:57',
            rotation: 0,
            nodeMapping: { city: 'city' },
            expectedCost: 0
        })
        expect(play.state.trackStep?.lays).toHaveLength(1)
        play.act('PlacePrivateStation', {
            privateCompanyId: 'GLG',
            position: { locationId: 'H17', nodeId: 'city', slot: 0 }
        })
        expect(belgeCash(play.state)).toBe(before)
        expect(
            play.state.stations.find(
                (station) => station.status === 'placed' && station.position.locationId === 'H17'
            )?.companyId
        ).toBe('Belge')
        expect(play.state.stationStep?.placedStationIds).toHaveLength(1)
    })
})

describe('London shipping (§11.2.2.6)', () => {
    it('places the owner’s cheapest station free in A12, apart from its placement', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            const ls = state.certificates.find((item) => item.id === 'LS:charter')
            if (ls) ls.owner = { kind: 'company', companyId: 'Belge' }
        })
        play.act('PlacePrivateToken', {
            privateCompanyId: 'LS',
            position: { locationId: 'A12', nodeId: 'city', slot: 0 }
        })
        const station = play.state.stations.find(
            (entry) => entry.status === 'placed' && entry.position.locationId === 'A12'
        )
        expect(station?.id).toBe('Belge:station:1')
        expect(play.state.usedPrivatePowerIds).toContain('LS')
        expect(play.state.stationStep?.placedStationIds ?? []).toHaveLength(0)
    })
})
