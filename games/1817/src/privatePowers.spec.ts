import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    getCompany,
    locationMarkers,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenRouteRules,
    EighteenSeventeenTrackRules,
    EighteenSeventeenTrainDepot
} from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

const company = (companyId: string) => ({ kind: 'company' as const, companyId })

function givePrivate(state: EighteenXXState, privateId: string, companyId: string) {
    const certificate = state.certificates.find((item) => item.companyId === privateId)
    assertExists(certificate, 'The private is in play')
    certificate.owner = company(companyId)
    delete certificate.poolId
}

// Boston & Albany lays its first tile on B27, which brings its track beside the mountain B25.
function mineReady(privateId: string) {
    const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
        givePrivate(state, privateId, 'BA')
    )
    play.act('LayTile', {
        companyId: 'BA',
        locationId: 'B27',
        definitionId: '18xx:7',
        rotation: 0,
        nodeMapping: {},
        expectedCost: 20
    })
    return play
}

const mineLay = (privateCompanyId: string) => ({
    privateCompanyId,
    companyId: 'BA',
    locationId: 'B25',
    definitionId: '18xx:7',
    rotation: 4,
    nodeMapping: {},
    expectedCost: 20
})

describe('coal mines', () => {
    it('lay a mine as one of the company’s lays, free of the mountain cost', () => {
        const play = mineReady('MAJC')
        const cash = finiteCashOwnedBy(play.state, company('BA'))
        expect(play.valid('blair')).toContain('LayPrivateTile')
        play.act('LayPrivateTile', mineLay('MAJC'))
        // The second lay's $20, but no $15 for the mountain.
        expect(finiteCashOwnedBy(play.state, company('BA'))).toBe(cash - 20)
        expect(locationMarkers(play.state, { locationId: 'B25' })).toEqual([
            { locationId: 'B25', kind: 'mine', privateCompanyId: 'MAJC' }
        ])
        expect(getCompany(play.state, 'MAJC').closed).toBeUndefined()
        expect(
            EighteenSeventeenTrackRules.restriction(play.state, {
                companyId: 'PLE',
                locationId: 'B25',
                definitionId: '18xx:23',
                rotation: 0,
                nodeMapping: {}
            })
        ).toBe('Nobody may upgrade a mine.')
        expect(EighteenSeventeenRouteRules.hexBonus?.(play.state, 'B25')).toBe(10)
    })

    it('close once their lays are used', () => {
        const play = mineReady('MINC')
        play.act('LayPrivateTile', mineLay('MINC'))
        expect(getCompany(play.state, 'MINC').closed).toBe(true)
    })

    it('need a company to own them', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3)
        expect(play.valid('blair')).not.toContain('LayPrivateTile')
    })

    it('must face a city, town or offboard', () => {
        const play = mineReady('MAJC')
        expect(() => play.act('LayPrivateTile', { ...mineLay('MAJC'), rotation: 0 })).toThrow()
    })
})

describe('bridges', () => {
    it('are placed on the river cities, one per city, in the owner’s turn', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            givePrivate(state, 'UBC', 'BA')
        )
        expect(play.valid('blair')).toContain('PlacePrivateMarker')
        play.act('PlacePrivateMarker', { privateCompanyId: 'UBC', locationId: 'G6' })
        play.act('PlacePrivateMarker', { privateCompanyId: 'UBC', locationId: 'H3' })
        expect(play.valid('blair')).not.toContain('PlacePrivateMarker')
        expect(locationMarkers(play.state, { kind: 'bridge' }).map((m) => m.locationId)).toEqual([
            'G6',
            'H3'
        ])
        const train = EighteenSeventeenTrainDepot.trainDefinition('2')
        expect(
            EighteenSeventeenRouteRules.stopBonus?.(play.state, train, 'PLE', {
                locationId: 'G6',
                nodeId: 'city'
            })
        ).toBe(10)
    })

    it('make rivers, but not lakes, $10 cheaper for their company', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            givePrivate(state, 'OBC', 'BA')
        )
        const cost = (companyId: string, locationId: string, printed: number) =>
            EighteenSeventeenTrackRules.terrainCost?.(
                play.state,
                { companyId, locationId, definitionId: '18xx:7', rotation: 0, nodeMapping: {} },
                printed
            )
        expect(cost('BA', 'G4', 10)).toBe(0)
        expect(cost('PLE', 'G4', 10)).toBe(10)
        expect(cost('BA', 'D7', 20)).toBe(20)
    })
})

describe('Modern Trains', () => {
    it('pays 7- and 8-trains more at their company’s station cities when chosen', () => {
        const station = { locationId: 'C26', nodeId: 'city' }
        const eight = EighteenSeventeenTrainDepot.trainDefinition('8')
        const plain = playExample(EighteenSeventeenScenarios, 'construction', 3)
        expect(EighteenSeventeenRouteRules.stopBonus?.(plain.state, eight, 'BA', station)).toBe(0)
        const modern = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            Object.assign(state, { modernTrains: true })
        )
        expect(EighteenSeventeenRouteRules.stopBonus?.(modern.state, eight, 'BA', station)).toBe(20)
        expect(EighteenSeventeenRouteRules.stopBonus?.(modern.state, eight, 'PLE', station)).toBe(0)
    })
})
