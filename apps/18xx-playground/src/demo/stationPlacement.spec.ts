import { expect, it } from 'vitest'
import { ActionSource, MachineContext } from '@tabletop/common'
import { Definition as Top, TheOldPrinceStationRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889StationRules } from '@tabletop/shikoku-1889'
import {
    StationPlacement,
    PlacingStationHandler,
    TrackNetwork,
    RailwayMapState,
    cashOwnedBy,
    type PlaceStation,
    type FinishStations,
    type StartOperatingSet,
    type StationPlacementDetails,
    type FinanceExampleState,
    type StationRules
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    { definition: Top, rules: TheOldPrinceStationRules, cost: 80 },
    { definition: Shikoku, rules: Shikoku1889StationRules, cost: 40 }
]
function choice(state: FinanceExampleState, rules: StationRules): StationPlacementDetails {
    const placement = new StationPlacement(state, rules)
    const result = state.stations.flatMap((station) => placement.choices(station.id))[0]
    if (!result) throw new Error('Expected a legal station position')
    return result
}
function action(state: FinanceExampleState, details: StationPlacementDetails): PlaceStation {
    return {
        id: 'station',
        gameId: state.gameId,
        source: ActionSource.User,
        type: 'PlaceStation',
        playerId: state.activePlayerIds[0],
        companyId: details.companyId,
        stationId: details.stationId,
        position: details.position,
        expectedCost: details.cost
    }
}
it.each(Titles)(
    'places a $definition.info.id station with settlement, replay, reload and undo',
    ({ definition, rules, cost }) => {
        const { game, engine, state } = example(definition, 'stations')
        const before = structuredClone(state)
        const details = choice(state, rules)
        expect(details.cost).toBe(cost)
        expect(state).toEqual(before)
        const command = action(state, details)
        const result = engine.executeCanonicalAction({ game, state, action: command })
        expect(result.processedActions.map((action) => action.type)).toEqual(['PlaceStation', 'FinishStations', 'RunTrains', 'DistributeEarnings'])
        expect(result.processedActions.slice(1).every((action) => action.source === ActionSource.System)).toBe(true)
        expect(result.updatedState.routeStep?.result).toMatchObject({ routes: [], revenue: 0 })
        expect(result.updatedState.earningsDistribution).toMatchObject({ choice: 'withhold', payments: [] })
        expect(result.updatedState.machineState).toBe('BuyingTrains')
        expect(
            result.updatedState.stations.find((station) => station.id === details.stationId)
        ).toMatchObject({ status: 'placed', position: details.position })
        expect(
            cashOwnedBy(result.updatedState, { kind: 'company', companyId: details.companyId })
        ).toBe(Number(cashOwnedBy(state, { kind: 'company', companyId: details.companyId })) - cost)
        expect(result.updatedState.stationStep?.placedStationIds).toEqual([details.stationId])
        expect(new StationPlacement(result.updatedState, rules).choices(details.stationId)).toEqual(
            []
        )
        let replayed = state
        for (const action of result.processedActions)
            replayed = engine.applyProcessedAction({ game, state: replayed, action })
        expect(replayed).toEqual(result.updatedState)
        let undone = result.updatedState
        for (const action of [...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(state)
        expect(definition.runtime.hydrator.hydrateState(result.updatedState).dehydrate()).toEqual(
            result.updatedState
        )
        expect(
            engine.executeCanonicalAction({ game, state, action: command }).updatedState
        ).toEqual(result.updatedState)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: { ...command, playerId: 'casey' }
            })
        ).toThrow()
        const wrongCost: PlaceStation = { ...command, expectedCost: cost + 1 }
        expect(() => engine.executeCanonicalAction({ game, state, action: wrongCost })).toThrow()
        expect(() =>
            engine.executeCanonicalAction({ game, state: result.updatedState, action: command })
        ).toThrow()
    }
)
it.each(Titles)(
    'rejects unavailable, duplicate, disconnected, occupied, reserved and unaffordable $definition.info.id placements',
    ({ definition, rules }) => {
        const { state } = example(definition, 'stations')
        const details = choice(state, rules)
        const placement = () => new StationPlacement(state, rules)
        expect(placement().evaluate({ ...details, stationId: 'missing' }).reason).toBeDefined()
        const own = state.stations.find(
            (station) => station.companyId === details.companyId && station.status === 'placed'
        )!
        if (own.status !== 'placed') throw new Error('Expected home')
        expect(placement().evaluate({ ...details, position: own.position }).reason).toBeDefined()
        expect(
            placement().evaluate({ ...details, position: { ...details.position, slot: 99 } }).reason
        ).toBeDefined()
        state.stationReservations.push({
            companyId: 'unstarted',
            locationId: details.position.locationId,
            nodeId: details.position.nodeId
        })
        expect(placement().evaluate(details).reason).toContain('reserved')
        state.stationReservations = []
        state.stations.push({
            id: 'rival',
            companyId: 'rival',
            status: 'placed',
            position: details.position
        })
        expect(placement().evaluate(details).reason).toContain('occupied')
        state.stations.pop()
        const cash = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === details.companyId
        )!
        cash.amount = 0
        expect(placement().evaluate(details).reason).toContain('afford')
        cash.amount = 1000
        state.stations = state.stations.filter(
            (station) => station.status !== 'placed' || station.companyId !== details.companyId
        )
        expect(placement().evaluate(details).reason).toContain('connected')
    }
)
it.each(Titles)(
    'finishes or skips $definition.info.id station placement and undoes completion',
    ({ definition }) => {
        const { game, engine, state } = example(definition, 'stations')
        const finish: FinishStations = {
            id: 'finish-stations',
            gameId: state.gameId,
            source: ActionSource.User,
            type: 'FinishStations',
            playerId: state.activePlayerIds[0],
            companyId: state.stationStep!.companyId
        }
        const result = engine.executeCanonicalAction({ game, state, action: finish })
        expect(result.updatedState.machineState).toBe('BuyingTrains')
        expect(result.updatedState.stations).toEqual(state.stations)
        let undone = result.updatedState
        for (const action of [...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(state)
    }
)
it('places all newly floated 1889 homes before construction, without payment or using the extra placement', () => {
    const { game, engine, state } = example(Shikoku)
    state.machineState = 'StartingOperatingSet'
    state.stations = state.stations.map((station) =>
        station.id.endsWith(':home')
            ? { id: station.id, companyId: station.companyId, status: 'available' }
            : station
    )
    state.stationReservations = [
        { companyId: 'IR', locationId: 'E2', nodeId: 'city' },
        { companyId: 'AR', locationId: 'K8', nodeId: 'city' }
    ]
    const start: StartOperatingSet = {
        id: 'or',
        gameId: state.gameId,
        source: ActionSource.System,
        playerId: 'alex',
        type: 'StartOperatingSet'
    }
    const result = engine.executeCanonicalAction({ game, state, action: start })
    expect(result.processedActions.map((action) => action.type)).toEqual([
        'StartOperatingSet',
        'StartOperatingRound',
        'PlaceHomeStations'
    ])
    expect(
        result.updatedState.stations.filter((station) => station.status === 'placed')
    ).toHaveLength(2)
    expect(result.updatedState.stationReservations).toEqual([])
    const afterIncome = engine.applyProcessedAction({
        game,
        state: engine.applyProcessedAction({ game, state, action: result.processedActions[0] }),
        action: result.processedActions[1]
    })
    expect(result.updatedState.cash).toEqual(afterIncome.cash)
    expect(result.updatedState.machineState).toBe('OperatingSet')
    expect(result.updatedState.stationStep).toBeUndefined()
    let replay = state
    for (const action of result.processedActions)
        replay = engine.applyProcessedAction({ game, state: replay, action })
    expect(replay).toEqual(result.updatedState)
    for (const action of [...result.processedActions].reverse())
        replay = engine.undoProcessedAction({ state: replay, action })
    expect(replay).toEqual(state)
    const repeated = engine.executeCanonicalAction({ game, state, action: start })
    expect(repeated.updatedState).toEqual(result.updatedState)
    expect(repeated.processedActions.map(({ createdAt: _createdAt, ...record }) => record)).toEqual(
        result.processedActions.map(({ createdAt: _createdAt, ...record }) => record)
    )
})
it('does not grant PEIR an extra station even if one is supplied', () => {
    const { state } = example(Top, 'stations')
    state.stationStep = { companyId: 'PEIR', placedStationIds: [], completed: false }
    state.stations.push({ id: 'PEIR:extra', companyId: 'PEIR', status: 'available' })
    expect(
        new StationPlacement(state, TheOldPrinceStationRules).evaluate({
            companyId: 'PEIR',
            stationId: 'PEIR:extra',
            position: { locationId: 'K19', nodeId: 'city', slot: 0 }
        }).reason
    ).toContain('No station placement')
})
it('reaches a rival-filled city as an endpoint and stops access beyond it until undo', () => {
    const { game, engine, state } = example(Shikoku, 'stations')
    const network = (s: FinanceExampleState) =>
        new TrackNetwork(
            new RailwayMapState(
                Shikoku1889StationRules.map,
                Shikoku1889StationRules.tileSet,
                s.tileInventory
            ),
            s,
            'AR'
        )
    expect(network(state).reaches('E2', { kind: 'node', nodeId: 'city' })).toBe(true)
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, choice(state, Shikoku1889StationRules))
    })
    expect(network(result.updatedState).reaches('F3', { kind: 'node', nodeId: 'city' })).toBe(true)
    expect(network(result.updatedState).isBlocked('F3', 'city')).toBe(true)
    expect(network(result.updatedState).reaches('E2', { kind: 'node', nodeId: 'city' })).toBe(false)
    const restored = engine.undoProcessedAction({
        state: result.updatedState,
        action: result.processedActions[0]
    })
    expect(network(restored).reaches('E2', { kind: 'node', nodeId: 'city' })).toBe(true)
})


it('keeps station placement open when the title allows another token', () => {
    const { game, state } = example(Top, 'stations')
    const hydrated = Top.runtime.hydrator.hydrateState(state)
    hydrated.stationStep!.placedStationIds.push('already-placed')
    const context = new MachineContext({ gameConfig: game.config, gameState: hydrated })
    const handler = new PlacingStationHandler(
        { ...TheOldPrinceStationRules, placementLimit: () => 2 },
        'RunningTrains'
    )
    handler.enter(context)
    expect(context.getPendingActions()).toEqual([])
})

it.each(['unaffordable', 'no tokens', 'disconnected'] as const)(
    'automatically skips station placement when %s',
    (reason) => {
        const { game, state } = example(Top, 'stations')
        const companyId = state.stationStep!.companyId
        if (reason === 'unaffordable')
            state.cash.find((entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId)!.amount = 0
        else
            state.stations = state.stations.filter((station) =>
                station.companyId !== companyId ||
                (reason === 'no tokens' ? station.status !== 'available' : station.status !== 'placed'))
        const hydrated = Top.runtime.hydrator.hydrateState(state)
        const context = new MachineContext({ gameConfig: game.config, gameState: hydrated })
        const handler = new PlacingStationHandler(TheOldPrinceStationRules, 'RunningTrains')
        handler.enter(context)
        expect(context.getPendingActions()).toMatchObject([{
            type: 'FinishStations', source: ActionSource.System, companyId
        }])
    }
)
