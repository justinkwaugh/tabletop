import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import type { CompanyDecisionState } from './companyDecision.js'
import type { PrivatePowerRules } from './privatePowers.js'
import {
    HydratedSetPrivatePowerRequest,
    hasPrivatePowerRequest,
    isSetPrivatePowerRequest,
    requestablePrivateIds
} from './privatePowerRequest.js'

export class PrivatePowerRequestHandler<
    State extends HydratedGameState & CompanyDecisionState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly powers: PrivatePowerRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (action instanceof HydratedSetPrivatePowerRequest)
            return action.isValid(context.gameState)
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const state = context.gameState
        return hasPrivatePowerRequest(state, playerId) ||
            requestablePrivateIds(state, playerId, this.powers).length
            ? [...actions, 'SetPrivatePowerRequest']
            : actions
    }
    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return isSetPrivatePowerRequest(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
