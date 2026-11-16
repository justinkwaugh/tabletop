import { describe, expect, it } from 'vitest'
import {
    finiteCashOwnedBy,
    getCompany,
    holdsAccessRight,
    privateOwner,
    privateTrackConstruction,
    purchaseChoices
} from '@tabletop/18xx'
import { buy, edit, finishStockRound, opened, start, toBuyingTrains } from '../test/kit.js'
import { BridgeId, ShippingId, WaterlooId } from './companies.js'
import { TrainRules1856, TransferRules1856 } from './operating.js'
import { PrivatePowerRules1856 } from './privatePowers.js'
import { AccessRightRules1856, BridgeRightId } from './rights.js'
import { KitchenerLocationId, Map1856 } from './map.js'
import { RouteRules1856 } from './routes.js'
import { PortMarkerKind } from './state.js'
import { StationRules1856 } from './stations.js'
import { TileSet1856 } from './tiles.js'
import { TrackRules1856 } from './track.js'
import { TrainDepot1856 } from './trains.js'

/** GT operating in phase 3, when companies may buy players' privates. */
function gtInPhaseThree() {
    const game = opened(4)
    start(game, 'GT', 100)
    buy(game, 'GT', 100, 2)
    edit(game, (state) => {
        state.phaseId = '3'
    })
    finishStockRound(game)
    return game
}

describe('1856 private companies (Private Companies)', () => {
    it('gives the company buying the bridge private its right', () => {
        const game = gtInPhaseThree()
        const playerId = game.player
        const choice = purchaseChoices(
            game.hydrated,
            playerId,
            TransferRules1856,
            TrainRules1856
        ).find(
            (entry) =>
                entry.request.asset.kind === 'private' &&
                entry.request.asset.privateCompanyId === BridgeId
        )
        if (!choice) throw new Error('GT may buy the bridge private')
        expect(choice.minimum).toBe(50)
        expect(choice.maximum).toBe(200)
        const seller = privateOwner(game.state, BridgeId)
        game.act('OfferPurchase', { ...choice.request, price: 100 })
        if (game.state.purchaseOffer && seller?.kind === 'player')
            game.act(
                'RespondToPurchaseOffer',
                { offerId: game.state.purchaseOffer.id, accept: true },
                seller.playerId
            )
        expect(privateOwner(game.state, BridgeId)).toEqual({ kind: 'company', companyId: 'GT' })
        expect(holdsAccessRight(game.state, 'GT', BridgeRightId)).toBe(true)
        // Each of its trains running to Buffalo earns $10 more.
        expect(
            RouteRules1856.stopBonus?.(
                game.hydrated,
                {
                    id: '2',
                    name: '2',
                    price: 100,
                    distance: { measure: 'revenue-centers', maximum: 2 }
                },
                'GT',
                { locationId: 'P17', nodeId: 'offboard' }
            )
        ).toBe(10)
    })

    it('sells the right only to a company that can reach Buffalo, never while a player owns the private', () => {
        const game = gtInPhaseThree()
        expect(
            AccessRightRules1856.purchaseTerms(game.hydrated, 'GT', BridgeRightId)
        ).toHaveProperty('reason')
    })

    it('places the port only in a city the company reaches, never a red area', () => {
        const game = gtInPhaseThree()
        edit(game, (state) => {
            const charter = state.certificates.find((entry) => entry.id === `${ShippingId}:charter`)
            if (!charter) throw new Error('No Great Lakes Shipping charter')
            charter.owner = { kind: 'company', companyId: 'GT' }
            delete charter.poolId
        })
        const terms = PrivatePowerRules1856.markerTerms?.(game.hydrated, ShippingId, game.player)
        expect(terms?.locationIds).not.toContain('H5')
        expect(terms?.locationIds).not.toContain('K2')
    })

    it('adds the port’s $20 only at the one small city of a pair it is placed on', () => {
        const game = gtInPhaseThree()
        const [first, second] = Map1856.location('E18').preprintedTile.nodes.filter(
            (node) => node.kind === 'town'
        )
        if (!first || !second) throw new Error('E18 has two small cities')
        edit(game, (state) => {
            state.port = { companyId: 'GT' }
            state.locationMarkers = [
                {
                    locationId: 'E18',
                    kind: PortMarkerKind,
                    privateCompanyId: ShippingId,
                    nodeId: first.id
                }
            ]
        })
        const bonus = (nodeId: string) =>
            RouteRules1856.stopBonus?.(game.hydrated, TrainDepot1856.trainDefinition('2'), 'GT', {
                locationId: 'E18',
                nodeId
            })
        expect(bonus(first.id)).toBe(20)
        expect(bonus(second.id)).toBe(0)
    })
})

describe('1856 Waterloo & Saugeen (Private Companies; designer)', () => {
    function gtOwningWaterloo() {
        const game = gtInPhaseThree()
        edit(game, (state) => {
            const charter = state.certificates.find((entry) => entry.id === `${WaterlooId}:charter`)
            if (!charter) throw new Error('No Waterloo & Saugeen charter')
            charter.owner = { kind: 'company', companyId: 'GT' }
            delete charter.poolId
        })
        expect(game.state.machineState).toBe('LayingTrack')
        return game
    }

    /** Plays on to the end of the operating round, every company passing. */
    function toRoundEnd(game: ReturnType<typeof opened>) {
        for (
            let guard = 0;
            guard < 40 && !game.actions.some((action) => action.type === 'CloseWaterloo');
            guard++
        ) {
            toBuyingTrains(game)
            const companyId = game.state.trainPurchaseStep?.companyId
            if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId })
            else if (game.valid().includes('FinishOperatingTurn'))
                game.act('FinishOperatingTurn', { companyId })
        }
    }

    it('lays #59 in a bare Kitchener without a route, in place of its own lay, and closes as the round ends', () => {
        const game = gtOwningWaterloo()
        const terms = PrivatePowerRules1856.trackTerms(game.hydrated, WaterlooId, game.player)
        if (!terms) throw new Error('GT may use the Waterloo & Saugeen')
        expect(terms.locationIds).toEqual([KitchenerLocationId])
        expect(terms.connected).toBe(false)
        const [choice] = privateTrackConstruction(game.hydrated, terms, TrackRules1856).choices(
            KitchenerLocationId
        )
        if (!choice) throw new Error('#59 fits Kitchener')
        game.act('LayPrivateTile', {
            privateCompanyId: WaterlooId,
            companyId: 'GT',
            locationId: KitchenerLocationId,
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        })
        const placed = game.state.tileInventory.placements[KitchenerLocationId]
        expect(
            TileSet1856.definitions.find((tile) => tile.id === placed?.definitionId)?.printedNumber
        ).toBe('59')
        // It took the place of the turn's lay.
        expect(game.valid()).not.toContain('LayTile')
        expect(getCompany(game.state, WaterlooId).closed).toBeFalsy()
        toRoundEnd(game)
        expect(getCompany(game.state, WaterlooId).closed).toBe(true)
    })

    it('places a free station in Kitchener in place of its own, only while one is left', () => {
        const game = gtOwningWaterloo()
        const terms = PrivatePowerRules1856.tokenTerms?.(game.hydrated, WaterlooId, game.player)
        const [position] = terms?.positions ?? []
        if (!position) throw new Error('GT may place the Waterloo & Saugeen station')
        expect(position.locationId).toBe(KitchenerLocationId)
        const cash = finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'GT' })
        game.act('PlacePrivateToken', { privateCompanyId: WaterlooId, position })
        expect(
            game.state.stations.some(
                (station) =>
                    station.companyId === 'GT' &&
                    station.status === 'placed' &&
                    station.position.locationId === KitchenerLocationId
            )
        ).toBe(true)
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'GT' })).toBe(cash)
        // The company places no station of its own that turn.
        expect(StationRules1856.placementLimit(game.hydrated, 'GT')).toBe(0)
        for (let guard = 0; guard < 5 && game.state.machineState === 'LayingTrack'; guard++)
            game.act('FinishTrack', { companyId: 'GT' })
        expect(game.valid()).not.toContain('PlaceStation')

        const spent = gtOwningWaterloo()
        edit(spent, (state) => {
            state.stations = state.stations.filter(
                (station) => station.companyId !== 'GT' || station.status === 'placed'
            )
        })
        expect(
            PrivatePowerRules1856.tokenTerms?.(spent.hydrated, WaterlooId, spent.player)
        ).toBeUndefined()
    })
})
