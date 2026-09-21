import type { HydratedAction, MachineContext } from '@tabletop/common'
import type { EighteenXXStateHandler, HydratedEighteenXXState } from '@tabletop/18xx'
import { TheOldPrinceBranchSplit } from './branchSplit.js'
import { HydratedSplitCompany } from './splitCompany.js'

export class TheOldPrinceStockRoundHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        return action instanceof HydratedSplitCompany
            ? action.isValid(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const split = new TheOldPrinceBranchSplit(context.gameState)
        if (split.branches().length && split.parents(playerId).some((parent) => !parent.reason))
            actions.push('SplitCompany')
        return actions
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return action instanceof HydratedSplitCompany
            ? 'StockRound'
            : this.handler.onAction(action, context)
    }
}
