import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    RouteEvaluation,
    TrackConstruction,
    closePrivate,
    finiteCashOwnedBy,
    getCompany,
    presidentCertificate,
    presidentOf,
    sharesOwned,
    type TrainRoute
} from '@tabletop/18xx'
import { GorgeEastId, GorgeWestId, MapRoyalGorge, SulphurSpringsLocationId } from './map.js'
import { edit, givePrivate, kit, opened, setCash, type Table } from '../test/kit.js'
import {
    BridgeLeasePayers,
    bridgeLeaseOffered,
    bridgeLeaseOwed,
    bridgeLeasePayments,
    passesGorgeStations
} from './bridgeLease.js'
import {
    BridgeLeaseId,
    CfiId,
    CoalCreekId,
    CoalDepotId,
    GoldMinerId,
    JewelerId,
    PalmerId,
    PrivateCardsRoyalGorge,
    RgId,
    SfId,
    SteelDepotId,
    SulphurSpringsId,
    TrackEngineerId,
    VgcId
} from './companies.js'
import { DebtPenalties, debtCreditor, signTreaty } from './debt.js'
import { extendedDefinition, extensionChoices } from './extensions.js'
import { GoldDividends, goldShipmentLimit } from './gold.js'
import { EndingRulesRoyalGorge, TrainRulesRoyalGorge } from './operating.js'
import { requireStateRoyalGorge, type StateRoyalGorge } from './state.js'
import { CompanyRulesRoyalGorge, StockRulesRoyalGorge, gameRailroadIds } from './stock.js'
import { emptyClosedPrivates } from './privateHoldings.js'
import { RouteRulesRoyalGorge } from './routes.js'
import { TrackRulesRoyalGorge } from './track.js'
import { MarketRoyalGorge } from './stockMarket.js'
import {
    BrownGorgeTileIds,
    GreenGorgeTileIds,
    SulphurSpringsTileIds,
    TileSetRoyalGorge,
    mapStateRoyalGorge
} from './tiles.js'
import {
    BrownPhaseId,
    FourPlusId,
    GreenFourPhaseId,
    GreenPhaseId,
    SilverPhaseId,
    ThreePlusId,
    TrainDepotRoyalGorge,
    TreatyPhaseId,
    TwoPlusId,
    YellowPhaseId,
    phaseAfterDeparture,
    trainsExportedRoyalGorge
} from './trains.js'

const price = (state: StateRoyalGorge, companyId: string) =>
    MarketRoyalGorge.companySpace(state.stockMarket, companyId).price
const treasury = (game: Table, companyId: string) =>
    finiteCashOwnedBy(game.state, { kind: 'company', companyId })

/** Starts a railroad at the par and passes the rest of the stock round. */
function started(companyId = RgId, par = 80, players = 4, seed = 7): Table {
    const game = opened(players, seed)
    kit.launch(game, companyId, par)
    game.act('FinishStockTurn')
    kit.passStockRound(game)
    return game
}

describe('18RoyalGorge setup and auction', () => {
    it('plays Santa Fe, Rio Grande and three drawn railroads, by establishment year', () => {
        const railroadIds = gameRailroadIds(kit.table(4, 3).hydrated)
        expect(railroadIds).toHaveLength(5)
        expect(railroadIds).toContain(RgId)
        expect(railroadIds).toContain(SfId)
        const years = railroadIds.map(
            (id) =>
                ({
                    KP: 1869,
                    RG: 1870,
                    SPP: 1872,
                    PAV: 1875,
                    SF: 1876,
                    NO: 1881,
                    CM: 1883,
                    S: 1887,
                    FCC: 1893,
                    CSCC: 1897,
                    CS: 1898
                })[id] ?? 0
        )
        expect([...years].sort((a, b) => a - b)).toEqual(years)
    })

    it('starts steel and gold at $45, CF&I with $50, and the debt marker at $60 (Setup)', () => {
        const state = kit.table(4, 3).state
        expect(price(state, CfiId)).toBe(45)
        expect(price(state, VgcId)).toBe(45)
        expect(finiteCashOwnedBy(state, { kind: 'company', companyId: CfiId })).toBe(50)
        expect(MarketRoyalGorge.space(state.debtSpaceId).price).toBe(60)
    })

    it('deals two yellow, two green and one brown private, auctioned in that order (AU-1)', () => {
        const state = kit.table(4, 3).state
        const tiers = state.selectionAuction?.remainingLotIds.map(
            (id) => PrivateCardsRoyalGorge.find((card) => card.id === id)?.tier
        )
        expect(tiers).toEqual(['yellow', 'yellow', 'green', 'green', 'brown'])
    })

    it('removes only a card every player passes, and the winner opens the next (AU-2, AU-4)', () => {
        const game = kit.table(3, 3)
        const [first, second] = game.state.selectionAuction?.remainingLotIds ?? []
        for (let index = 0; index < 3; index++) game.act('PassSelectionAuction')
        expect(game.state.companies.find((company) => company.id === first)?.closed).toBe(true)
        expect(game.state.selectionAuction?.remainingLotIds[0]).toBe(second)
        const opener = game.player
        const card = PrivateCardsRoyalGorge.find((entry) => entry.id === second)
        game.act('NominateLot', { lotId: second, amount: card?.faceValue ?? 0 })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
        expect(game.player).toBe(opener)
    })

    it('keeps a player who passed out of that card’s bidding (AU-3)', () => {
        const game = kit.table(3, 3)
        const passer = game.player
        game.act('PassSelectionAuction')
        const lotId = game.state.selectionAuction?.remainingLotIds[0] ?? ''
        const card = PrivateCardsRoyalGorge.find((entry) => entry.id === lotId)
        game.act('NominateLot', { lotId, amount: card?.faceValue ?? 0 })
        expect(game.state.selectionAuction?.bidding?.auction.bidderIds ?? []).not.toContain(passer)
    })

    it('gives the most cash priority after the auction (AU-5)', () => {
        const game = opened(4, 3)
        const cash = (playerId: string) =>
            finiteCashOwnedBy(game.state, { kind: 'player', playerId })
        const most = Math.max(...game.state.players.map((player) => cash(player.playerId)))
        expect(cash(game.player)).toBe(most)
    })
})

describe('18RoyalGorge stock rounds', () => {
    it('counts every private toward the certificate limit, the Gold Miner too (SR-11)', () => {
        const game = opened()
        edit(game, (state) => givePrivate(state, GoldMinerId, { kind: 'player', playerId: 'p1' }))
        const state = game.hydrated
        for (const certificate of state.certificates.filter((entry) => entry.kind === 'private'))
            expect(StockRulesRoyalGorge.certificateWeight(state, certificate)).toBe(1)
    })

    it('allows no sales in the first stock round (SR-1)', () => {
        const game = opened(4, 7)
        kit.launch(game, RgId, 80)
        expect(
            StockRulesRoyalGorge.saleTerms(game.hydrated, RgId, 1, {
                kind: 'player',
                playerId: game.state.activePlayerIds[0]
            })
        ).toMatch(/first stock round/)
    })

    it('moves a railroad left a space for each share its president sells; not for others (SR-4)', () => {
        const game = opened(4, 7)
        const state = game.hydrated
        state.stockRound.number = 2
        kit.operated(state, RgId, 'p1', { price: 80, shares: 6 })
        const president = StockRulesRoyalGorge.saleTerms(state, RgId, 2, {
            kind: 'player',
            playerId: 'p1'
        })
        const other = StockRulesRoyalGorge.saleTerms(state, RgId, 1, {
            kind: 'player',
            playerId: 'p2'
        })
        expect(typeof president !== 'string' && president.movement).toBe(2)
        expect(typeof other !== 'string' && other.movement).toBe(0)
    })

    it('sells steel and gold back to the board, unmoved and without a pool limit (SR-5)', () => {
        const game = opened(4, 7)
        const state = game.hydrated
        state.stockRound.number = 2
        for (const certificate of state.certificates
            .filter((entry) => entry.companyId === CfiId)
            .slice(0, 6)) {
            certificate.owner = { kind: 'player', playerId: 'p1' }
            delete certificate.poolId
        }
        const terms = StockRulesRoyalGorge.saleTerms(state, CfiId, 6, {
            kind: 'player',
            playerId: 'p1'
        })
        expect(terms).toMatchObject({
            destinationPoolId: 'metal-board',
            marketLimit: 100,
            movement: 0
        })
    })

    it('lets a player buy steel and gold from the board, paying the bank, with no president (SR-6)', () => {
        const game = opened(4, 7)
        const buyer = game.player
        const certificate = game.state.certificates.find(
            (entry) => entry.companyId === VgcId && entry.poolId === 'metal-board'
        )
        game.act('BuyShares', {
            buyer: { kind: 'player', playerId: buyer },
            certificateId: certificate?.id,
            expectedPrice: 45
        })
        expect(sharesOwned(game.state, VgcId, { kind: 'player', playerId: buyer })).toBe(1)
        expect(presidentOf(game.state, VgcId)).toBeUndefined()
    })

    it('gives William Palmer’s buyer a Rio Grande and a CF&I share, Rio Grande paid nothing (Y4, SC-8)', () => {
        const game = kit.table(4, 7)
        edit(game, (state) => {
            const auction = state.selectionAuction
            if (!auction) throw new Error('No auction')
            state.companies.push({ id: PalmerId, kind: 'private' })
            state.certificates.push({
                id: `${PalmerId}:charter`,
                companyId: PalmerId,
                kind: 'private',
                owner: { kind: 'bank' }
            })
            auction.remainingLotIds = [PalmerId, ...auction.remainingLotIds]
        })
        const buyer = game.player
        game.act('NominateLot', { lotId: PalmerId, amount: 75 })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
        const owner = { kind: 'player' as const, playerId: buyer }
        expect(sharesOwned(game.state, RgId, owner)).toBe(1)
        expect(sharesOwned(game.state, CfiId, owner)).toBe(1)
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: RgId })).toBe(0)
    })
})

describe('18RoyalGorge track and steel', () => {
    it('buys each lay’s steel from CF&I, cheapest first in the one column of its colour (ST-1, ST-2)', () => {
        const game = started()
        expect(game.state.trackStep?.companyId).toBe(RgId)
        const before = finiteCashOwnedBy(game.state, { kind: 'company', companyId: CfiId })
        game.act('ChooseSteel', { companyId: RgId, color: 'yellow', column: 'B' })
        kit.lay(game, 'L4', '18xx:9', [0, 3])
        expect(game.state.steelMarket.B).toBe(3)
        kit.lay(game, 'K3', '18xx:4', [1, 4])
        expect(game.state.steelMarket.B).toBe(2)
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: CfiId })).toBe(
            before + 10
        )
        expect(game.state.steelMarket.A).toBe(4)
    })

    it('fixes a colour’s column once used for the turn (ST-2)', () => {
        const game = started()
        kit.lay(game, 'L4', '18xx:9', [0, 3])
        expect(game.valid()).toContain('LayTile')
        expect(() =>
            game.act('ChooseSteel', { companyId: RgId, color: 'yellow', column: 'C' })
        ).toThrow()
    })

    it('lays the brown gorge across all three hexes for one steel and one lay, as printed (RG-1)', () => {
        const game = started()
        edit(game, (state) => {
            signTreaty(state)
            state.phaseId = BrownPhaseId
        })
        const construction = new TrackConstruction(game.hydrated, TrackRulesRoyalGorge)
        for (const locationId of Object.keys(BrownGorgeTileIds))
            expect(construction.choices(locationId).map((choice) => choice.rotation)).toEqual([0])
        const [choice] = construction.choices('E13')
        const shown = mapStateRoyalGorge({ tileInventory: construction.inventoryAfter(choice) })
        const brown = (map: ReturnType<typeof mapStateRoyalGorge>) =>
            Object.keys(BrownGorgeTileIds).map((id) => map.tile(id).placement?.definitionId)
        expect(brown(shown)).toEqual(Object.values(BrownGorgeTileIds))
        const cfi = treasury(game, CfiId)
        kit.lay(game, 'E13', BrownGorgeTileIds.E13, [2, 4])
        expect(brown(mapStateRoyalGorge(game.state))).toEqual(Object.values(BrownGorgeTileIds))
        expect(game.state.trackStep?.lays).toHaveLength(1)
        expect(treasury(game, CfiId) - cfi).toBeGreaterThan(0)
        // Rio Grande's gorge stations stand on the brown cities as they stood on the green.
        expect(() => mapStateRoyalGorge(game.state).validateStations(game.state)).not.toThrow()
        expect(
            game.state.stations.filter(
                (station) =>
                    station.status === 'placed' &&
                    [GorgeWestId, GorgeEastId].includes(station.position.locationId)
            )
        ).toHaveLength(2)
    })

    it('lets any railroad lay the brown gorge, not only Rio Grande (RG-1)', () => {
        const game = started()
        edit(game, (state) => {
            signTreaty(state)
            state.phaseId = BrownPhaseId
        })
        for (const [locationId, definitionId] of Object.entries(BrownGorgeTileIds))
            for (const companyId of [RgId, SfId])
                expect(
                    TrackRulesRoyalGorge.restriction?.(game.hydrated, {
                        companyId,
                        locationId,
                        definitionId,
                        rotation: 0,
                        nodeMapping: {}
                    })
                ).toBeUndefined()
    })

    it('allows six lays or upgrades a turn (TR-2)', () => {
        const game = started()
        edit(game, (state) => {
            if (!state.trackStep) throw new Error('No track step')
            state.trackStep.lays = Array.from({ length: 6 }, (_, index) => ({
                locationId: `X${index}`
            }))
        })
        expect(TrackRulesRoyalGorge.allowance(game.hydrated, 'yellow', false)).toEqual({
            reason: '6 lays or upgrades are allowed per turn.'
        })
    })
})

describe('18RoyalGorge off-boards', () => {
    function lay(
        state: StateRoyalGorge,
        locationId: string,
        definitionId: string,
        rotation: 0 | 2 | 3
    ) {
        const [piece] = TileSetRoyalGorge.availablePieces(state.tileInventory, definitionId)
        state.tileInventory = TileSetRoyalGorge.replace(state.tileInventory, {
            locationId,
            placement: { pieceId: piece.id, definitionId, rotation },
            returnPrevious: false
        })
    }
    function placeStation(state: StateRoyalGorge, companyId: string, locationId: string) {
        const station = state.stations.find(
            (entry) => entry.companyId === companyId && entry.status !== 'placed'
        )
        assertExists(station, `${companyId} has no station left`)
        Object.assign(station, {
            status: 'placed',
            position: { locationId, nodeId: 'city', slot: 0 }
        })
    }
    /** Rio Grande with a 2+ and a station at Buena Vista, its yellow city facing Leadville. */
    function atBuenaVista(trackAtB4: string) {
        const state = started().hydrated
        lay(state, 'B4', trackAtB4, 0)
        lay(state, 'B6', '18xx:6', 3)
        placeStation(state, RgId, 'B6')
        const train = TrainDepotRoyalGorge.nextTrain(state.trainInventory, TwoPlusId)
        assertExists(train, 'No 2+ in the depot')
        TrainDepotRoyalGorge.purchase(state.trainInventory, train.id, train.definitionId, {
            kind: 'company',
            companyId: RgId
        })
        state.routeStep = { companyId: RgId }
        return { state, trainId: train.id }
    }
    const run = (state: StateRoyalGorge, route: TrainRoute) =>
        new RouteEvaluation(state, RouteRulesRoyalGorge).evaluateRoute(RgId, route)

    it('runs through a two-legged off-board city, unless another company holds it (TR-7)', () => {
        const { state, trainId } = atBuenaVista('18xx:9')
        lay(state, 'C3', '18xx:4', 2)
        const route: TrainRoute = {
            trainId,
            start: { locationId: 'C3', nodeId: 'town' },
            paths: [
                { locationId: 'C3', pathId: 'town-edge-0' },
                { locationId: 'B2', pathId: 'edge-5' },
                { locationId: 'B2', pathId: 'edge-0' },
                { locationId: 'B4', pathId: 'path-0' },
                { locationId: 'B6', pathId: 'edge-0' }
            ]
        }
        expect(run(state, route).result?.revenue).toBe(10 + 30 + 20)
        placeStation(state, SfId, 'B2')
        expect(run(state, route).reason).toBe(
            'The route cannot pass through a blocked city or offboard.'
        )
    })

    it('ends a route at a spike (TR-7)', () => {
        const { state, trainId } = atBuenaVista('18xx:8')
        expect(
            run(state, {
                trainId,
                start: { locationId: 'B6', nodeId: 'city' },
                paths: [
                    { locationId: 'B6', pathId: 'edge-0' },
                    { locationId: 'B4', pathId: 'path-0' },
                    { locationId: 'A3', pathId: 'edge-5' }
                ]
            }).result?.revenue
        ).toBe(20 + 30)
        for (const locationId of ['A3', 'O3', 'O17', 'C15'])
            expect(
                MapRoyalGorge.location(locationId).preprintedTile.nodes.map((node) => node.kind)
            ).toEqual(['offboard'])
    })
})

describe('18RoyalGorge deck', () => {
    const at = (counts: Record<string, number>, phaseId: string) => {
        const inventory = TrainDepotRoyalGorge.createInventory()
        for (const [definitionId, sold] of Object.entries(counts))
            for (let index = 0; index < sold; index++)
                TrainDepotRoyalGorge.export(inventory, definitionId)
        return { phaseId, trainInventory: inventory }
    }

    it('reveals each phase card as the train above it leaves (RT-6)', () => {
        expect(phaseAfterDeparture(at({ [TwoPlusId]: 2 }, YellowPhaseId), TwoPlusId)).toBe(
            YellowPhaseId
        )
        expect(phaseAfterDeparture(at({ [TwoPlusId]: 3 }, YellowPhaseId), TwoPlusId)).toBe(
            GreenPhaseId
        )
        expect(
            phaseAfterDeparture(at({ [TwoPlusId]: 4, [ThreePlusId]: 1 }, GreenPhaseId), ThreePlusId)
        ).toBe(TreatyPhaseId)
        expect(
            phaseAfterDeparture(at({ [TwoPlusId]: 4, [ThreePlusId]: 4 }, TreatyPhaseId), FourPlusId)
        ).toBe(GreenFourPhaseId)
        expect(
            phaseAfterDeparture(
                at({ [TwoPlusId]: 4, [ThreePlusId]: 4, [FourPlusId]: 2 }, GreenFourPhaseId),
                FourPlusId
            )
        ).toBe(BrownPhaseId)
    })

    it('exports every 2+ after the first set, then one train a set (RT-7)', () => {
        expect(
            trainsExportedRoyalGorge(at({ [TwoPlusId]: 1 }, YellowPhaseId).trainInventory)
        ).toEqual([TwoPlusId, TwoPlusId, TwoPlusId])
        expect(
            trainsExportedRoyalGorge(at({ [TwoPlusId]: 4 }, GreenPhaseId).trainInventory)
        ).toEqual([ThreePlusId])
    })

    it('lets a purchase that rusts the company’s own train exceed the limit (RT-4)', () => {
        const game = started()
        const state = game.hydrated
        kit.giveTrain(state, RgId, TwoPlusId)
        kit.giveTrain(state, RgId, ThreePlusId)
        for (let index = 0; index < 3; index++)
            TrainDepotRoyalGorge.export(state.trainInventory, TwoPlusId)
        for (let index = 0; index < 3; index++)
            TrainDepotRoyalGorge.export(state.trainInventory, ThreePlusId)
        state.phaseId = TreatyPhaseId
        expect(TrainRulesRoyalGorge.limitExemption?.(state, RgId, FourPlusId)).toBe(true)
        expect(TrainRulesRoyalGorge.limitExemption?.(state, SfId, FourPlusId)).toBe(false)
    })

    it('opens two, four and five gold spaces in Yellow, Green and Brown (GO-3)', () => {
        expect(goldShipmentLimit(YellowPhaseId)).toBe(2)
        expect(goldShipmentLimit(GreenPhaseId)).toBe(4)
        expect(goldShipmentLimit(BrownPhaseId)).toBe(5)
        expect(goldShipmentLimit(SilverPhaseId)).toBe(5)
        expect(GoldDividends).toEqual([50, 90, 140, 200, 270, 350])
    })
})

describe('18RoyalGorge Treaty of Boston and debt', () => {
    it('lays the green gorge, places two free Rio Grande stations and owes the debts (DB-1, DB-3)', () => {
        const game = started()
        const state = game.hydrated
        signTreaty(state)
        for (const [locationId, definitionId] of Object.entries(GreenGorgeTileIds))
            expect(
                new RailwayMapState(MapRoyalGorge, TileSetRoyalGorge, state.tileInventory).tile(
                    locationId
                ).placement?.definitionId
            ).toBe(definitionId)
        const gorge = state.stations.filter(
            (station) =>
                station.status === 'placed' && ['D12', 'F12'].includes(station.position.locationId)
        )
        expect(gorge.map((station) => station.companyId)).toEqual([RgId, RgId])
        expect(state.debts).toEqual({ [RgId]: 4, [SfId]: 2 })
    })

    it('pays Rio Grande’s debts to Santa Fe and Santa Fe’s to Doc Holliday’s owner or the bank (DB-3)', () => {
        const game = started()
        expect(debtCreditor(game.hydrated, RgId)).toEqual({ kind: 'company', companyId: SfId })
        expect(debtCreditor(game.hydrated, SfId).kind).toMatch(/bank|player/)
    })

    it('moves an unpaid debtor’s final price left by its charter’s number (DB-6)', () => {
        const game = started()
        const state = game.hydrated
        state.debts = { [RgId]: 1 }
        const share = state.certificates.find(
            (entry) => entry.companyId === RgId && entry.kind === 'share' && !entry.president
        )
        if (!share) throw new Error('No Rio Grande share')
        const value = EndingRulesRoyalGorge.certificateItems(state, share)[0].value
        const from = MarketRoyalGorge.companySpace(state.stockMarket, RgId)
        expect(value).toBe(MarketRoyalGorge.move(from.id, 'left', DebtPenalties[RgId][1]).price)
    })

    it('counts privates for nothing at the end (EG-5)', () => {
        const game = opened(4, 7)
        const certificate = game.state.certificates.find((entry) => entry.kind === 'private')
        if (!certificate) throw new Error('No private')
        expect(EndingRulesRoyalGorge.certificateItems(game.hydrated, certificate)[0].value).toBe(0)
    })
})

describe('18RoyalGorge private powers', () => {
    it('empties a closed private’s card, its steel, coal or money leaving the game (B3, Y3, G6, Y6)', () => {
        const game = started()
        edit(game, (state) => {
            for (const privateId of [SteelDepotId, CoalCreekId, CoalDepotId, JewelerId])
                givePrivate(state, privateId, { kind: 'player', playerId: 'p1' })
            Object.assign(state, {
                depotSteel: 3,
                coalCreekCubes: 1,
                coalCreekSupply: 9,
                coalDepotCubes: 2,
                jewelerCash: 15
            })
        })
        const state = requireStateRoyalGorge(game.hydrated)
        closePrivate(state, SteelDepotId)
        closePrivate(state, CoalDepotId)
        emptyClosedPrivates(state)
        expect([state.depotSteel, state.coalDepotCubes]).toEqual([0, 0])
        expect([state.coalCreekCubes, state.coalCreekSupply, state.jewelerCash]).toEqual([1, 9, 15])
        closePrivate(state, CoalCreekId)
        closePrivate(state, JewelerId)
        emptyClosedPrivates(state)
        expect([state.coalCreekCubes, state.coalCreekSupply, state.jewelerCash]).toEqual([0, 0, 0])
    })

    /** Rio Grande's track step with E3 a yellow town, Sulphur Springs given to the owner. */
    function sulphurTown(
        owner: { kind: 'player'; playerId: string } | { kind: 'company'; companyId: string }
    ) {
        const game = started()
        edit(game, (state) => {
            const [piece] = TileSetRoyalGorge.availablePieces(state.tileInventory, '18xx:3')
            state.tileInventory = TileSetRoyalGorge.replace(state.tileInventory, {
                locationId: SulphurSpringsLocationId,
                placement: { pieceId: piece.id, definitionId: '18xx:3', rotation: 0 },
                returnPrevious: false
            })
            givePrivate(state, SulphurSpringsId, owner)
        })
        return game
    }
    const sulphurCity = {
        companyId: RgId,
        locationId: SulphurSpringsLocationId,
        definitionId: SulphurSpringsTileIds.yellow,
        rotation: 0,
        nodeMapping: { town: 'city' }
    }

    it('turns Sulphur Springs into the city of its colour, free, closing the private (B2, TR-8)', () => {
        const game = sulphurTown({ kind: 'company', companyId: RgId })
        const before = treasury(game, RgId)
        expect(game.valid()).toContain('LayPrivateTile')
        game.act('LayPrivateTile', {
            ...sulphurCity,
            privateCompanyId: SulphurSpringsId,
            expectedCost: 0
        })
        expect(
            new RailwayMapState(MapRoyalGorge, TileSetRoyalGorge, game.state.tileInventory).tile(
                SulphurSpringsLocationId
            ).placement?.definitionId
        ).toBe(SulphurSpringsTileIds.yellow)
        expect(getCompany(game.state, SulphurSpringsId).closed).toBe(true)
        expect(treasury(game, RgId)).toBe(before)
    })

    it('lets no ordinary lay turn Sulphur Springs into a city (B2)', () => {
        const game = sulphurTown({ kind: 'player', playerId: 'p1' })
        const construction = new TrackConstruction(game.hydrated, {
            ...TrackRulesRoyalGorge,
            useful: () => true
        })
        expect(construction.evaluate(sulphurCity).details).toBeUndefined()
    })

    it('upgrades Sulphur Springs’s city to the next of its tiles like any city (B2)', () => {
        const game = sulphurTown({ kind: 'company', companyId: RgId })
        game.act('LayPrivateTile', {
            ...sulphurCity,
            privateCompanyId: SulphurSpringsId,
            expectedCost: 0
        })
        edit(game, (state) => {
            state.phaseId = GreenPhaseId
        })
        const construction = new TrackConstruction(game.hydrated, {
            ...TrackRulesRoyalGorge,
            useful: () => true
        })
        expect(
            construction.evaluate({
                ...sulphurCity,
                definitionId: SulphurSpringsTileIds.green,
                nodeMapping: { city: 'city' }
            }).details
        ).toBeDefined()
    })

    it('lets the Hanging Bridge lessee choose before running to pass the gorge’s stations, owing 10% of each train through it (G3)', () => {
        const game = started()
        const state = game.hydrated
        givePrivate(state, BridgeLeaseId, { kind: 'company', companyId: SfId })
        state.routeStep = { companyId: SfId }
        const gorgeCity = { locationId: 'D12', nodeId: 'city' }
        // No track crosses the gorge before the Treaty of Boston.
        expect(bridgeLeaseOffered(state, SfId)).toBe(false)
        state.phaseId = TreatyPhaseId
        expect(bridgeLeaseOffered(state, SfId)).toBe(true)
        expect(bridgeLeaseOffered(state, RgId)).toBe(false)
        expect(passesGorgeStations(state, SfId, gorgeCity)).toBe(false)
        state.bridgeLeaseInUse = true
        expect(bridgeLeaseOffered(state, SfId)).toBe(false)
        expect(passesGorgeStations(state, SfId, gorgeCity)).toBe(true)
        expect(passesGorgeStations(state, RgId, gorgeCity)).toBe(false)
        state.routeStep = {
            companyId: SfId,
            result: {
                companyId: SfId,
                revenue: 230,
                routes: [
                    {
                        trainId: 't1',
                        definitionId: '3+',
                        start: { locationId: 'D12', nodeId: 'city' },
                        paths: [{ locationId: 'E13', pathId: 'p' }],
                        visits: [],
                        payments: [],
                        distance: 3,
                        revenue: 170
                    },
                    {
                        trainId: 't2',
                        definitionId: '2+',
                        start: { locationId: 'C11', nodeId: 'city' },
                        paths: [{ locationId: 'D12', pathId: 'p' }],
                        visits: [],
                        payments: [],
                        distance: 2,
                        revenue: 60
                    }
                ]
            }
        }
        // Only the train past the gorge's middle ran through it; the other ended at its city.
        expect(bridgeLeaseOwed(state, SfId)).toBe(17)

        // After the payout the treasury or the president, as chosen, pays it whole.
        const president = { kind: 'player' as const, playerId: 'p2' }
        getCompany(state, SfId).started = true
        const certificate = presidentCertificate(state, SfId)
        assertExists(certificate, 'The Santa Fe has its president’s certificate')
        certificate.owner = president
        delete certificate.poolId
        const payers = () =>
            BridgeLeasePayers.filter((payer) => bridgeLeasePayments(state, SfId, payer))
        setCash(state, { kind: 'company', companyId: SfId }, 17)
        setCash(state, president, 17)
        expect(payers()).toEqual([])
        state.machineState = 'BuyingTrains'
        expect(payers()).toEqual(['company', 'president'])
        setCash(state, president, 16)
        expect(payers()).toEqual(['company'])
    })

    it('lengthens a train by the Track Engineer, and coal, not both on one train (B5, G6)', () => {
        const game = started()
        const state = game.hydrated
        const trainId = kit.giveTrain(state, RgId, TwoPlusId)
        givePrivate(state, TrackEngineerId, { kind: 'company', companyId: RgId })
        givePrivate(state, CoalDepotId, { kind: 'company', companyId: RgId })
        state.coalDepotCubes = 3
        state.routeStep = { companyId: RgId }
        expect(extensionChoices(state, RgId, trainId).map((choice) => choice.sourceId)).toEqual([
            TrackEngineerId,
            CoalDepotId,
            CoalDepotId
        ])
        state.trainExtensions = [{ trainId, sourceId: TrackEngineerId, stops: 1 }]
        expect(extensionChoices(state, RgId, trainId)).toEqual([])
        const train = state.trainInventory.trains.find((entry) => entry.id === trainId)
        if (!train) throw new Error('No train')
        expect(
            extendedDefinition(state, train, TrainDepotRoyalGorge.trainDefinition(TwoPlusId))
                .distance.maximum
        ).toBe(3)
    })
})

describe('18RoyalGorge end of the game', () => {
    it('ends after one more set when the first 6x2 is bought, after this one with the shorter game (EG-2, EG-4)', () => {
        const game = started()
        const state = game.hydrated
        state.trainEndTrigger = { setNumber: 3, byExport: false }
        expect(EndingRulesRoyalGorge.trigger(state)?.finalOperatingSet).toBe(4)
        state.shorterGame = true
        expect(EndingRulesRoyalGorge.trigger(state)?.finalOperatingSet).toBe(3)
        state.trainEndTrigger = { setNumber: 3, byExport: true }
        expect(EndingRulesRoyalGorge.trigger(state)?.finalOperatingSet).toBe(4)
    })

    it('ends after the current set when a railroad reaches the red spaces, before a train ending (EG-2)', () => {
        const game = started()
        const state = game.hydrated
        state.trainEndTrigger = { setNumber: 1, byExport: false }
        MarketRoyalGorge.placeMarker(
            state.stockMarket,
            RgId,
            MarketRoyalGorge.spaces.find((space) => space.price === 310)?.id ?? ''
        )
        expect(EndingRulesRoyalGorge.trigger(state)?.finalOperatingSet).toBe(
            state.operatingSet?.number
        )
    })
})

describe('18RoyalGorge stations', () => {
    it('places no station in a railroad’s first turn, its home already placed (SC-4)', () => {
        const game = started()
        // Castle Rock's town joins Denver's home to its open middle city, K1.
        edit(game, (state) => {
            const [piece] = TileSetRoyalGorge.availablePieces(state.tileInventory, '18xx:3')
            state.tileInventory = TileSetRoyalGorge.replace(state.tileInventory, {
                locationId: 'K3',
                placement: { pieceId: piece.id, definitionId: '18xx:3', rotation: 3 },
                returnPrevious: false
            })
        })
        game.act('FinishTrack', { companyId: RgId })
        expect(game.valid()).toEqual(['BuyTrain'])
        kit.buyTrain(game, TwoPlusId)
        game.act('FinishOperatingTurn', { companyId: RgId })
        game.act('FinishTrack', { companyId: RgId })
        expect(game.valid()).toContain('PlaceStation')
    })
})

describe('18RoyalGorge treasury', () => {
    it('pays twice the par into the railroad’s treasury as it starts (SC-2)', () => {
        const game = opened(4, 7)
        kit.launch(game, RgId, 70)
        expect(treasury(game, RgId)).toBe(140)
        expect(
            game.state.stations.some(
                (station) => station.companyId === RgId && station.status === 'placed'
            )
        ).toBe(true)
    })

    it('opens the brown-tranche railroad only in the Brown phase (SC-1)', () => {
        const state = requireStateRoyalGorge(opened(4, 7).hydrated)
        const brown = gameRailroadIds(state)[4]
        expect(CompanyRulesRoyalGorge.startMarketSpaces(state, brown)).toEqual([])
        state.phaseId = BrownPhaseId
        expect(CompanyRulesRoyalGorge.startMarketSpaces(state, brown).length).toBe(12)
    })
})
