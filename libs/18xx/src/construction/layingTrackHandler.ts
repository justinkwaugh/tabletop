import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isLayTile, type HydratedLayTile } from './layTile.js'
import { isFinishTrack, type HydratedFinishTrack } from './finishTrack.js'
import { TrackConstruction, type TrackRules, type ConstructionState } from './trackConstruction.js'

type State = HydratedGameState & ConstructionState
export class LayingTrackHandler implements MachineStateHandler<
    HydratedLayTile | HydratedFinishTrack,
    State
> {
    constructor(
        private readonly rules: TrackRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            action.source !== ActionSource.User ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId)
        )
            return false
        if (!isLayTile(action) && !isFinishTrack(action)) return false
        const construction = new TrackConstruction(state, this.rules)
        if (!construction.canAct(action.playerId, action.companyId)) return false
        return (
            isFinishTrack(action) ||
            construction.evaluate(action).details?.cost === action.expectedCost
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const companyId = state.trackStep?.companyId
        if (
            !companyId ||
            !state.activePlayerIds.includes(playerId) ||
            !new TrackConstruction(state, this.rules).canAct(playerId, companyId)
        )
            return []
        const construction = new TrackConstruction(state, this.rules)
        return this.rules.map.definition.locations.some(
            (location) => construction.choices(location.id).length
        )
            ? ['LayTile', 'FinishTrack']
            : ['FinishTrack']
    }
    enter(): void {}
    onAction(
        action: HydratedLayTile | HydratedFinishTrack,
        context: MachineContext<State>
    ): string {
        return isFinishTrack(action) ? this.nextState : context.gameState.machineState
    }
}
