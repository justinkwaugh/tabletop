import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { isLayTile, type HydratedLayTile } from './layTile.js'
import { isFinishTrack, type HydratedFinishTrack } from './finishTrack.js'
import { TrackConstruction, type TrackRules, type ConstructionState } from './trackConstruction.js'

type State = HydratedGameState & ConstructionState & OperatingState
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
        if (isFinishTrack(action)) return true
        const details = construction.evaluate(action).details
        return (
            details?.cost === action.expectedCost &&
            (!details.consentPlayerId || details.consentPlayerId === action.playerId)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const companyId = state.trackStep?.companyId
        if (!companyId || !state.activePlayerIds.includes(playerId)) return []
        const construction = new TrackConstruction(state, this.rules)
        if (
            !construction.canAct(playerId, companyId)
        )
            return []
        return this.rules.map.definition.locations.some((location) =>
            construction
                .choices(location.id)
                .some((choice) => !choice.consentPlayerId || choice.consentPlayerId === playerId)
        )
            ? ['LayTile', 'FinishTrack']
            : ['FinishTrack']
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        if (state.trackStep) return
        const companyId = nextOperatingCompany(state)
        assertExists(companyId, 'Step entry requires an operating company')
        state.trackStep = { companyId, lays: [], completed: false }
    }
    onAction(
        action: HydratedLayTile | HydratedFinishTrack,
        context: MachineContext<State>
    ): string {
        return isFinishTrack(action) ? this.nextState : context.gameState.machineState
    }
}
