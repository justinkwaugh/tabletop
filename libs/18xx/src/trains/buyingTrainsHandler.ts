import type { PhaseState } from '../phases/phaseChange.js'
import {
    isFinishOperatingTurn,
    finishOperatingTurnReason,
    type HydratedFinishOperatingTurn,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'
import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isBuyTrain, type HydratedBuyTrain } from './buyTrain.js'
import { TrainPurchase, type TrainRules } from './trainPurchase.js'
type State = HydratedGameState & OperatingTurnState & PhaseState
export class BuyingTrainsHandler implements MachineStateHandler<
    HydratedBuyTrain | HydratedFinishOperatingTurn,
    State
> {
    constructor(private readonly rules: TrainRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            action.source !== ActionSource.User ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId) ||
            (!isBuyTrain(action) && !isFinishOperatingTurn(action))
        )
            return false
        const purchase = new TrainPurchase(state, this.rules)
        return (
            purchase.canAct(action.playerId, action.companyId) &&
            (isFinishOperatingTurn(action)
                ? !finishOperatingTurnReason(state, this.rules, action.companyId)
                : purchase.evaluate(action).details?.price === action.expectedPrice)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const companyId = state.trainPurchaseStep?.companyId
        const purchase = new TrainPurchase(state, this.rules)
        if (
            !companyId ||
            !state.activePlayerIds.includes(playerId) ||
            !purchase.canAct(playerId, companyId)
        )
            return []
        return [
            ...(purchase.offers().some((offer) => offer.evaluation.details) ||
            purchase.marketOffers().some((offer) => offer.details) ||
            purchase.exchanges().length
                ? ['BuyTrain']
                : []),
            ...(!finishOperatingTurnReason(state, this.rules, companyId)
                ? ['FinishOperatingTurn']
                : [])
        ]
    }

    enter(): void {}
    onAction(
        action: HydratedBuyTrain | HydratedFinishOperatingTurn,
        context: MachineContext<State>
    ): string {
        return isFinishOperatingTurn(action)
            ? 'OperatingSet'
            : context.gameState.phaseChange
              ? 'AdvancingPhase'
              : context.gameState.machineState
    }
}
