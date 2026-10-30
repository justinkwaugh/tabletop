import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import type { OperatingState } from '../operating/operatingSet.js'
import type { ConstructionState } from '../construction/trackConstruction.js'
import { FinishStations, isFinishStations } from './finishStations.js'
import { isPlaceStation } from './placeStation.js'
import {
    StationPlacement,
    type StationPlacementState,
    type StationRules
} from './stationPlacement.js'

type State = HydratedGameState & OperatingState & StationPlacementState & ConstructionState

/** The stations a corporation may place now, beside its track. */
export function stationChoicesWithTrack(state: StationPlacementState, rules: StationRules) {
    const station = state.stations.find(
        (station) =>
            station.companyId === state.stationStep?.companyId && station.status === 'available'
    )
    return station ? new StationPlacement(state, rules).choices(station.id) : []
}

/**
 * Track and stations in one step, in any order: a corporation's station placement opens with
 * its track and closes when its track is finished.
 */
export class StationsWithTrackHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: StationRules,
        private readonly nextState: string
    ) {}
    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
        const state = context.gameState
        const companyId = state.trackStep?.companyId
        assertExists(companyId, 'Construction requires an operating company')
        if (getCompany(state, companyId).kind !== 'major') return
        state.stationStep ??= { companyId, placedStationIds: [], completed: false }
        if (state.trackStep?.completed)
            context.addSystemAction(FinishStations, {
                companyId,
                playerId: state.activePlayerIds[0]
            })
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        const state = context.gameState
        return [
            ...this.handler.validActionsForPlayer(playerId, context),
            ...(state.isActivePlayer(playerId) && stationChoicesWithTrack(state, this.rules).length
                ? ['PlaceStation']
                : [])
        ]
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        const state = context.gameState
        if (isFinishStations(action))
            return (
                action.source === ActionSource.System &&
                !!state.trackStep?.completed &&
                state.stationStep?.companyId === action.companyId &&
                !state.stationStep.completed &&
                state.isActivePlayer(action.playerId)
            )
        if (!isPlaceStation(action)) return this.handler.isValidAction(action, context)
        const placement = new StationPlacement(state, this.rules)
        return (
            action.source === ActionSource.User &&
            state.isActivePlayer(action.playerId) &&
            placement.canAct(action.playerId, action.companyId) &&
            placement.evaluate(action).details?.cost === action.expectedCost
        )
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        if (isFinishStations(action)) return this.nextState
        const state = context.gameState
        const next = isPlaceStation(action)
            ? state.machineState
            : this.handler.onAction(action, context)
        return next === this.nextState && state.stationStep && !state.stationStep.completed
            ? state.machineState
            : next
    }
}
