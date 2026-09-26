import {
    ActionSource,
    assert,
    assertExists,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    validateGameResult,
    type GameAction,
    type UninitializedGameState
} from '@tabletop/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { BusRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { WorkerActionType } from './workerActions.js'
import { BuildingType } from '../components/building.js'
import {
    HydratedChooseWorkerAction,
    type ChooseWorkerAction
} from '../actions/chooseWorkerAction.js'
import type { AddPassengers } from '../actions/addPassengers.js'
import { HydratedVroom } from '../actions/vroom.js'
import type { BusGameState, HydratedBusGameState } from '../model/gameState.js'
import { BUS_BUILDING_SITE_IDS, BUS_STATION_IDS, type BusNodeId } from '../utils/busGraph.js'
import { isBusNodeId, validBusLineSegments } from '../utils/busLineRules.js'

const engine = new GameEngine(BusRuntime)
const buildingTypes = Object.values(BuildingType)
const firstWorkerActions = [
    WorkerActionType.Vroom,
    WorkerActionType.Buildings,
    WorkerActionType.Passengers,
    WorkerActionType.Expansion
]
const secondWorkerActions = [
    WorkerActionType.Clock,
    WorkerActionType.Vroom,
    WorkerActionType.Passengers,
    WorkerActionType.Buildings,
    WorkerActionType.Expansion,
    WorkerActionType.Buses,
    WorkerActionType.StartingPlayer
]

function createGame(count: number, seed = 4242) {
    return BusRuntime.initializer.initializeGame(
        {
            id: 'bus-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function botAction(state: HydratedBusGameState, playerId: string, id: number): GameAction {
    const base = { id: `a${id}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const player = state.getPlayerState(playerId)
    const placeBuilding = () => {
        const site = state.board.openSitesForPhase(state.currentBuildingPhase)[0]
        assertExists(site, 'Expected an open building site')
        const buildingType = buildingTypes[Object.keys(state.board.buildings).length % 3]
        return { ...base, type: ActionType.PlaceBuilding, siteId: site.id, buildingType }
    }
    const placeBusLine = () => {
        const otherLines = state.players
            .filter((other) => other.playerId !== playerId)
            .map((other) => other.busLine.filter(isBusNodeId))
        const nodeAppeal = (nodeId: BusNodeId) =>
            state.board.passengersAtNode(nodeId).length +
            state.board.buildingsForNode(nodeId).length
        const segment = validBusLineSegments(
            player.busLine.filter(isBusNodeId),
            otherLines
        ).toSorted((a, b) => nodeAppeal(b[1]) - nodeAppeal(a[1]))[0]
        return segment
            ? { ...base, type: ActionType.PlaceBusLine, segment: [...segment] }
            : { ...base, type: ActionType.Pass }
    }

    switch (state.machineState) {
        case MachineState.InitialBuildingPlacement:
        case MachineState.AddingBuildings:
            return placeBuilding()
        case MachineState.InitialBusLinePlacement:
        case MachineState.LineExpansion:
            return placeBusLine()
        case MachineState.ChoosingActions: {
            const seat = state.turnManager.turnOrder.indexOf(playerId)
            const preference =
                player.numActionsChosen === 0
                    ? [
                          ...firstWorkerActions.slice(seat % 4),
                          ...firstWorkerActions.slice(0, seat % 4)
                      ]
                    : secondWorkerActions
            const actionType = preference.find((candidate) =>
                new HydratedChooseWorkerAction({
                    ...base,
                    type: ActionType.ChooseWorkerAction,
                    actionType: candidate
                }).isValidChooseWorkerAction(state)
            )
            if (player.numActionsChosen >= 2 || !actionType) {
                return { ...base, type: ActionType.Pass }
            }
            const choose: ChooseWorkerAction = {
                ...base,
                type: ActionType.ChooseWorkerAction,
                actionType
            }
            return choose
        }
        case MachineState.AddingPassengers: {
            const addPassengers: AddPassengers = {
                ...base,
                type: ActionType.AddPassengers,
                stationId:
                    BUS_STATION_IDS.find((stationId) => player.busLine.includes(stationId)) ??
                    BUS_STATION_IDS[id % BUS_STATION_IDS.length],
                numPassengers: 1
            }
            return addPassengers
        }
        case MachineState.TimeMachine:
            return player.stones === 0 && state.currentLocation === BuildingType.Pub
                ? { ...base, type: ActionType.StopTime }
                : { ...base, type: ActionType.Pass }
        case MachineState.Vrooming: {
            const vroom = player.busLine
                .flatMap((sourceNode) =>
                    BUS_BUILDING_SITE_IDS.map(
                        (destinationSite) =>
                            new HydratedVroom({
                                ...base,
                                type: ActionType.Vroom,
                                sourceNode,
                                destinationSite
                            })
                    )
                )
                .find((candidate) => candidate.isValidVroom(state))
            assertExists(vroom, 'Expected a deliverable passenger')
            return vroom.dehydrate()
        }
        default:
            throw Error(`No bot action for ${state.machineState}`)
    }
}

function play(
    game: ReturnType<typeof createGame>,
    initialState: BusGameState,
    until: (state: BusGameState) => boolean
): { state: BusGameState; actors: string[] } {
    let state = initialState
    const actors: string[] = []
    for (let step = 0; !until(state); step++) {
        assert(step < 5000, 'Bus playout did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(BusRuntime.hydrator.hydrateState(state), playerId, step)
        actors.push(playerId)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return { state, actors }
}

function initialize(
    game: ReturnType<typeof createGame>,
    uninitialized: UninitializedGameState,
    playerIds?: string[]
): BusGameState {
    return BusRuntime.initializer
        .initializeGameState(
            game,
            structuredClone(uninitialized),
            playerIds ? { playerIds } : undefined
        )
        .dehydrate()
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe.each([3, 4, 5])('Bus tournaments with %i players', (count) => {
    it('honors every starting seat through the actual setup turns', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.players.map((player) => player.playerId)).toEqual(order)
            expect(initialState.scoreOrder).toEqual(order)
            expect(initialState.machineState).toBe(MachineState.InitialBuildingPlacement)
            expect(initialState.activePlayerIds).toEqual([order[0]])

            const { state, actors } = play(
                game,
                initialState,
                (current) => current.machineState === MachineState.ChoosingActions
            )
            const reversed = [...order].reverse()
            expect(actors).toEqual([
                ...order.flatMap((playerId) => [playerId, playerId]),
                ...order,
                ...reversed
            ])
            expect(state.activePlayerIds).toEqual([order[0]])
        }
    })

    it('preserves ordinary seeded setup, colors and later draws', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game)
        const normal = initialize(game, uninitialized)
        expect(initialize(game, uninitialized)).toEqual(normal)
        expect(initialize(game, uninitialized, normal.turnManager.turnOrder)).toEqual(normal)

        const colorsById = (state: BusGameState) =>
            Object.fromEntries(state.players.map((player) => [player.playerId, player.color]))
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(game, uninitialized, order)
            expect(initialize(game, uninitialized, order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned.players.map((player) => player.playerId)).toEqual(order)
            expect(assigned.scoreOrder).toEqual(order)
            expect(colorsById(assigned)).toEqual(colorsById(normal))
            expect({
                ...assigned,
                players: normal.players,
                turnManager: normal.turnManager,
                scoreOrder: normal.scoreOrder
            }).toEqual(normal)
        }
    })

    it('finishes a real game with a declared winner and final scores for every player', () => {
        const game = createGame(count)
        const order = game.players.map((player) => player.id).reverse()
        const { initialState } = engine.startGame(game, { startingPositions: { playerIds: order } })
        const { state } = play(game, initialState, (current) => current.result !== undefined)

        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toHaveLength(1)
        expect(() => validateGameResult(state)).not.toThrow()
        expect(state.players.some((player) => player.stones > 0)).toBe(true)
        expect(state.players.some((player) => player.score > 0)).toBe(true)

        const scoring = BusRuntime.scoring
        assertExists(scoring, 'Bus declares final scores')
        const finalScores = scoring.finalScores(state)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        expect(finalScores).toEqual(
            Object.fromEntries(
                state.players.map((player) => [player.playerId, player.score - player.stones])
            )
        )
        expect(finalScores[state.winningPlayerIds[0]]).toBe(Math.max(...Object.values(finalScores)))
    })

    it('breaks complete ties by score order, which starts in assigned position order', () => {
        const game = createGame(count)
        const order = rotations(game.players.map((player) => player.id))[1]
        const state = BusRuntime.hydrator.hydrateState(
            engine.startGame(game, { startingPositions: { playerIds: order } }).initialState
        )
        state.machineState = MachineState.EndOfGame
        BusRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: game.config })
        )
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([order[0]])
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
    })
})
