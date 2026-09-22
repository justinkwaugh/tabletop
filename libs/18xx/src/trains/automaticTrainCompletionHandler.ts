import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import {
    FinishOperatingTurn,
    isFinishOperatingTurn,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'

export class AutomaticTrainCompletionHandler<
    State extends HydratedGameState & OperatingTurnState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, State>) {}

    private canFinish(context: MachineContext<State>, playerId: string): boolean {
        const state = context.gameState
        const companyId = state.trainPurchaseStep?.companyId
        if (!companyId || controllingOwner(state, companyId)?.playerId !== playerId) return false
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return (
            actions.includes('FinishOperatingTurn') &&
            !state.activePlayerIds.some((id) =>
                this.handler
                    .validActionsForPlayer(id, context)
                    .some((action) => action !== 'FinishOperatingTurn')
            )
        )
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (isFinishOperatingTurn(action) && action.source === ActionSource.System)
            return (
                action.companyId === context.gameState.trainPurchaseStep?.companyId &&
                this.canFinish(context, action.playerId)
            )
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }

    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
        const companyId = context.gameState.trainPurchaseStep?.companyId
        const playerId = companyId && controllingOwner(context.gameState, companyId)?.playerId
        if (companyId && playerId && this.canFinish(context, playerId))
            context.addSystemAction(FinishOperatingTurn, { playerId, companyId })
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.handler.onAction(action, context)
    }
}
