import { describe, expect, it } from 'vitest'
import { TestCompanyId, minimalPlayState, minimalRouteRules, minimalTileSet } from '@tabletop/18xx/testing'
import type { MapSelection } from '../maps/mapDrawing.js'
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
    const inspected: MapSelection[] = []
    const harness = testSession(state, { routeRules: minimalRouteRules }, valid, availability)
    const module = new RoutesModule(
        harness.session,
        (selection) => inspected.push(selection),
        () => networkRoutes
    )
    return { ...harness, state, module, inspected }
}

describe('RoutesModule', () => {
    it('can run only when the action is valid and the session is interactive', () => {
        expect(running('RunningTrains', ['RunTrains']).module.canRun).toBe(true)
        expect(running('RunningTrains', ['FinishTrack']).module.canRun).toBe(false)
        expect(running('RunningTrains', ['RunTrains'], { interactive: false }).module.canRun).toBe(false)
    })

    it('shows a route draft only while running trains with drafts visible', () => {
        expect(running('RunningTrains', ['RunTrains']).module.draftVisible).toBe(true)
        expect(running('StockRound', ['RunTrains']).module.draftVisible).toBe(false)
        expect(running('RunningTrains', ['RunTrains'], { selectionsVisible: false }).module.draftVisible).toBe(false)
    })

    it('solves an empty run immediately for a company that owns no trains', () => {
        const { module } = running('RunningTrains', ['RunTrains'])
        expect(module.solved).toMatchObject({ exhaustive: true, result: { routes: [], revenue: 0 } })
    })

    it('runs the solved routes as one action', async () => {
        const { module, applied } = running('RunningTrains', ['RunTrains'])
        await module.runSolved()
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
        expect(() => module.selectTrain('t1')).toThrow('Routes are not active')
        expect(() => module.save()).toThrow('Routes are not active')
    })

    it('has nothing pending without a route draft and yields Undo to game history', () => {
        const { module } = running('RunningTrains', ['RunTrains'])
        expect(module.hasManual()).toBe(false)
        expect(module.undo()).toBe(false)
    })
})
