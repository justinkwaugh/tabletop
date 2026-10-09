import { describe, expect, it } from 'vitest'
import { TrackConstruction, applyStationPlacement, cashOwnedBy } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoRouteRules,
    EighteenThirtyTwoTileSet,
    EighteenThirtyTwoTrackRules,
    EighteenThirtyTwoTransferRules,
    canBuyCoalRights
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

// A CG station in Knoxville with track through O24 to the coal fields' western edge.
const ToCoalFields = [
    { locationId: 'P23', definitionId: '18xx:57', rotation: 0 },
    { locationId: 'O24', definitionId: '18xx:8', rotation: 4 }
] as const

function coalFieldsPlay(coalFieldsOwner: 'ACL' | 'player') {
    return playExample(EighteenThirtyTwoScenarios, 'construction', 3, (state) => {
        state.tileInventory = EighteenThirtyTwoTileSet.createInventory(ToCoalFields)
        applyStationPlacement(state, {
            companyId: 'CG',
            stationId: 'CG:station:1',
            position: { locationId: 'P23', nodeId: 'city', slot: 0 },
            cost: 0
        })
        const coalFields = state.certificates.find((item) => item.id === 'P5:charter')
        if (coalFields)
            coalFields.owner =
                coalFieldsOwner === 'ACL'
                    ? { kind: 'company', companyId: 'ACL' }
                    : { kind: 'player', playerId: 'casey' }
    })
}

describe('West Virginia Coal Fields', () => {
    it('sells a connected company a token for $80, half to the private’s owning company', () => {
        const play = coalFieldsPlay('ACL')
        expect(canBuyCoalRights(play.state, 'blair')).toBe(true)
        const coast = cashOwnedBy(play.state, { kind: 'company', companyId: 'ACL' })
        const central = cashOwnedBy(play.state, { kind: 'company', companyId: 'CG' })
        play.act('BuyCoalRights', { companyId: 'CG' })
        expect(play.state.coalRights).toEqual(['CG'])
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'ACL' })).toBe(
            Number(coast) + 40
        )
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'CG' })).toBe(
            Number(central) - 80
        )
        expect(play.state.trackStep?.lays).toEqual([])
        expect(play.state.coalPurchase).toEqual({ companyId: 'CG', turn: { set: 1, round: 1 } })
    })

    it('stays closed to every company while a player owns the private', () => {
        expect(canBuyCoalRights(coalFieldsPlay('player').state, 'blair')).toBe(false)
    })

    it('lets only token holders run there', () => {
        const play = coalFieldsPlay('ACL')
        const center = { locationId: 'O26', nodeId: 'town' }
        expect(EighteenThirtyTwoRouteRules.stopAllowed?.(play.state, 'CG', center)).toBe(false)
        play.act('BuyCoalRights', { companyId: 'CG' })
        expect(EighteenThirtyTwoRouteRules.stopAllowed?.(play.state, 'CG', center)).toBe(true)
        expect(EighteenThirtyTwoRouteRules.stopAllowed?.(play.state, 'ACL', center)).toBe(false)
    })

    it('gives the company buying the private a free token', () => {
        const play = coalFieldsPlay('player')
        const state = structuredClone(play.state)
        EighteenThirtyTwoTransferRules.afterPurchase(state, {
            id: 'offer',
            buyer: { kind: 'company', companyId: 'CG' },
            asset: { kind: 'private', privateCompanyId: 'P5' },
            seller: { kind: 'player', playerId: 'casey' },
            sellerPlayerId: 'casey',
            buyerPlayerId: 'blair',
            price: 80
        })
        expect(state.coalRights).toEqual(['CG'])
    })
})

describe('WVCF tokens and construction', () => {
    it('use one of the turn’s two yellow lays', () => {
        const play = coalFieldsPlay('ACL')
        play.act('BuyCoalRights', { companyId: 'CG' })
        const allowance = (color: string, upgrade: boolean) =>
            EighteenThirtyTwoTrackRules.allowance(play.state, color, upgrade)
        expect(allowance('yellow', false)).toEqual({ cost: 0 })
        expect(allowance('green', true)).toHaveProperty('reason')
        const laid = {
            ...play.state,
            trackStep: {
                companyId: 'CG',
                lays: [{ locationId: 'P21', color: 'yellow', cost: 0 }],
                completed: false
            }
        }
        expect(EighteenThirtyTwoTrackRules.allowance(laid, 'yellow', false)).toHaveProperty(
            'reason'
        )
    })

    it('cannot follow an upgrade', () => {
        const play = coalFieldsPlay('ACL')
        const upgraded = {
            ...play.state,
            trackStep: {
                companyId: 'CG',
                lays: [{ locationId: 'P23', color: 'green', cost: 0 }],
                completed: false
            }
        }
        expect(canBuyCoalRights(upgraded, 'blair')).toBe(false)
    })

    it('let only holders reach track beyond the coal fields', () => {
        const play = coalFieldsPlay('ACL')
        const beyond = () =>
            new TrackConstruction(play.state, EighteenThirtyTwoTrackRules).choices('O28')
        expect(beyond()).toEqual([])
        play.act('BuyCoalRights', { companyId: 'CG' })
        expect(beyond().length).toBeGreaterThan(0)
    })
})
