import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isBuyTrain, type HydratedBuyTrain } from './buyTrain.js'
import { TrainPurchase, type TrainRules } from './trainPurchase.js'
import type { TrainPurchaseState } from './train.js'
type State = HydratedGameState & TrainPurchaseState
export class BuyingTrainsHandler implements MachineStateHandler<HydratedBuyTrain, State> {
    constructor(private readonly rules: TrainRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            action.source !== ActionSource.User ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId) ||
            !isBuyTrain(action)
        )
            return false
        const purchase = new TrainPurchase(state, this.rules)
        return (
            purchase.canAct(action.playerId, action.companyId) &&
            purchase.evaluate(action).details?.price === action.expectedPrice
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const companyId = state.trainPurchaseStep?.companyId
        const purchase = new TrainPurchase(state, this.rules)
        return companyId &&
            state.activePlayerIds.includes(playerId) &&
            purchase.canAct(playerId, companyId) &&
            purchase.offers().some((offer) => offer.evaluation.details)
            ? ['BuyTrain']
            : []
    }
    enter(): void {}
    onAction(_action: HydratedBuyTrain, context: MachineContext<State>): string {
        return context.gameState.machineState
    }
}
