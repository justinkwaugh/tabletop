import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { FinishStockTurn, isFinishStockTurn } from './finishStockTurn.js'
import type { StockState } from './stockState.js'

export class AutomaticStockTurnHandler<
    State extends HydratedGameState & StockState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, State>) {}

    private canFinish(context: MachineContext<State>, playerId: string): boolean {
        const state = context.gameState
        if (state.stockRound.completed || state.turnManager.currentTurn()?.playerId !== playerId)
            return false
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return actions.length === 1 && actions[0] === 'FinishStockTurn'
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (isFinishStockTurn(action) && action.source === ActionSource.System)
            return this.canFinish(context, action.playerId)
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }

    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
        const playerId = context.gameState.turnManager.currentTurn()?.playerId
        if (playerId && this.canFinish(context, playerId))
            context.addSystemAction(FinishStockTurn, { playerId })
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.handler.onAction(action, context)
    }
}
