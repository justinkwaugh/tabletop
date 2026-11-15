import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { beforeAll, expect, it } from 'vitest'
import { assertExists, Color, HexOrientation } from '@tabletop/common'
import { Autorouter, routeProblemKey } from '@tabletop/18xx-autorouter'
import {
    RouteEvaluation,
    applyStationPlacement,
    RailwayMap,
    TileSet,
    createCityTileFace,
    createOffboardTileFace,
    createStagedTileRevenue,
    type TrainRunningState
} from '@tabletop/18xx'
import { exhaustiveRevenue } from '@tabletop/18xx-autorouter/testing'
import { createShikoku1889CompanyExample } from './scenarios/index.js'
import { Shikoku1889RouteRules } from './index.js'
import { Shikoku1889TileSet, Shikoku1889TrainDepot } from './index.js'

let router: Autorouter
beforeAll(async () => {
    const bytes = await readFile(
        createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
    )
    router = await Autorouter.create(new Uint8Array(bytes).buffer)
})
const players = [
    { playerId: 'alex', color: Color.Blue },
    { playerId: 'blair', color: Color.Red },
    { playerId: 'casey', color: Color.Green }
]
it('solves the title map with its own rules for every train type', () => {
    for (const definition of Shikoku1889TrainDepot.definition.trains) {
        const state: TrainRunningState = {
            ...createShikoku1889CompanyExample(players, 'routes'),
            routeStep: { companyId: 'IR' }
        }
        state.phaseId = definition.id
        state.trainInventory = Shikoku1889TrainDepot.createInventory()
        const train = Shikoku1889TrainDepot.nextTrain(state.trainInventory, definition.id)
        assertExists(train, 'Expected a train in the depot')
        Shikoku1889TrainDepot.purchase(state.trainInventory, train.id, definition.id, {
            kind: 'company',
            companyId: 'IR'
        })
        const before = structuredClone(state)
        const result = router.solve(state, Shikoku1889RouteRules, 'IR')
        expect(result.exhaustive, definition.id).toBe(true)
        expect(result.result.revenue, definition.id).toBeGreaterThan(0)
        expect(result.result.revenue, definition.id).toBe(
            exhaustiveRevenue(state, Shikoku1889RouteRules, 'IR')
        )
        expect(
            new RouteEvaluation(state, Shikoku1889RouteRules).evaluate('IR', result.result.routes)
                .result
        ).toEqual(result.result)
        expect(state).toEqual(before)
    }
})
it('solves the prepared fleet without sharing track', () => {
    const state: TrainRunningState = {
        ...createShikoku1889CompanyExample(players, 'routes'),
        routeStep: { companyId: 'IR' }
    }
    const result = router.solve(state, Shikoku1889RouteRules, 'IR')
    expect(result.exhaustive).toBe(true)
    expect(result.result.revenue).toBe(exhaustiveRevenue(state, Shikoku1889RouteRules, 'IR'))
    expect(result.result.routes).toHaveLength(2)
})

it('reserves gray offboard values for diesels even during the diesel phase', () => {
    const tileSet = new TileSet({ id: 'diesel-values', entries: [] }, [])
    const rules = {
        ...Shikoku1889RouteRules,
        tileSet,
        map: new RailwayMap({
            id: 'diesel-values',
            name: 'Diesel values',
            orientation: HexOrientation.Flat,
            locations: [
                {
                    id: 'city',
                    coordinates: { q: 0, r: 0 },
                    buildable: true,
                    preprintedTile: createCityTileFace('yellow', [0], 20, 1)
                },
                {
                    id: 'offboard',
                    coordinates: { q: 0, r: 1 },
                    buildable: false,
                    preprintedTile: createOffboardTileFace(
                        [3],
                        createStagedTileRevenue([
                            ['yellow', 30],
                            ['brown', 50],
                            ['diesel', 90]
                        ])
                    )
                }
            ]
        })
    }
    for (const [definitionId, expected] of [
        ['6', 70],
        ['D', 110]
    ] as const) {
        const state: TrainRunningState = {
            ...createShikoku1889CompanyExample(players, 'routes'),
            phaseId: 'D',
            routeStep: { companyId: 'IR' },
            tileInventory: tileSet.createInventory(),
            stations: [
                {
                    id: 'home',
                    companyId: 'IR',
                    status: 'placed',
                    position: { locationId: 'city', nodeId: 'city', slot: 0 }
                }
            ],
            trainInventory: Shikoku1889TrainDepot.createInventory()
        }
        const train = Shikoku1889TrainDepot.nextTrain(state.trainInventory, definitionId)
        assertExists(train, 'Expected depot train')
        Shikoku1889TrainDepot.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: 'IR'
        })
        expect(router.solve(state, rules, 'IR').result.revenue).toBe(expected)
    }
})
it('keys a company’s run by what the solver reads, wherever its turn stands', () => {
    const state: TrainRunningState = createShikoku1889CompanyExample(players, 'operations')
    const key = routeProblemKey(state, Shikoku1889RouteRules, 'IR')
    expect(
        routeProblemKey({ ...state, routeStep: { companyId: 'IR' } }, Shikoku1889RouteRules, 'IR')
    ).toBe(key)
    expect(routeProblemKey(structuredClone(state), Shikoku1889RouteRules, 'IR')).toBe(key)
    expect(routeProblemKey(state, Shikoku1889RouteRules, 'AR')).not.toBe(key)
    const withoutTrain = structuredClone(state)
    withoutTrain.trainInventory.trains = withoutTrain.trainInventory.trains.filter(
        (train) => train.id !== 'shikoku-1889/2/1'
    )
    expect(routeProblemKey(withoutTrain, Shikoku1889RouteRules, 'IR')).not.toBe(key)
    const laterPhase = { ...structuredClone(state), phaseId: '5' }
    expect(routeProblemKey(laterPhase, Shikoku1889RouteRules, 'IR')).not.toBe(key)
})

it('keys only the track and stops the company can reach', () => {
    const state: TrainRunningState = createShikoku1889CompanyExample(players, 'operations')
    const key = routeProblemKey(state, Shikoku1889RouteRules, 'IR')
    const withTiles = (extra: { locationId: string; definitionId: string; rotation: number }[]) => {
        const next = structuredClone(state)
        next.tileInventory = Shikoku1889TileSet.createInventory([
            { locationId: 'E2', definitionId: '18xx:5', rotation: 4 },
            { locationId: 'F3', definitionId: '18xx:57', rotation: 2 },
            { locationId: 'G4', definitionId: '18xx:6', rotation: 0 },
            ...extra
        ])
        return next
    }
    expect(routeProblemKey(withTiles([]), Shikoku1889RouteRules, 'IR')).toBe(key)
    const farAway = withTiles([{ locationId: 'J11', definitionId: '18xx:9', rotation: 0 }])
    expect(routeProblemKey(farAway, Shikoku1889RouteRules, 'IR')).toBe(key)
    expect(routeProblemKey(farAway, Shikoku1889RouteRules, 'AR')).toBe(
        routeProblemKey(state, Shikoku1889RouteRules, 'AR')
    )
    const turned = structuredClone(state)
    turned.tileInventory = Shikoku1889TileSet.createInventory([
        { locationId: 'E2', definitionId: '18xx:5', rotation: 3 },
        { locationId: 'F3', definitionId: '18xx:57', rotation: 2 },
        { locationId: 'G4', definitionId: '18xx:6', rotation: 0 }
    ])
    expect(routeProblemKey(turned, Shikoku1889RouteRules, 'IR')).not.toBe(key)
    const blocked = structuredClone(state)
    applyStationPlacement(blocked, {
        companyId: 'IR',
        stationId: 'IR:station:1',
        position: { locationId: 'F3', nodeId: 'city', slot: 0 },
        cost: 0
    })
    expect(routeProblemKey(blocked, Shikoku1889RouteRules, 'AR')).not.toBe(
        routeProblemKey(state, Shikoku1889RouteRules, 'AR')
    )
})
