import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isBuyShares, type HydratedBuyShares } from './buyShares.js'
import {
    evaluateSharePurchase,
    type SharePurchaseRules,
    type SharePurchaseState
} from './sharePurchase.js'

type State = HydratedGameState & SharePurchaseState
export class BuyingShares implements MachineStateHandler<HydratedBuyShares, State> {
    constructor(
        private readonly rules: SharePurchaseRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return (
            isBuyShares(action) &&
            action.source === ActionSource.User &&
            action.expectedPrice ===
                evaluateSharePurchase(context.gameState, action, this.rules).details?.price
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        for (const buyer of this.rules.buyers(state, playerId)) {
            if (
                state.certificates.some(
                    (certificate) =>
                        evaluateSharePurchase(
                            state,
                            { playerId, buyer, certificateId: certificate.id },
                            this.rules
                        ).details
                )
            )
                return ['BuyShares']
        }
        return []
    }
    enter(_context: MachineContext<State>): void {}
    onAction(_action: HydratedBuyShares, context: MachineContext<State>): string {
        context.gameState.turnManager.endTurn(context.gameState.actionCount)
        return this.nextState
    }
}
