import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    StationPlacement,
    type StationPlacementState,
    type StationRules
} from './stationPlacement.js'
import { isPlaceStation, type HydratedPlaceStation } from './placeStation.js'
import { FinishStations, isFinishStations, type HydratedFinishStations } from './finishStations.js'
type State = HydratedGameState & StationPlacementState
export class PlacingStationHandler implements MachineStateHandler<
    HydratedPlaceStation | HydratedFinishStations,
    State
> {
    constructor(
        private readonly rules: StationRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            (action.source !== ActionSource.User &&
                !(action.source === ActionSource.System && isFinishStations(action) && this.mustFinish(state))) ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId) ||
            (!isPlaceStation(action) && !isFinishStations(action))
        )
            return false
        const placement = new StationPlacement(state, this.rules)
        return (
            placement.canAct(action.playerId, action.companyId) &&
            (isFinishStations(action) ||
                placement.evaluate(action).details?.cost === action.expectedCost)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const placement = new StationPlacement(state, this.rules)
        const companyId = state.stationStep?.companyId
        if (
            !companyId ||
            !state.activePlayerIds.includes(playerId) ||
            !placement.canAct(playerId, companyId)
        )
            return []
        return this.hasLegalPlacement(state) ? ['PlaceStation', 'FinishStations'] : ['FinishStations']
    }
    private hasLegalPlacement(state: State): boolean {
        const placement = new StationPlacement(state, this.rules)
        return state.stations.some((station) =>
            station.companyId === state.stationStep?.companyId &&
            placement.choices(station.id).length > 0)
    }
    private mustFinish(state: State): boolean {
        return !!state.stationStep && !state.stationStep.completed && !this.hasLegalPlacement(state)
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        if (this.mustFinish(state)) {
            const step = state.stationStep!
            context.addSystemAction(FinishStations, {
                companyId: step.companyId,
                playerId: state.activePlayerIds[0]
            })
        }
    }
    onAction(
        action: HydratedPlaceStation | HydratedFinishStations,
        context: MachineContext<State>
    ): string {
        return isFinishStations(action) ? this.nextState : context.gameState.machineState
    }
}
