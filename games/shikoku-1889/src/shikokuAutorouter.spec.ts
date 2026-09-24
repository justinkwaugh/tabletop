import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { beforeAll, expect, it } from 'vitest'
import { assertExists, Color, HexOrientation } from '@tabletop/common'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    RouteEvaluation,
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
import { Shikoku1889TrainDepot } from './index.js'

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
