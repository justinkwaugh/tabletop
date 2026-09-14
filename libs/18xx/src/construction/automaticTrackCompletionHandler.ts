import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import { FinishTrack, isFinishTrack } from './finishTrack.js'
import type { ConstructionState } from './trackConstruction.js'

export class AutomaticTrackCompletionHandler<
    State extends HydratedGameState & ConstructionState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, State>) {}

    private canFinish(context: MachineContext<State>, playerId: string): boolean {
        const state = context.gameState
        const step = state.trackStep
        if (!step || step.completed || !step.lays.length ||
            controllingOwner(state, step.companyId)?.playerId !== playerId) return false
        const actions = this.handler.validActionsForPlayer(playerId, context)
        if (!actions.includes('FinishTrack')) return false
        return !state.activePlayerIds.some((id) =>
            (id === playerId ? actions : this.handler.validActionsForPlayer(id, context)).some((action) =>
                ['LayTile', 'LayPrivateTile', 'RequestTrackConsent'].includes(action)))
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (isFinishTrack(action) && action.source === ActionSource.System)
            return action.companyId === context.gameState.trackStep?.companyId &&
                this.canFinish(context, action.playerId)
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }

    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
        const companyId = context.gameState.trackStep?.companyId
        const playerId = companyId && controllingOwner(context.gameState, companyId)?.playerId
        if (companyId && playerId && this.canFinish(context, playerId))
            context.addSystemAction(FinishTrack, { playerId, companyId })
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.handler.onAction(action, context)
    }
}
