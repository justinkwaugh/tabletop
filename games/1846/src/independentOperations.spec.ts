import { describe, it, expect } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    RouteEvaluation,
    finiteCashOwnedBy,
    getCompany,
    type TrainRoute,
    type RoutePath
} from '@tabletop/18xx'
import { stockGame } from './testSupport.js'
import { TrackRules1846 } from './track.js'
import { RouteRules1846 } from './routes.js'
import { steamboatOwner } from './steamboat.js'

function operatingGame(assign = false) {
    const table = stockGame()
    table.act('FinishStockTurn')
    table.act('FinishStockTurn')
    table.act('FinishStockTurn')
    expect(table.state.machineState).toBe('AssigningSteamboat')
    expect(table.state.activePlayerIds).toEqual([steamboatOwner(table.state)])
    table.act(
        'AssignSteamboat',
        assign ? { assignment: { companyId: 'MS', locationId: 'D14' } } : {}
    )
    return table
}
function routeGame() {
    const table = operatingGame()
    const choice = new TrackConstruction(table.hydrated, TrackRules1846).choices('B16')[0]
    assertExists(choice)
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = choice
    table.act('LayTile', {
        companyId,
        locationId,
        definitionId,
        rotation,
        nodeMapping,
        expectedCost: cost
    })
    table.act('FinishTrack', { companyId: 'MS' })
    expect(table.state.machineState).toBe('RunningTrains')
    expect(
        table.engine.getValidActionTypesForPlayer(
            table.game,
            table.hydrated,
            table.state.activePlayerIds[0]
        )
    ).toContain('RunTrains')
    return table
}
function portHuronRoute(table: ReturnType<typeof stockGame>): TrainRoute {
    const evaluation = new RouteEvaluation(table.hydrated, RouteRules1846)
    const start = { locationId: 'C15', nodeId: 'city' }
    const paths: RoutePath[] = []
    for (const locationId of ['C15', 'B16']) {
        const next = evaluation.network.extensions(start, paths).find(
            (path) =>
                path.locationId === locationId &&
                (locationId === 'B16' ||
                    evaluation.network
                        .face('C15')
                        .paths.find((entry) => entry.id === path.pathId)
                        ?.endpoints.some((end) => end.kind === 'edge' && end.edge === 3))
        )
        assertExists(next, 'Detroit connects to Port Huron')
        paths.push(next)
    }
    return { trainId: 'MS:2', start, paths }
}

describe('1846 independent operations', () => {
    it('limits the initial Steamboat assignment to its owner and legal railroad/port pairs', () => {
        const table = stockGame()
        for (let i = 0; i < 3; i++) table.act('FinishStockTurn')
        expect(() => table.act('AssignSteamboat', { playerId: 'other' })).toThrow()
        expect(() =>
            table.act('AssignSteamboat', { assignment: { companyId: 'MS', locationId: 'C15' } })
        ).toThrow()
        expect(() =>
            table.act('AssignSteamboat', { assignment: { companyId: 'IC', locationId: 'D14' } })
        ).toThrow()
        table.act('AssignSteamboat', { assignment: { companyId: 'MS', locationId: 'D14' } })
        expect(table.state.steamboat).toEqual({ companyId: 'MS', locationId: 'D14' })
        expect(() => table.act('AssignSteamboat')).toThrow()
        const train = RouteRules1846.depot.trainDefinition('2')
        expect(
            RouteRules1846.stopBonus!(table.hydrated, train, 'MS', {
                locationId: 'D14',
                nodeId: 'city'
            })
        ).toBe(20)
        expect(
            RouteRules1846.stopBonus!(table.hydrated, train, 'BIG4', {
                locationId: 'D14',
                nodeId: 'city'
            })
        ).toBe(0)
        expect(
            RouteRules1846.stopBonus!(table.hydrated, train, 'MS', {
                locationId: 'B8',
                nodeId: 'offboard'
            })
        ).toBe(0)
    })
    it('runs Detroit–Port Huron and automatically pays each half before starting Big 4', () => {
        const table = routeGame()
        const route = portHuronRoute(table)
        const evaluation = new RouteEvaluation(table.hydrated, RouteRules1846).evaluate('MS', [
            route
        ])
        expect(evaluation.result?.revenue).toBe(60)
        const owner = getCompany(table.state, 'MS').president
        assertExists(owner)
        const playerCash = finiteCashOwnedBy(table.state, owner)
        const treasury = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'MS' })
        const bank = finiteCashOwnedBy(table.state, { kind: 'bank' })
        const result = table.act('RunTrains', { companyId: 'MS', routes: [route] })
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'RunTrains',
            'SettleIndependent',
            'StartOperatingTurn'
        ])
        expect(result.processedActions[1].metadata).toMatchObject({
            companyId: 'MS',
            revenue: 60,
            retained: 30,
            dividendPerShare: 30,
            bankAdjustment: 0
        })
        expect(finiteCashOwnedBy(table.state, owner)).toBe(playerCash + 30)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'MS' })).toBe(
            treasury + 30
        )
        expect(finiteCashOwnedBy(table.state, { kind: 'bank' })).toBe(bank - 60)
        expect(getCompany(table.state, 'MS').operated).toBe(true)
        expect(table.state.trackStep?.companyId).toBe('BIG4')
        expect(table.state.operatingSet?.completedCompanyIds).toEqual(['MS'])
        expect(table.state.trainInventory.trains.find((train) => train.id === 'MS:2')?.hasRun).toBe(
            true
        )
    })
    it('rejects a foreign train, wrong actor, disconnected route and duplicate train', () => {
        const table = routeGame()
        const route = portHuronRoute(table)
        for (const fields of [
            { companyId: 'MS', routes: [route], playerId: 'other' },
            { companyId: 'MS', routes: [{ ...route, trainId: 'BIG4:2' }] },
            { companyId: 'MS', routes: [{ ...route, paths: route.paths.toReversed() }] },
            { companyId: 'MS', routes: [route, route] }
        ])
            expect(() => table.act('RunTrains', fields)).toThrow()
    })
    it('automatically settles no-route independents and starts the second OR', () => {
        const table = operatingGame()
        table.act('FinishTrack', { companyId: 'MS' })
        expect(table.state.trackStep?.companyId).toBe('BIG4')
        table.act('FinishTrack', { companyId: 'BIG4' })
        expect(table.state.machineState).toBe('AssigningSteamboat')
        expect(table.state.operatingSet?.completedCompanyIds).toEqual([])
        expect(table.state.operatingSet?.roundNumber).toBe(2)
        expect(table.state.activePlayerIds).toEqual([steamboatOwner(table.state)])
        expect(
            table.actions.filter((action) => action.type === 'StartOperatingRound')
        ).toHaveLength(2)
    })
    it('rejects three stops on a 2-train and a route without its station', () => {
        const table = operatingGame()
        const choice = new TrackConstruction(table.hydrated, TrackRules1846)
            .choices('B16')
            .find((choice) => choice.definitionId === '18xx:6' && choice.rotation === 4)
        assertExists(choice)
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = choice
        table.act('LayTile', {
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
        expect(table.state.machineState).toBe('RunningTrains')
        const route = portHuronRoute(table)
        const evaluation = new RouteEvaluation(table.hydrated, RouteRules1846)
        for (const locationId of ['B16', 'B18']) {
            const path = evaluation.network
                .extensions(route.start, route.paths)
                .find((path) => path.locationId === locationId)
            assertExists(path)
            route.paths.push(path)
        }
        expect(evaluation.evaluateRoute('MS', route).reason).toContain('distance limit')
        route.paths = route.paths.slice(0, 2)
        table.state.stations = table.state.stations.filter((station) => station.companyId !== 'MS')
        expect(
            new RouteEvaluation(table.hydrated, RouteRules1846).evaluateRoute('MS', route).reason
        ).toContain('station')
    })
    it('splits odd tens without rounding and prevents duplicate settlement', () => {
        const table = routeGame()
        table.state.machineState = 'SettlingIndependent'
        table.state.routeStep = {
            companyId: 'MS',
            result: { companyId: 'MS', routes: [], revenue: 70 }
        }
        const result = table.act('SettleIndependent', {
            source: ActionSource.System,
            companyId: 'MS'
        })
        expect(result.processedActions[0].metadata).toMatchObject({
            retained: 35,
            dividendPerShare: 35
        })
        expect(() =>
            table.act('SettleIndependent', { source: ActionSource.System, companyId: 'MS' })
        ).toThrow()
    })
    it('replays and reverses assignment, routes, payouts, and the next independent handoff', () => {
        const table = routeGame()
        table.act('RunTrains', { companyId: 'MS', routes: [portHuronRoute(table)] })
        table.act('FinishTrack', { companyId: 'BIG4' })
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
})
