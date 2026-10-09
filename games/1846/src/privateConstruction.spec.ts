import { describe, it, expect } from 'vitest'
import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    ConnectedTrack,
    RailwayMapState,
    privateTrackConstruction,
    finiteCashOwnedBy,
    type TrackRequest,
    type TrackLayDetails
} from '@tabletop/18xx'
import { stockGame, start } from './testSupport.js'
import { PrivateConstruction, type ConstructionPrivateId } from './privateConstruction.js'
import { chicagoPrivateStation } from './privateStation.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { EighteenFortySixMap } from './map.js'
import { TrackRules1846 } from './track.js'

function major() {
    const table = stockGame()
    table.launch('NYC', 100)
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    return table
}
function acquire(table: ReturnType<typeof major>, id: string) {
    if (!table.state.companies.some((company) => company.id === id)) {
        let full = start(5, 1).state
        for (let seed = 2; !full.companies.some((company) => company.id === id); seed++)
            full = start(5, seed).state
        const company = full.companies.find((company) => company.id === id)
        const certificate = full.certificates.find((certificate) => certificate.companyId === id)
        assertExists(company)
        assertExists(certificate)
        table.state.companies.push(structuredClone(company))
        table.state.certificates.push(structuredClone(certificate))
        table.state.removedPrivateIds = table.state.removedPrivateIds.filter(
            (privateId) => privateId !== id
        )
    }
    const certificate = table.state.certificates.find((certificate) => certificate.companyId === id)
    assert(certificate)
    certificate.owner = { kind: 'player', playerId: table.state.activePlayerIds[0] }
    table.act('OfferPurchase', {
        companyId: 'NYC',
        seller: certificate.owner,
        asset: { kind: 'private', privateCompanyId: id },
        price: 1
    })
}
function construction(table: ReturnType<typeof major>, id: ConstructionPrivateId) {
    return new PrivateConstruction(table.hydrated, table.state.activePlayerIds[0], id)
}
function request({
    companyId,
    locationId,
    definitionId,
    rotation,
    nodeMapping
}: TrackLayDetails): TrackRequest {
    return { companyId, locationId, definitionId, rotation, nodeMapping }
}
function pair(table: ReturnType<typeof major>, id: ConstructionPrivateId): TrackRequest[] {
    const builder = construction(table, id)
    for (const first of builder.choices([])) {
        const second = builder.choices([first])[0]
        if (second) return [request(first), request(second)]
    }
    throw Error('Expected a legal pair of private tiles')
}
function build(table: ReturnType<typeof major>, id: ConstructionPrivateId, lays: TrackRequest[]) {
    const plan = construction(table, id).evaluate(lays)
    assertExists(plan.lays, plan.reason)
    return table.act('BuildPrivateTrack', {
        privateCompanyId: id,
        lays,
        expectedCost: plan.lays.reduce((sum, lay) => sum + lay.cost, 0)
    })
}
function place(
    table: ReturnType<typeof major>,
    locationId: string,
    definitionId: string,
    rotation: TrackRequest['rotation'] = 0
) {
    const piece = EighteenFortySixTileSet.availablePieces(
        table.state.tileInventory,
        definitionId
    )[0]
    assertExists(piece)
    table.state.tileInventory = EighteenFortySixTileSet.replace(table.state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation },
        returnPrevious: true
    })
}

describe('1846 private construction', () => {
    it.each(['MC', 'O&I'] as const)(
        '%s lays a connected remote pair atomically, preserving ordinary allowances, replay and Undo',
        (id) => {
            const table = major()
            acquire(table, id)
            const before = structuredClone(table.state)
            const lays = pair(table, id)
            const result = build(table, id, lays)
            expect(table.state.machineState).toBe('LayingTrack')
            expect(table.state.usedPrivatePowerIds).toContain(id)
            expect(table.state.trackStep).toEqual(before.trackStep)
            expect(table.state.cash).toEqual(before.cash)
            expect(table.state.companies.find((company) => company.id === id)?.closed).not.toBe(
                true
            )
            expect(construction(table, id).choices([])).toEqual([])
            expect(result.processedActions[0].metadata).toMatchObject({
                lays: lays.map((lay) => ({ locationId: lay.locationId, cost: 0 })),
                cost: 0
            })
            let replay = before
            for (const action of result.processedActions)
                replay = table.engine.applyProcessedAction({
                    game: table.game,
                    state: replay,
                    action
                })
            expect(replay).toEqual(table.state)
            for (const action of result.processedActions.toReversed())
                replay = table.engine.undoProcessedAction({ state: replay, action })
            expect(replay).toEqual(before)
        }
    )
    it('forfeits the second lay after confirming only one MC tile', () => {
        const table = major()
        acquire(table, 'MC')
        const first = construction(table, 'MC').choices([])[0]
        assertExists(first)
        build(table, 'MC', [request(first)])
        expect(construction(table, 'MC').choices([])).toEqual([])
    })
    it('rejects wrong ownership, source, actor, price, hex reuse, phase and unrelated operating decisions', () => {
        const table = major()
        expect(construction(table, 'MC').choices([])).toEqual([])
        acquire(table, 'MC')
        const lays = pair(table, 'MC')
        for (const fields of [
            { source: ActionSource.System },
            { playerId: 'wrong' },
            { expectedCost: 1 },
            { lays: [lays[0], lays[0]] },
            { lays: [{ ...lays[0], companyId: 'MS' }] },
            { lays: [{ ...lays[0], locationId: 'E19' }] }
        ])
            expect(() =>
                table.act('BuildPrivateTrack', {
                    privateCompanyId: 'MC',
                    lays,
                    expectedCost: 0,
                    ...fields
                })
            ).toThrow()
        table.state.pendingRevenueMarker = { privateCompanyId: 'SC', companyId: 'NYC' }
        expect(construction(table, 'MC').choices([])).toEqual([])
        delete table.state.pendingRevenueMarker
        table.state.phaseId = 'III'
        expect(construction(table, 'MC').choices([])).toEqual([])
        table.state.phaseId = 'I'
        table.state.machineState = 'StockRound'
        expect(construction(table, 'MC').choices([])).toEqual([])
    })
    it('rejects a disconnected pair and leaves state untouched while evaluating drafts', () => {
        const table = major()
        acquire(table, 'MC')
        const builder = construction(table, 'MC')
        const firsts = builder.choices([])
        const bad = firsts
            .flatMap((first) =>
                firsts
                    .filter((second) => second.locationId !== first.locationId)
                    .map((second) => [request(first), request(second)])
            )
            .find((lays) => builder.evaluate(lays).reason)
        assertExists(bad)
        const before = structuredClone(table.state)
        expect(() =>
            table.act('BuildPrivateTrack', { privateCompanyId: 'MC', lays: bad, expectedCost: 0 })
        ).toThrow()
        expect(table.state).toEqual(before)
    })
    it('uses LSL only for one free green upgrade, independent of ordinary construction and network', () => {
        const table = major()
        acquire(table, 'LSL')
        place(table, 'D14', '18xx:5')
        expect(construction(table, 'LSL').choices([])).toEqual([])
        table.state.phaseId = 'II'
        const lay = construction(table, 'LSL').choices([])[0]
        assertExists(lay)
        expect(lay.locationId).toBe('D14')
        expect(lay.cost).toBe(0)
        build(table, 'LSL', [request(lay)])
        expect(construction(table, 'LSL').choices([])).toEqual([])
    })
    it('uses powers after routes without changing the recorded run or completed construction', () => {
        const table = major()
        acquire(table, 'O&I')
        table.act('FinishTrack', { companyId: 'NYC' })
        expect(table.state.machineState).toBe('BuyingTrains')
        const before = structuredClone(table.state)
        build(table, 'O&I', pair(table, 'O&I'))
        expect(table.state.routeStep).toEqual(before.routeStep)
        expect(table.state.earningsDistribution).toEqual(before.earningsDistribution)
        expect(table.state.trackStep).toEqual(before.trackStep)
        expect(table.state.stationStep).toEqual(before.stationStep)
    })
    it('refuses a free upgrade when no legal green tile remains in the supply', () => {
        const table = major()
        acquire(table, 'LSL')
        place(table, 'D14', '18xx:5')
        table.state.phaseId = 'II'
        expect(construction(table, 'LSL').choices([]).length).toBeGreaterThan(0)
        table.state.tileInventory.retiredPieceIds = EighteenFortySixTileSet.pieces
            .filter((piece) =>
                piece.faceDefinitionIds.some(
                    (id) =>
                        EighteenFortySixTileSet.definitions.find((tile) => tile.id === id)?.face
                            .color === 'green'
                )
            )
            .map((piece) => piece.id)
        expect(construction(table, 'LSL').choices([])).toEqual([])
    })
    it('rejects an LM upgrade whose new exits do not contribute to the connecting path', () => {
        const table = major()
        acquire(table, 'LM')
        const first = pair(table, 'LM')[0]
        place(table, first.locationId, first.definitionId, first.rotation)
        table.state.phaseId = 'II'
        const builder = construction(table, 'LM')
        // Every legal tile lay, before the power filters out lays that cannot complete it.
        const raw = privateTrackConstruction(
            table.hydrated,
            {
                companyId: 'NYC',
                locationIds: ['H12', 'G13'],
                definitionIds: EighteenFortySixTileSet.definitions
                    .filter((tile) => ['yellow', 'green'].includes(tile.face.color))
                    .map((tile) => tile.id),
                payer: { kind: 'company', companyId: 'NYC' },
                connected: false,
                terrainDiscount: 20
            },
            TrackRules1846
        )
        const upgrades = raw.choices(first.locationId)
        const others = raw.choices(first.locationId === 'H12' ? 'G13' : 'H12')
        const pointless = upgrades
            .flatMap((upgrade) => others.map((other) => [request(upgrade), request(other)]))
            .find((lays) => {
                const preview = builder.evaluate(lays, false)
                if (!preview.state) return false
                const map = new RailwayMapState(
                    EighteenFortySixMap,
                    EighteenFortySixTileSet,
                    preview.state.tileInventory
                )
                return (
                    new ConnectedTrack(map, [{ locationId: 'H12', nodeId: 'city' }]).reaches(
                        'G13',
                        { kind: 'node', nodeId: 'city' }
                    ) && builder.evaluate(lays).reason !== undefined
                )
            })
        assertExists(pointless)
        expect(builder.evaluate(pointless).reason).toContain('Each Little Miami tile')
        expect(
            builder
                .choices([pointless[0]])
                .some((lay) => JSON.stringify(request(lay)) === JSON.stringify(pointless[1]))
        ).toBe(false)
    })
    it('Little Miami creates a connection with new track on both tiles and cannot be reused once connected', () => {
        const table = major()
        acquire(table, 'LM')
        const lays = pair(table, 'LM')
        expect(construction(table, 'LM').evaluate([lays[0]]).reason).toBeDefined()
        build(table, 'LM', lays)
        expect(table.state.tileInventory.placements.H12).toBeDefined()
        expect(table.state.tileInventory.placements.G13).toBeDefined()
        table.state.usedPrivatePowerIds = []
        table.state.phaseId = 'II'
        expect(construction(table, 'LM').choices([])).toEqual([])
    })
    it('Little Miami offers only first tiles that a legal plan can complete', () => {
        const table = major()
        acquire(table, 'LM')
        const builder = construction(table, 'LM')
        const firsts = builder.choices([])
        expect(firsts.length).toBeGreaterThan(0)
        for (const first of firsts)
            expect(
                builder.evaluate([request(first)]).lays !== undefined ||
                    builder.choices([request(first)]).length > 0
            ).toBe(true)
    })
    it('Little Miami can use a single tile to complete a connection to existing track', () => {
        const table = major()
        acquire(table, 'LM')
        const lays = pair(table, 'LM')
        place(table, lays[0].locationId, lays[0].definitionId, lays[0].rotation)
        const plan = construction(table, 'LM').evaluate([lays[1]])
        expect(plan.reason).toBeUndefined()
        build(table, 'LM', [lays[1]])
    })
    it('Little Miami charges a newly completed Cincinnati bridge and refuses it without cash', () => {
        const table = major()
        acquire(table, 'LM')
        place(table, 'I11', '18xx:9', 0)
        const builder = construction(table, 'LM')
        const costly = builder
            .choices([])
            .flatMap((first) =>
                builder.choices([first]).map((second) => [request(first), request(second)])
            )
            .find((lays) => builder.evaluate(lays).lays?.some((lay) => lay.cost === 40))
        assertExists(costly)
        const cash = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })
        const treasury = table.state.cash.find(
            (balance) => balance.owner.kind === 'company' && balance.owner.companyId === 'NYC'
        )
        assertExists(treasury)
        treasury.amount = 39
        expect(construction(table, 'LM').evaluate(costly).reason).toBeDefined()
        treasury.amount = cash
        build(table, 'LM', costly)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })).toBe(
            cash - 40
        )
    })
    it('Tunnel Blasting discounts mountains but not water terrain or base construction', () => {
        const table = major()
        acquire(table, 'TBC')
        const rules = { ...TrackRules1846, useful: () => true }
        const builder = new TrackConstruction(table.hydrated, rules)
        expect(builder.choices('H16')[0]?.cost).toBe(20)
        expect(builder.choices('H14')[0]?.cost).toBe(40)
        expect(builder.choices('C13')[0]?.cost).toBe(20)
        expect(builder.choices('C15').length).toBe(0)
        table.state.phaseId = 'II'
        const detroit = new TrackConstruction(table.hydrated, rules)
            .choices('C15')
            .find((lay) => lay.definitionId === '1846:294' && lay.rotation === 0)
        expect(detroit?.cost).toBe(80)
    })
    it('C&WI adds one free extra token without consuming an existing token or the ordinary placement', () => {
        const table = major()
        acquire(table, 'C&WI')
        const before = structuredClone(table.state)
        const available = table.state.stations.filter(
            (station) => station.companyId === 'NYC' && station.status === 'available'
        ).length
        const result = table.act('PlaceCWIStation', { companyId: 'NYC' })
        expect(table.state.stations).toHaveLength(before.stations.length + 1)
        expect(
            table.state.stations.filter(
                (station) => station.companyId === 'NYC' && station.status === 'available'
            )
        ).toHaveLength(available)
        expect(table.state.stationStep).toEqual(before.stationStep)
        expect(table.state.cash).toEqual(before.cash)
        expect(result.processedActions[0].metadata).toMatchObject({
            companyId: 'NYC',
            cost: 0,
            position: { locationId: 'D6', nodeId: 'city-3' }
        })
        expect(
            chicagoPrivateStation(table.hydrated, table.state.activePlayerIds[0])
        ).toBeUndefined()
        let restored = table.state
        for (const action of result.processedActions.toReversed())
            restored = table.engine.undoProcessedAction({ state: restored, action })
        expect(restored).toEqual(before)
    })
    it('C&WI refuses occupied Chicago, another Chicago station, and the wrong corporation', () => {
        const table = major()
        acquire(table, 'C&WI')
        expect(() => table.act('PlaceCWIStation', { companyId: 'MS' })).toThrow()
        const home = table.state.stations.find(
            (station) => station.companyId === 'NYC' && station.status === 'placed'
        )
        assert(home?.status === 'placed')
        home.position = { locationId: 'D6', nodeId: 'city-0', slot: 0 }
        expect(
            chicagoPrivateStation(table.hydrated, table.state.activePlayerIds[0])
        ).toBeUndefined()
        home.position = { locationId: 'D20', nodeId: 'city', slot: 0 }
        table.state.stations.push({
            id: 'taken',
            companyId: 'MS',
            status: 'placed',
            position: { locationId: 'D6', nodeId: 'city-3', slot: 0 }
        })
        expect(
            chicagoPrivateStation(table.hydrated, table.state.activePlayerIds[0])
        ).toBeUndefined()
    })
})
