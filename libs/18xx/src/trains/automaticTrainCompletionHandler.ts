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
import { FinishTrains, isFinishTrains } from './finishTrains.js'

export class AutomaticTrainCompletionHandler<
    State extends HydratedGameState & OperatingTurnState
> implements MachineStateHandler<HydratedAction, State> {
    // The train step ends the turn unless a later step follows it.
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly endsTurn = true
    ) {}

    private get finishType(): 'FinishOperatingTurn' | 'FinishTrains' {
        return this.endsTurn ? 'FinishOperatingTurn' : 'FinishTrains'
    }

    private canFinish(context: MachineContext<State>, playerId: string): boolean {
        const state = context.gameState
        const companyId = state.trainPurchaseStep?.companyId
        if (!companyId || controllingOwner(state, companyId)?.playerId !== playerId) return false
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return (
            actions.includes(this.finishType) &&
            !state.activePlayerIds.some((id) =>
                this.handler
                    .validActionsForPlayer(id, context)
                    .some((action) => action !== this.finishType)
            )
        )
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (
            (isFinishOperatingTurn(action) || isFinishTrains(action)) &&
            action.type === this.finishType &&
            action.source === ActionSource.System
        )
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
            context.addSystemAction(this.endsTurn ? FinishOperatingTurn : FinishTrains, {
                playerId,
                companyId
            })
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.handler.onAction(action, context)
    }
}
