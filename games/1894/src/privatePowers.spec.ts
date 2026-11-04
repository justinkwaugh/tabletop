import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { cashOwnedBy, privateOwner } from '@tabletop/18xx'
import { EighteenNinetyFourMap } from './map.js'
import { EighteenNinetyFourPrivateRules, privateIncome1894 } from './privateRules.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourTrainDepot } from './trains.js'
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

describe('Gare de Liège-Guillemins upgrades (§11.2.2.3)', () => {
    const yellowLiege = (state: EighteenNinetyFourState) => {
        belgeOwns(['GLG'])(state)
        state.tileInventory = EighteenNinetyFourTileSet.createInventory([
            { locationId: 'H17', definitionId: '18xx:57', rotation: 0 }
        ])
    }
    const upgrade = {
        privateCompanyId: 'GLG',
        companyId: 'Belge',
        locationId: 'H17',
        definitionId: '18xx:14',
        rotation: 2,
        nodeMapping: { city: 'city' },
        expectedCost: 0
    }

    it('upgrades a yellow tile, then offers the free station', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, yellowLiege)
        play.act('LayPrivateTile', upgrade)
        expect(play.valid(play.state.activePlayerIds[0])).toContain('PlacePrivateStation')
    })

    it('does not upgrade before phase 3 or once the track actions are spent', () => {
        const early = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            yellowLiege(state)
            state.phaseId = '2'
        })
        expect(() => early.act('LayPrivateTile', upgrade)).toThrow()
        const spent = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            yellowLiege(state)
            state.trackStep = {
                companyId: 'Belge',
                lays: [
                    { locationId: 'E18', definitionId: '18xx:9' },
                    { locationId: 'F17', definitionId: '18xx:9' }
                ],
                completed: false
            }
        })
        expect(() => spent.act('LayPrivateTile', upgrade)).toThrow()
    })
})

describe('private income (§11.2.2.2, §11.2.2.5)', () => {
    it('pays Antwerpen-Rotterdam more for a company', () => {
        const company = playExample(EighteenNinetyFourScenarios, 'construction', 3)
        expect(privateOwner(company.state, 'AR')?.kind).toBe('company')
        expect(privateIncome1894(company.state, 'AR')).toBe(10)
        const player = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            const charter = state.certificates.find((item) => item.id === 'AR:charter')
            if (charter) charter.owner = { kind: 'player', playerId: state.players[0].playerId }
        })
        expect(privateIncome1894(player.state, 'AR')).toBe(5)
    })

    it.each([
        [undefined, 0],
        ['18xx:57', 0],
        ['18xx:14', 70],
        ['1894:X16', 100]
    ])('pays Saint-Quentin à Guise by the tile on Saint-Quentin: %s', (definitionId, income) => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) => {
            if (definitionId)
                state.tileInventory = EighteenNinetyFourTileSet.createInventory([
                    { locationId: 'G10', definitionId, rotation: 0 }
                ])
        })
        expect(privateIncome1894(play.state, 'SQG')).toBe(income)
    })
})

describe('private block markers (§11.2.2)', () => {
    const blocking = (state: EighteenNinetyFourState, id: string) =>
        EighteenNinetyFourPrivateRules.blocking?.(state, id)

    it('marks the three blocking privates on the map', () => {
        expect([...EighteenNinetyFourMap.markedPrivateIds].sort()).toEqual(['GLG', 'LRC', 'SAC'])
    })

    it('lifts a block when a company owns the private, or when it is not in the game', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3)
        expect(blocking(play.state, 'LRC')).toBe(true)
        expect(blocking(play.state, 'GLG')).toBe(false)
        const owned = playExample(
            EighteenNinetyFourScenarios,
            'construction',
            3,
            belgeOwns(['LRC'])
        )
        expect(blocking(owned.state, 'LRC')).toBe(false)
    })
})

describe('private closures (§11.2.1)', () => {
    const buy = (position: 'phases' | 'diesel', definitionId: string, expectedPrice: number) => {
        const play = playExample(EighteenNinetyFourScenarios, position, 3, (state) => {
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => !(train.status === 'depot' && train.definitionId === '5+1')
            )
        })
        const train = EighteenNinetyFourTrainDepot.nextTrain(
            play.state.trainInventory,
            definitionId
        )
        play.act('BuyTrain', {
            companyId: 'Belge',
            trainId: train?.id,
            definitionId,
            expectedPrice
        })
        return play.state.companies.filter((company) => company.closed).map((company) => company.id)
    }

    it('closes the privates at phase 6, but not Saint-Quentin à Guise', () => {
        const closed = buy('phases', '6', 600)
        expect(closed).toEqual(expect.arrayContaining(['LRC', 'AR', 'LS']))
        expect(closed).not.toContain('SQG')
    })

    it('closes Saint-Quentin à Guise at phase D', () => {
        expect(buy('diesel', 'D', 800)).toContain('SQG')
    })
})
