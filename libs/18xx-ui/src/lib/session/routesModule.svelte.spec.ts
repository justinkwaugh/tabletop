import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    TestCompanyId,
    TestHomeLocationId,
    TestOpenLocationId,
    minimalPlayState,
    minimalRouteRules,
    minimalTileSet
} from '@tabletop/18xx/testing'
import { RoutesModule, type RouteOverlay } from './routesModule.svelte.js'
import { testSession } from './moduleTestSession.js'

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

    it('has nothing pending without a route selection and yields Undo to game history', () => {
        const { module } = running('RunningTrains', ['RunTrains'])
        expect(module.hasManual()).toBe(false)
        expect(module.undo()).toBe(false)
    })

    describe('drawn routes', () => {
        function drawing(manual: boolean) {
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
            const train = minimalRouteRules.depot.nextTrain(state.trainInventory, '2')
            assertExists(train)
            minimalRouteRules.depot.purchase(state.trainInventory, train.id, '2', {
                kind: 'company',
                companyId: TestCompanyId
            })
            const harness = testSession(state, { routeRules: minimalRouteRules }, ['RunTrains'])
            const module = new RoutesModule(
                harness.session,
                () => [],
                () => manual
            )
            module.setSolved(state, { companyId: TestCompanyId, routes: [], revenue: 0 }, true)
            return { ...harness, module, trainId: train.id }
        }

        it('lets a director draw only where the title allows it', () => {
            expect(drawing(false).module.editable).toBe(false)
            expect(drawing(true).module.editable).toBe(true)
            expect(() => drawing(false).module.selectTrain('t1')).toThrow('Routes cannot be drawn')
        })

        it('goes back to the best run found when asked, dropping the drawing', () => {
            const { module, trainId } = drawing(true)
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
            const { module, applied, trainId } = drawing(true)
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
