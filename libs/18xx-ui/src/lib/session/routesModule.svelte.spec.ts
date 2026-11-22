import { describe, expect, it } from 'vitest'
import { HexOrientation, assertExists } from '@tabletop/common'
import {
    RailwayMap,
    RouteEvaluation,
    TrainDepot,
    createCityTileFace,
    type RouteResult
} from '@tabletop/18xx'
import {
    TestCompanyId,
    TestHomeLocationId,
    TestOpenLocationId,
    minimalPlayState,
    minimalRouteRules,
    minimalTileSet
} from '@tabletop/18xx/testing'
import { RoutesModule, type RouteOverlay } from './routesModule.svelte.js'
import type { DrawnRunStandard } from './titlePresentation.js'
import { routeColor } from '../routes/routePresentation.js'
import { companyTrain, testSession } from './moduleTestSession.js'

const networkRoutes: RouteOverlay[] = [{ id: 'track-access', color: '#168da8', segments: [] }]

function running(machineState: 'RunningTrains' | 'StockRound', valid: string[], availability = {}) {
    const state = {
        ...minimalPlayState(),
        machineState,
        tileInventory: minimalTileSet.createInventory(),
        routeStep: { companyId: TestCompanyId }
    }
    const harness = testSession(state, { routeRules: minimalRouteRules }, valid, availability)
    const module = new RoutesModule(harness.session, () => networkRoutes)
    return { ...harness, state, module }
}

describe('RoutesModule', () => {
    it('can run only when the action is valid and the session is interactive', () => {
        expect(running('RunningTrains', ['RunTrains']).module.canRun).toBe(true)
        expect(running('RunningTrains', ['FinishTrack']).module.canRun).toBe(false)
        expect(running('RunningTrains', ['RunTrains'], { interactive: false }).module.canRun).toBe(
            false
        )
    })

    it('shows a route selection when the title permits running trains and selections are visible', () => {
        expect(running('RunningTrains', ['RunTrains']).module.editorVisible).toBe(true)
        expect(running('StockRound', []).module.editorVisible).toBe(false)
        expect(
            running('RunningTrains', ['RunTrains'], { selectionsVisible: false }).module
                .editorVisible
        ).toBe(false)
    })

    it('solves an empty run immediately for a company that owns no trains', () => {
        const { module } = running('RunningTrains', ['RunTrains'])
        expect(module.solved).toMatchObject({
            exhaustive: true,
            result: { routes: [], revenue: 0 }
        })
    })

    it('runs the solved routes as one action', async () => {
        const { module, applied } = running('RunningTrains', ['RunTrains'])
        await module.run()
        expect(applied).toMatchObject([{ type: 'RunTrains', companyId: TestCompanyId, routes: [] }])
    })

    it('ignores solved routes that were computed for a different state', () => {
        const { module, state } = running('RunningTrains', ['RunTrains'])
        const stale = { ...state }
        module.setSolved(stale, { companyId: TestCompanyId, routes: [], revenue: 0 }, false)
        expect(module.solved?.exhaustive).toBe(true)
    })

    it('refuses edits while routes are not active', () => {
        const { module } = running('RunningTrains', ['FinishTrack'])
        expect(() => module.selectTrain('t1')).toThrow('Routes cannot be drawn')
        expect(module.tap({ kind: 'hex', locationId: 'a' })).toBe(false)
    })

    it('holds a drawn run to the revenue of the best found, unless it pays the treasury more', async () => {
        const map = new RailwayMap({
            id: 'line',
            name: 'Line',
            orientation: HexOrientation.Flat,
            locations: [0, 1, 2, 3].map((r) => ({
                id: `a${r}`,
                coordinates: { q: 0, r },
                buildable: true,
                preprintedTile: createCityTileFace('green', [0, 3], 30, 1)
            }))
        })
        const depot = new TrainDepot({
            id: 'line-trains',
            trains: [
                {
                    id: '4',
                    name: '4',
                    price: 300,
                    distance: { measure: 'revenue-centers', maximum: 4 }
                }
            ],
            supply: [{ definitionId: '4', count: 1 }]
        })
        const state = {
            ...minimalPlayState(),
            machineState: 'RunningTrains' as const,
            trainInventory: depot.createInventory(),
            tileInventory: minimalTileSet.createInventory(),
            routeStep: { companyId: TestCompanyId }
        }
        state.stations.push({
            id: 'station',
            companyId: TestCompanyId,
            status: 'placed',
            position: { locationId: 'a1', nodeId: 'city', slot: 0 }
        })
        const train = companyTrain(depot, state.trainInventory, '4')
        // A run of two stations pays the treasury more than any other, as a mail contract might.
        const rules = {
            routeRules: {
                ...minimalRouteRules,
                map,
                depot,
                runSubsidy: (
                    _state: unknown,
                    _companyId: string,
                    routes: readonly RouteResult[]
                ) => (routes[0]?.visits.length === 2 ? 50 : 10)
            }
        }
        const { session, applied } = testSession(state, rules, ['RunTrains'])
        const module = new RoutesModule(
            session,
            () => networkRoutes,
            () => true,
            () => 'unless-subsidy-rises'
        )
        const along = (from: number, to: number) =>
            Array.from({ length: to - from }, (_, index) => [
                { locationId: `a${from + index}`, pathId: 'edge-0' },
                { locationId: `a${from + index + 1}`, pathId: 'edge-3' }
            ]).flat()
        const start = { locationId: 'a0', nodeId: 'city' }
        const best = new RouteEvaluation(state, rules.routeRules).evaluate(TestCompanyId, [
            { trainId: train, start, paths: along(0, 3) }
        ])
        assertExists(best.result)
        module.setSolved(state, best.result, true)
        expect(module.revenueToReach).toBe(120)
        module.selectTrain(train)
        module.tap({ kind: 'node', locationId: 'a2', nodeId: 'city' })
        expect(module.shown?.revenue).toBe(90)
        expect(module.reducedRun).toEqual({
            revenue: 90,
            subsidy: 10,
            allowed: false,
            subsidyToBeat: 10
        })
        expect(module.submission).toBeUndefined()
        module.tap({ kind: 'node', locationId: 'a1', nodeId: 'city' })
        expect(module.shown?.revenue).toBe(60)
        expect(module.reducedRun).toEqual({
            revenue: 60,
            subsidy: 50,
            allowed: true,
            subsidyToBeat: 10
        })
        expect(module.submission).toHaveLength(1)
        module.useBestRun()
        expect(module.reducedRun).toBeUndefined()
        await module.run()
        expect(applied).toMatchObject([{ type: 'RunTrains', companyId: TestCompanyId }])
    })

    it('has nothing pending without a route selection and yields Undo to game history', () => {
        const { module } = running('RunningTrains', ['RunTrains'])
        expect(module.hasManual()).toBe(false)
        expect(module.undo()).toBe(false)
    })

    describe('the recorded run', () => {
        function afterRun(ranTrainIds: (owned: string[]) => string[]) {
            const trainInventory = minimalRouteRules.depot.createInventory()
            const owned = ['2', '2'].map((definitionId) =>
                companyTrain(minimalRouteRules.depot, trainInventory, definitionId)
            )
            const state = {
                ...minimalPlayState(),
                machineState: 'BuyingTrains' as const,
                tileInventory: minimalTileSet.createInventory(),
                trainInventory,
                routeStep: {
                    companyId: TestCompanyId,
                    result: {
                        companyId: TestCompanyId,
                        revenue: 0,
                        routes: ranTrainIds(owned).map((trainId) => ({
                            trainId,
                            start: { locationId: TestHomeLocationId, nodeId: 'city' },
                            paths: [],
                            definitionId: '2',
                            visits: [],
                            payments: [],
                            distance: 0,
                            revenue: 0
                        }))
                    }
                }
            }
            const harness = testSession(state, { routeRules: minimalRouteRules }, ['BuyTrain'])
            return { module: new RoutesModule(harness.session, () => networkRoutes), owned }
        }

        it("colours each route by its train's place among the company's trains", () => {
            const { module, owned } = afterRun((owned) => [owned[1]])
            expect(module.overlays).toMatchObject([{ id: owned[1], color: routeColor(1) }])
        })

        // Buying a train after the run can rust the trains that ran (TOP bug report
        // 1570074225463795774); the table broke on every load until the turn ended.
        it('still draws a run whose train has left the company since', () => {
            const { module } = afterRun(() => ['rusted-3H', 'rusted-3H-b'])
            expect(module.overlays).toMatchObject([
                { id: 'rusted-3H', color: routeColor(0) },
                { id: 'rusted-3H-b', color: routeColor(1) }
            ])
        })
    })

    describe('drawn routes', () => {
        type Drawing = {
            titleDraws?: boolean
            standard?: DrawnRunStandard
            proved?: boolean
            bestRuns?: boolean
        }
        function drawing({
            titleDraws = false,
            standard,
            proved = true,
            bestRuns = false
        }: Drawing = {}) {
            const state = {
                ...minimalPlayState(),
                machineState: 'RunningTrains' as const,
                tileInventory: minimalTileSet.createInventory(),
                trainInventory: minimalRouteRules.depot.createInventory(),
                routeStep: { companyId: TestCompanyId }
            }
            state.stations.push({
                id: 'station',
                companyId: TestCompanyId,
                status: 'placed',
                position: { locationId: TestHomeLocationId, nodeId: 'city', slot: 0 }
            })
            const trainId = companyTrain(minimalRouteRules.depot, state.trainInventory, '2')
            const harness = testSession(state, { routeRules: minimalRouteRules }, ['RunTrains'])
            const module = new RoutesModule(
                harness.session,
                () => [],
                () => titleDraws,
                () => standard
            )
            const best = new RouteEvaluation(state, minimalRouteRules).evaluate(
                TestCompanyId,
                bestRuns
                    ? [
                          {
                              trainId,
                              start: { locationId: TestHomeLocationId, nodeId: 'city' },
                              paths: [
                                  { locationId: TestHomeLocationId, pathId: 'edge-0' },
                                  { locationId: TestOpenLocationId, pathId: 'edge-3' }
                              ]
                          }
                      ]
                    : []
            )
            assertExists(best.result)
            module.setSolved(state, best.result, proved)
            return { ...harness, module, trainId }
        }

        it('lets a director draw only where the title allows it', () => {
            expect(drawing().module.editable).toBe(false)
            expect(drawing({ titleDraws: true }).module.editable).toBe(true)
            expect(() => drawing().module.selectTrain('t1')).toThrow('Routes cannot be drawn')
        })

        it('lets any director draw where the search stopped short, to earn at least the best found', () => {
            expect(drawing({ bestRuns: true }).module.editable).toBe(false)
            const { module, trainId } = drawing({ proved: false, bestRuns: true })
            expect(module.editable).toBe(true)
            expect(module.revenueToReach).toBe(60)
            module.selectTrain(trainId)
            module.clearTrain()
            expect(module.shown?.revenue).toBe(0)
            expect(module.reducedRun).toEqual({ revenue: 0, subsidy: 0, allowed: false })
            expect(module.submission).toBeUndefined()
            module.tap({ kind: 'node', locationId: TestHomeLocationId, nodeId: 'city' })
            module.tap({ kind: 'node', locationId: TestOpenLocationId, nodeId: 'city' })
            expect(module.reducedRun).toBeUndefined()
            expect(module.submission).toHaveLength(1)
        })

        it('keeps a title’s own rules for drawn runs where the search stopped short', () => {
            const forLess = drawing({ titleDraws: true, proved: false, bestRuns: true })
            expect(forLess.module.revenueToReach).toBeUndefined()
            forLess.module.selectTrain(forLess.trainId)
            forLess.module.clearTrain()
            expect(forLess.module.submission).toEqual([])

            const held = drawing({
                titleDraws: true,
                standard: 'unless-subsidy-rises',
                proved: false,
                bestRuns: true
            })
            expect(held.module.revenueToReach).toBe(60)
            held.module.selectTrain(held.trainId)
            held.module.clearTrain()
            expect(held.module.reducedRun).toEqual({ revenue: 0, subsidy: 0, allowed: false })
        })

        it('goes back to the best run found when asked, dropping the drawing', () => {
            const { module, trainId } = drawing({ titleDraws: true })
            module.selectTrain(trainId)
            module.tap({ kind: 'node', locationId: TestHomeLocationId, nodeId: 'city' })
            module.tap({ kind: 'node', locationId: TestOpenLocationId, nodeId: 'city' })
            expect(module.shown?.revenue).toBe(60)
            module.useBestRun()
            expect(module.editor.draft).toBeUndefined()
            expect(module.shown?.revenue).toBe(0)
            expect(module.hasManual()).toBe(false)
        })

        it('runs the routes as drawn, in place of the best run found', async () => {
            const { module, applied, trainId } = drawing({ titleDraws: true })
            module.selectTrain(trainId)
            expect(
                module.tap({ kind: 'node', locationId: TestHomeLocationId, nodeId: 'city' })
            ).toBe(true)
            module.tap({ kind: 'node', locationId: TestOpenLocationId, nodeId: 'city' })
            expect(module.shown?.revenue).toBe(60)
            expect(module.overlays.map((overlay) => overlay.id)).toEqual([trainId])
            await module.run()
            expect(applied).toMatchObject([
                {
                    type: 'RunTrains',
                    companyId: TestCompanyId,
                    routes: [
                        {
                            trainId,
                            start: { locationId: TestHomeLocationId, nodeId: 'city' },
                            paths: [
                                { locationId: TestHomeLocationId, pathId: 'edge-0' },
                                { locationId: TestOpenLocationId, pathId: 'edge-3' }
                            ]
                        }
                    ]
                }
            ])
        })
    })
})
