import { enumerateRouteCandidates } from './routeCandidates.js'
import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { Definition as Top, TheOldPrinceRouteRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889RouteRules } from '@tabletop/shikoku-1889'
import {
    RouteEvaluation,
    isRunTrains,
    trainsOwnedBy,
    type RouteRules,
    type RunTrains,
    type FinanceExampleState,
    type TrainRoute
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    { definition: Top, rules: TheOldPrinceRouteRules, companyId: 'ML', home: 'L16', expected: 70 },
    { definition: Shikoku, rules: Shikoku1889RouteRules, companyId: 'IR', home: 'E2', expected: 90 }
]
function action(state: FinanceExampleState, routes: TrainRoute[]): RunTrains {
    return {
        id: 'routes',
        gameId: state.gameId,
        type: 'RunTrains',
        source: ActionSource.User,
        playerId: state.activePlayerIds[0],
        companyId: state.routeStep!.companyId,
        routes
    }
}
function routesFor(state: FinanceExampleState, rules: RouteRules, companyId: string, home: string) {
    const running = new RouteEvaluation(state, rules),
        trains = trainsOwnedBy(state, { kind: 'company', companyId })
    const routes = [...enumerateRouteCandidates(running, companyId, trains[0].id)].filter(
        (route) => route.start.locationId === home
    )
    expect(routes).toHaveLength(2)
    routes[1] = { ...routes[1], trainId: trains[1].id }
    return routes
}
it.each(Titles)(
    'runs $companyId routes with authoritative revenue, replay, history, hydration and Undo',
    ({ definition, rules, companyId, home, expected }) => {
        const { game, engine, state } = example(definition, 'routes')
        const routes = routesFor(state, rules, companyId, home)
        const before = structuredClone(state)
        const result = engine.executeCanonicalAction({ game, state, action: action(state, routes) })
        expect(state).toEqual(before)
        expect(result.processedActions.map((action) => action.type)).toEqual(['RunTrains'])
        expect(result.updatedState.machineState).toBe('TrainsRun')
        expect(result.updatedState.routeStep?.result?.revenue).toBe(expected)
        expect(result.updatedState.cash).toEqual(state.cash)
        expect(
            result.updatedState.trainInventory.trains.filter((train) => train.hasRun)
        ).toHaveLength(2)
        expect(result.processedActions.filter(isRunTrains)[0].metadata).toEqual(
            result.updatedState.routeStep?.result
        )
        expect(
            engine.applyProcessedAction({ game, state, action: result.processedActions[0] })
        ).toEqual(result.updatedState)
        expect(
            engine.undoProcessedAction({
                state: result.updatedState,
                action: result.processedActions[0]
            })
        ).toEqual(state)
        expect(definition.runtime.hydrator.hydrateState(result.updatedState).dehydrate()).toEqual(
            result.updatedState
        )
        expect(
            engine.executeCanonicalAction({ game, state, action: action(state, routes) })
                .updatedState
        ).toEqual(result.updatedState)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: result.updatedState,
                action: action(state, routes)
            })
        ).toThrow()
    }
)
it.each(Titles)(
    'rejects wrong actors, shared track and stale track for $companyId',
    ({ definition, rules, companyId, home }) => {
        const { game, engine, state } = example(definition, 'routes')
        const routes = routesFor(state, rules, companyId, home)
        for (const invalid of [
            {
                ...action(state, routes),
                playerId: state.activePlayerIds[0] === 'alex' ? 'blair' : 'alex'
            },
            { ...action(state, routes), source: ActionSource.System },
            action(state, [routes[0], { ...routes[0], trainId: routes[1].trainId }]),
            action(state, [{ ...routes[0], paths: [{ locationId: home, pathId: 'missing' }] }])
        ])
            expect(() => engine.executeCanonicalAction({ game, state, action: invalid })).toThrow()
    }
)
it('uses diesel offboard values only for the running 1889 diesel', () => {
    const { state } = example(Shikoku, 'routes'),
        rules = Shikoku1889RouteRules
    state.phaseId = 'D'
    const route = routesFor(state, rules, 'IR', 'E2').find((route) =>
        route.paths.some((path) => path.locationId === 'F1')
    )!
    expect(new RouteEvaluation(state, rules).evaluate('IR', [route]).result?.revenue).toBe(80)
    const diesel = rules.depot.nextTrain(state.trainInventory, 'D')!
    rules.depot.purchase(state.trainInventory, diesel.id, 'D', { kind: 'company', companyId: 'IR' })
    expect(
        new RouteEvaluation(state, rules).evaluate('IR', [{ ...route, trainId: diesel.id }]).result
            ?.revenue
    ).toBe(120)
})
it('preserves TOP H, +, 7 and diesel distance semantics on the same connected path', () => {
    const { state } = example(Top, 'routes'),
        rules = TheOldPrinceRouteRules
    const runner = new RouteEvaluation(state, rules)
    const route = [
        ...enumerateRouteCandidates(
            runner,
            'ML',
            state.trainInventory.trains.find((train) => train.status === 'owned')!.id
        )
    ].find((route) => route.start.locationId === 'K19')!
    const longer = {
        ...route,
        paths: [
            ...route.paths,
            { locationId: 'L16', pathId: 'edge-5' },
            { locationId: 'M17', pathId: 'town-edge-2' }
        ]
    }
    expect(runner.evaluate('ML', [longer]).reason).toContain('distance limit')
    for (const [definitionId, distance] of [
        ['3H', 3],
        ['2+', 2],
        ['7', 3],
        ['D', 3]
    ] as const) {
        const train = rules.depot.nextTrain(state.trainInventory, definitionId)!
        rules.depot.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: 'ML'
        })
        const result = new RouteEvaluation(state, rules).evaluate('ML', [
            { ...longer, trainId: train.id }
        ]).result!
        expect(result.revenue).toBe(50)
        expect(result.routes[0].distance).toBe(distance)
    }
})
