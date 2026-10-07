import { describe, expect, it } from 'vitest'
import {
    TrackConstruction,
    getCompany,
    rotateTileFace,
    tileUpgradeMappings,
    type TrackStep
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoEarningsRules,
    EighteenThirtyTwoTileSet,
    EighteenThirtyTwoTrackRules,
    EighteenThirtyTwoTrainRules,
    EighteenThirtyTwoTransferRules,
    EighteenThirtyTwoTileCatalog
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

function construction(
    placements: Parameters<typeof EighteenThirtyTwoTileSet.createInventory>[0],
    phaseId = '3'
) {
    const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
    expect(state.trackStep?.companyId).toBe('CG')
    return new TrackConstruction(
        { ...state, phaseId, tileInventory: EighteenThirtyTwoTileSet.createInventory(placements) },
        EighteenThirtyTwoTrackRules
    )
}

describe('track construction', () => {
    it('lays two yellow tiles or upgrades one tile', () => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
        const after = (lays: TrackStep['lays']) => ({
            ...state,
            trackStep: { companyId: 'CG', lays, completed: false }
        })
        const yellow = { locationId: 'T29', color: 'yellow', cost: 0 }
        const green = { locationId: 'U28', color: 'green', cost: 0 }
        expect(EighteenThirtyTwoTrackRules.allowance(after([]), 'green')).toEqual({ cost: 0 })
        expect(EighteenThirtyTwoTrackRules.allowance(after([yellow]), 'yellow')).toEqual({
            cost: 0
        })
        expect(EighteenThirtyTwoTrackRules.allowance(after([yellow]), 'green')).toHaveProperty(
            'reason'
        )
        expect(EighteenThirtyTwoTrackRules.allowance(after([green]), 'yellow')).toHaveProperty(
            'reason'
        )
        expect(
            EighteenThirtyTwoTrackRules.allowance(after([yellow, yellow]), 'yellow')
        ).toHaveProperty('reason')
    })

    it('waives terrain only for a company’s own home hex', () => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
        const cost = (companyId: string) =>
            EighteenThirtyTwoTrackRules.terrainCost?.(
                state,
                {
                    companyId,
                    locationId: 'U28',
                    definitionId: '18xx:57',
                    rotation: 0,
                    nodeMapping: {}
                },
                60
            )
        expect(cost('CG')).toBe(0)
        expect(cost('ACL')).toBe(60)
    })

    it('upgrades Savannah to its own brown tile only', () => {
        const track = construction(
            [{ locationId: 'U28', definitionId: '18xx:15', rotation: 0 }],
            '5'
        )
        expect(new Set(track.choices('U28').map((choice) => choice.definitionId))).toEqual(
            new Set(['1832:193'])
        )
    })

    it('upgrades Charleston to the Y tile and ordinary cities to #63', () => {
        const track = construction(
            [
                { locationId: 'U28', definitionId: '18xx:15', rotation: 0 },
                { locationId: 'T29', definitionId: '18xx:15', rotation: 0 }
            ],
            '5'
        )
        expect(new Set(track.choices('T29').map((choice) => choice.definitionId))).toEqual(
            new Set(['1832:611'])
        )
    })

    it('joins Atlanta’s three green cities into its brown city', () => {
        const green = EighteenThirtyTwoTileCatalog.get('1832:190').face
        const brown = EighteenThirtyTwoTileCatalog.get('1832:191').face
        expect(EighteenThirtyTwoTrackRules.preservesStops(green, brown)).toBe(true)
        expect(tileUpgradeMappings(rotateTileFace(green, 0), brown).length).toBeGreaterThan(0)
    })

    it('gives Tampa no brown upgrade', () => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
        const restriction = (definitionId: string) =>
            EighteenThirtyTwoTrackRules.restriction(state, {
                companyId: 'CG',
                locationId: 'Z25',
                definitionId,
                rotation: 0,
                nodeMapping: {}
            })
        expect(restriction('18xx:63')).toBe('Tampa has no brown upgrade')
        expect(restriction('18xx:14')).toBeUndefined()
    })
})

describe('dividends', () => {
    const { state } = exampleGame(EighteenThirtyTwoScenarios, 'routes', 3)

    it('rounds a half dividend up per share and keeps the rest', () => {
        expect(EighteenThirtyTwoEarningsRules.retainedRevenue(state, 'CG', 'half-pay', 130)).toBe(
            60
        )
        expect(EighteenThirtyTwoEarningsRules.retainedRevenue(state, 'CG', 'half-pay', 120)).toBe(
            60
        )
    })

    it('moves right for a full dividend, left for none and not at all for half', () => {
        const effect = (choice: 'pay' | 'withhold' | 'half-pay', retained: number) =>
            EighteenThirtyTwoEarningsRules.marketEffect(state, 'CG', {
                choice,
                revenue: 100,
                retained,
                baseDividendPerShare: (100 - retained) / 10
            }).move
        expect(effect('pay', 0)?.toMarketSpaceId).toBe('0:7')
        expect(effect('withhold', 100)?.toMarketSpaceId).toBe('0:5')
        expect(effect('half-pay', 50)).toBeUndefined()
    })

    it('pays initial-offering shares to the company and open-market shares to nobody', () => {
        const entitlements = EighteenThirtyTwoEarningsRules.entitlements(state, 'ACL')
        expect(entitlements).toContainEqual({
            owner: { kind: 'company', companyId: 'ACL' },
            shares: 4
        })
        expect(entitlements.some((entry) => entry.owner.kind === 'bank')).toBe(false)
        expect(entitlements.reduce((total, entry) => total + entry.shares, 0)).toBe(9)
    })
})

describe('private purchases and closures', () => {
    it('lets companies buy only the coal fields in phase 2, then most privates to phase 5', () => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'transfers', 4)
        const range = (privateCompanyId: string, phaseId: string) =>
            EighteenThirtyTwoTransferRules.priceRange({ ...state, phaseId }, 'CG', {
                kind: 'private',
                privateCompanyId
            })
        expect(range('P5', '2')).toEqual({ minimum: 40, maximum: 80 })
        expect(range('P2', '2')).toBeUndefined()
        expect(range('P2', '3')).toEqual({ minimum: 20, maximum: 80 })
        expect(range('P5', '4')).toEqual({ minimum: 40, maximum: 160 })
        expect(range('P4', '3')).toBeUndefined()
        expect(range('P7', '3')).toBeUndefined()
        expect(range('P2', '5')).toBeUndefined()
    })

    it('closes the Central Rail Road & Canal when the CoG buys a train', () => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'privates', 4)
        expect(getCompany(state, 'P7').closed).toBeFalsy()
        expect(EighteenThirtyTwoTrainRules.privatesClosedByPurchase?.(state, 'CG')).toEqual(['P7'])
        expect(EighteenThirtyTwoTrainRules.privatesClosedByPurchase?.(state, 'ACL')).toEqual([])
    })
})
