import { describe, expect, it } from 'vitest'
import { ActionSource, HexOrientation, assert, assertExists } from '@tabletop/common'
import {
    RailwayMap,
    RouteEvaluation,
    TileSet,
    createCityTileFace,
    privateOwner,
    purchaseChoices,
    placeStockMarker,
    TrackConstruction,
    type TrainRoute,
    type RouteRules
} from '@tabletop/18xx'
import { stockGame, finish } from './testSupport.js'
import { TransferRules1846 } from './acquisitions.js'
import { TrainDepot1846, TrainRules1846 } from './trains.js'
import { RouteRules1846 } from './routes.js'
import { EighteenFortySixStateDefinition } from './state.js'
import { TrackRules1846 } from './track.js'
import { revenueMarkerChoices, type RevenuePrivateId } from './revenueMarkers.js'

function major() {
    const table = stockGame()
    table.launch('NYC', 100)
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    return table
}
function buy(table: ReturnType<typeof major>, id: string) {
    const choice = purchaseChoices(
        table.hydrated,
        table.state.activePlayerIds[0],
        TransferRules1846,
        TrainRules1846
    ).find(
        ({ request }) => request.asset.kind === 'private' && request.asset.privateCompanyId === id
    )
    assertExists(choice)
    const actions = table.act('OfferPurchase', choice.request).processedActions
    if (table.state.purchaseOffer)
        actions.push(
            ...table.act('RespondToPurchaseOffer', {
                offerId: table.state.purchaseOffer.id,
                accept: true
            }).processedActions
        )
    return actions
}
function restorePrivate(table: ReturnType<typeof major>, privateId: RevenuePrivateId) {
    const full = finish(5, 7).state
    const company = full.companies.find((company) => company.id === privateId)
    const certificate = full.certificates.find((certificate) => certificate.companyId === privateId)
    assertExists(company)
    assert(certificate && !certificate.retired)
    table.state.companies.push(structuredClone(company))
    table.state.certificates.push({
        ...certificate,
        owner: { kind: 'player', playerId: table.state.activePlayerIds[0] }
    })
    table.state.removedPrivateIds = table.state.removedPrivateIds.filter((id) => id !== privateId)
}
function assign(
    table: ReturnType<typeof major>,
    privateCompanyId: RevenuePrivateId,
    locationId?: string
) {
    return table.act('AssignRevenueMarker', {
        privateCompanyId,
        ...(locationId ? { locationId } : {})
    })
}

describe('1846 revenue marker powers', () => {
    it('suspends a purchase for placement, blocks other actions, and replays and undoes the complete choice', () => {
        const table = major()
        table.state.steamboat = { companyId: 'MS', locationId: 'D14' }
        const before = structuredClone(table.state)
        const actions = buy(table, 'SC')
        expect(table.state.steamboat).toBeUndefined()
        expect(table.state.pendingRevenueMarker).toEqual({
            privateCompanyId: 'SC',
            companyId: 'NYC'
        })
        expect(
            table.engine.getValidActionTypesForPlayer(
                table.game,
                table.hydrated,
                table.state.activePlayerIds[0]
            )
        ).toEqual(['AssignRevenueMarker'])
        expect(() => table.act('FinishTrack', { companyId: 'NYC' })).toThrow()
        expect(
            purchaseChoices(
                table.hydrated,
                table.state.activePlayerIds[0],
                TransferRules1846,
                TrainRules1846
            )
        ).toEqual([])
        for (const fields of [
            { locationId: 'D6' },
            { privateCompanyId: 'MPC', locationId: 'D6' },
            { playerId: 'wrong' },
            { source: ActionSource.System }
        ])
            expect(() =>
                table.act('AssignRevenueMarker', {
                    privateCompanyId: 'SC',
                    locationId: 'B8',
                    ...fields
                })
            ).toThrow()
        actions.push(...assign(table, 'SC', 'B8').processedActions)
        expect(table.state.pendingRevenueMarker).toBeUndefined()
        expect(table.state.machineState).toBe('LayingTrack')
        expect(actions.at(-1)?.metadata).toMatchObject({
            companyId: 'NYC',
            skipped: false,
            marker: { privateCompanyId: 'SC', companyId: 'NYC', locationId: 'B8' }
        })
        const train = TrainDepot1846.trainDefinition('2')
        expect(
            RouteRules1846.stopBonus?.(table.hydrated, train, 'NYC', {
                locationId: 'B8',
                nodeId: 'offboard'
            })
        ).toBe(40)
        expect(
            RouteRules1846.stopBonus?.(table.hydrated, train, 'MS', {
                locationId: 'B8',
                nodeId: 'offboard'
            })
        ).toBe(0)
        let replay = before
        for (const action of actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('allows skipping purchase placement, then moving Steamboat once per OR before routes', () => {
        const table = major()
        buy(table, 'SC')
        assign(table, 'SC')
        expect(table.state.revenueMarkers).toEqual([])
        expect(() => assign(table, 'SC')).toThrow()
        assign(table, 'SC', 'B8')
        expect(() => assign(table, 'SC', 'D14')).toThrow()
        assertExists(table.state.operatingSet)
        table.state.operatingSet.roundNumber++
        const result = assign(table, 'SC', 'D14')
        expect(result.processedActions[0].metadata).toMatchObject({
            previous: { locationId: 'B8' },
            marker: { locationId: 'D14' }
        })
        expect(table.state.revenueMarkers).toHaveLength(1)
        table.state.operatingSet.number++
        table.state.machineState = 'BuyingTrains'
        expect(() => assign(table, 'SC', 'I1')).toThrow()
        expect(revenueMarkerChoices(table.hydrated, table.state.activePlayerIds[0])).toEqual([])
    })
    it.each([
        ['MPC', 'D6', 'I1', 30],
        ['BT', 'H12', 'D6', 20]
    ] as const)(
        'places %s permanently and keeps its private income',
        (id, locationId, other, value) => {
            const table = major()
            restorePrivate(table, id)
            buy(table, id)
            assign(table, id, locationId)
            const company = table.state.companies.find((company) => company.id === id)
            expect(company?.closed).not.toBe(true)
            expect(company?.privateRevenue).toBeGreaterThan(0)
            expect(
                RouteRules1846.stopBonus?.(
                    table.hydrated,
                    TrainDepot1846.trainDefinition('2'),
                    'NYC',
                    { locationId, nodeId: 'city' }
                )
            ).toBe(value)
            assertExists(table.state.operatingSet)
            table.state.operatingSet.roundNumber++
            expect(() => assign(table, id, other)).toThrow()
            expect(() => assign(table, id, locationId)).toThrow()
        }
    )
    it('offers placement when bought after routes without changing the recorded run or earnings', () => {
        const table = major()
        table.act('FinishTrack', { companyId: 'NYC' })
        expect(table.state.machineState).toBe('BuyingTrains')
        const run = structuredClone(table.state.routeStep)
        const earnings = structuredClone(table.state.earningsDistribution)
        buy(table, 'SC')
        expect(table.state.pendingRevenueMarker).toBeDefined()
        assign(table, 'SC', 'C5')
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.routeStep).toEqual(run)
        expect(table.state.earningsDistribution).toEqual(earnings)
    })
    it('removes the corporation’s markers on closure and records them for Undo', () => {
        const table = major()
        buy(table, 'SC')
        assign(table, 'SC', 'D14')
        const markers = structuredClone(table.state.revenueMarkers)
        const space = table.state.stockMarket.spaces.find((space) => space.price === 10)
        assertExists(space)
        placeStockMarker(table.state.stockMarket, 'NYC', space.id)
        const before = structuredClone(table.state)
        const result = table.act('FinishTrack', { companyId: 'NYC' })
        expect(table.state.revenueMarkers).toEqual([])
        expect(
            result.processedActions.find((action) => action.type === 'CloseCorporation')?.metadata
        ).toMatchObject({ removedRevenueMarkers: markers })
        let undone = table.state
        for (const action of result.processedActions.toReversed())
            undone = table.engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(before)
    })
})

function mailRun(finalTrain = false) {
    const table = major()
    buy(table, 'MAIL')
    const firstIds = ['C5', 'D6', 'D14', 'C15', ...(finalTrain ? ['E11', 'G7', 'G13'] : []), 'C17']
    const firstLength = firstIds.length
    const ids = [...firstIds, 'G9', 'H12']
    const amounts = [20, 40, 30, 50, ...(finalTrain ? [10, 20, 30] : []), 40, 40, 40]
    const faces = ids.map((_, i) =>
        createCityTileFace(
            'yellow',
            i === 0 || i === firstLength
                ? [0]
                : i === firstLength - 1 || i === ids.length - 1
                  ? [3]
                  : [3, 0],
            amounts[i],
            2
        )
    )
    const map = new RailwayMap({
        id: 'mail-routes',
        name: 'Mail routes',
        orientation: HexOrientation.Flat,
        locations: ids.map((id, i) => ({
            id,
            coordinates: i < firstLength ? { q: 0, r: i } : { q: 3, r: i - firstLength },
            preprintedTile: faces[i],
            buildable: false
        }))
    })
    const tileSet = new TileSet({ id: 'mail-tiles', entries: [] }, [])
    table.state.tileInventory = tileSet.createInventory()
    table.state.stationReservations = []
    table.state.stations = [1, firstLength].map((i) => ({
        id: `station:${i}`,
        companyId: 'NYC',
        status: 'placed',
        position: { locationId: ids[i], nodeId: 'city', slot: 0 }
    }))
    const routes = [
        {
            definitionId: finalTrain ? '7/8' : '3/5',
            indices: Array.from({ length: firstLength }, (_, i) => i)
        },
        { definitionId: finalTrain ? '5' : '2', indices: [firstLength, firstLength + 1] }
    ].map(({ definitionId, indices }): TrainRoute => {
        const train = TrainDepot1846.nextTrain(table.state.trainInventory, definitionId)
        assertExists(train)
        TrainDepot1846.purchase(table.state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: 'NYC'
        })
        return {
            trainId: train.id,
            start: { locationId: ids[indices[0]], nodeId: 'city' },
            paths: indices.flatMap((i) =>
                faces[i].paths.map((path) => ({ locationId: ids[i], pathId: path.id }))
            )
        }
    })
    table.state.phaseId = finalTrain ? 'IV' : 'II'
    table.state.machineState = 'RunningTrains'
    table.state.routeStep = { companyId: 'NYC' }
    const rules: RouteRules = { ...RouteRules1846, map, tileSet }
    const hydrated = () =>
        EighteenFortySixStateDefinition.hydrate(table.state, map, tileSet, TrainDepot1846)
    return { table, routes, rules, hydrated }
}
describe('1846 Mail Contract run scoring', () => {
    it('pays Mail on all eight 7/8 visits while counting seven stops and preserving East–West revenue', () => {
        const { table, routes, rules, hydrated } = mailRun(true)
        const result = new RouteEvaluation(hydrated(), rules).evaluate('NYC', routes).result
        assertExists(result)
        expect(result.routes[0].visits).toHaveLength(8)
        expect(result.routes[0].payments).toHaveLength(7)
        expect(result.routes[0].payments.some((payment) => payment.locationId === 'E11')).toBe(
            false
        )
        expect(result.routes[0].bonuses?.filter((bonus) => bonus.amount === 10)).toHaveLength(8)
        expect(result.routes[0].revenue).toBe(390)
        expect(result.revenue).toBe(470)
        const train = table.state.trainInventory.trains.find(
            (train) => train.id === routes[0].trainId
        )
        assertExists(train)
        train.definitionId = '6'
        expect(
            new RouteEvaluation(hydrated(), rules).evaluate('NYC', routes).result
        ).toBeUndefined()
    })

    it('records Mail revenue in a real run Action and reverses it exactly', () => {
        const table = major()
        buy(table, 'MAIL')
        const home = table.state.stations.find(
            (station) => station.companyId === 'NYC' && station.status === 'placed'
        )
        assert(home?.status === 'placed')
        home.position = { locationId: 'C15', nodeId: 'city', slot: 1 }
        const train = TrainDepot1846.nextTrain(table.state.trainInventory, '2')
        assertExists(train)
        TrainDepot1846.purchase(table.state.trainInventory, train.id, '2', {
            kind: 'company',
            companyId: 'NYC'
        })
        const lay = new TrackConstruction(table.hydrated, TrackRules1846).choices('B16')[0]
        assertExists(lay)
        table.act('LayTile', {
            companyId: lay.companyId,
            locationId: lay.locationId,
            definitionId: lay.definitionId,
            rotation: lay.rotation,
            nodeMapping: lay.nodeMapping,
            expectedCost: lay.cost
        })
        table.act('FinishTrack', { companyId: 'NYC' })
        const start = { locationId: 'C15', nodeId: 'city' }
        const first = { locationId: 'C15', pathId: 'edge-3' }
        const next = new RouteEvaluation(table.hydrated, RouteRules1846).network
            .extensions(start, [first])
            .find((path) => path.locationId === 'B16')
        assertExists(next)
        const before = structuredClone(table.state)
        const result = table.act('RunTrains', {
            companyId: 'NYC',
            routes: [{ trainId: train.id, start, paths: [first, next] }]
        })
        expect(result.processedActions[0].metadata).toMatchObject({
            revenue: 80,
            routes: [
                {
                    revenue: 80,
                    bonuses: [
                        { locationId: 'C15', amount: 10 },
                        { locationId: 'B16', amount: 10 }
                    ]
                }
            ]
        })
        expect(table.state.routeStep?.result?.revenue).toBe(80)
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('pays every visit on one longest train, including unpaid 3/5 stops, and preserves counted marker bonuses', () => {
        const { table, routes, rules, hydrated } = mailRun()
        table.state.revenueMarkers = [
            {
                privateCompanyId: 'MPC',
                companyId: 'NYC',
                locationId: 'D6',
                setNumber: 1,
                roundNumber: 1
            },
            {
                privateCompanyId: 'SC',
                companyId: 'NYC',
                locationId: 'D14',
                setNumber: 1,
                roundNumber: 1
            }
        ]
        const evaluation = new RouteEvaluation(hydrated(), rules)
        const result = evaluation.evaluate('NYC', routes).result
        assertExists(result)
        expect(result.routes[0].visits).toHaveLength(5)
        expect(result.routes[0].payments.map((p) => p.locationId)).toEqual(['C5', 'D6', 'C17'])
        expect(result.routes[0].revenue).toBe(260)
        expect(result.routes[1].revenue).toBe(80)
        expect(result.revenue).toBe(340)
        expect(result.routes[0].bonuses?.filter((b) => b.locationId === 'D14')).toEqual([
            { locationId: 'D14', amount: 10, label: 'Mail Contract' }
        ])
        expect(evaluation.evaluate('NYC', routes.toReversed()).result?.revenue).toBe(340)
        expect(evaluation.evaluate('NYC', [routes[1]]).result?.revenue).toBe(100)
        expect(evaluation.evaluate('NYC', []).result?.revenue).toBe(0)
        const shortFirst = { ...routes[0], paths: routes[0].paths.slice(0, 2) }
        const tied = evaluation.evaluate('NYC', [shortFirst, routes[1]]).result
        assertExists(tied)
        expect(
            tied.routes.filter((route) => route.bonuses?.some((bonus) => bonus.amount === 10))
        ).toHaveLength(1)
        expect(
            evaluation.evaluate('NYC', [routes[1], shortFirst]).result?.routes.toReversed()
        ).toEqual(tied.routes)
        const mail = table.state.certificates.find(
            (certificate) => certificate.companyId === 'MAIL'
        )
        assert(mail && !mail.retired)
        mail.owner = { kind: 'player', playerId: table.state.activePlayerIds[0] }
        expect(privateOwner(table.state, 'MAIL')?.kind).toBe('player')
        expect(new RouteEvaluation(hydrated(), rules).evaluate('NYC', routes).result?.revenue).toBe(
            290
        )
    })
})
