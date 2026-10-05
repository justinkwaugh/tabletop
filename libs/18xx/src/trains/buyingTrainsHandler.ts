import { nextOperatingCompany } from '../operating/operatingSet.js'
import {
    EmergencyTrainFunding,
    type FundingState,
    type TrainFundingRules
} from '../funding/trainFunding.js'
import { HydratedFundTrain } from '../funding/fundTrain.js'
import type { StockRules } from '../stock/stockRules.js'
import type { PhaseState } from '../phases/phaseChange.js'
import {
    isFinishOperatingTurn,
    finishOperatingTurnReason,
    type FinishOperatingTurn,
    type HydratedFinishOperatingTurn,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'
import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isBuyTrain, type HydratedBuyTrain } from './buyTrain.js'
import { isFinishTrains, type FinishTrains, type HydratedFinishTrains } from './finishTrains.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import { TrainPurchase, type TrainRules } from './trainPurchase.js'
type State = HydratedGameState & OperatingTurnState & Pick<PhaseState, 'phaseChange'>
export class OrdinaryBuyingTrainsHandler<S extends State = State> implements MachineStateHandler<
    HydratedBuyTrain | HydratedFinishOperatingTurn | HydratedFinishTrains,
    S
> {
    constructor(
        protected readonly rules: TrainRules,
        private readonly nextState: string
    ) {}
    private get finishType(): 'FinishOperatingTurn' | 'FinishTrains' {
        return this.nextState === BetweenCompaniesState ? 'FinishOperatingTurn' : 'FinishTrains'
    }
    private isFinish(
        action: HydratedAction
    ): action is HydratedAction & (FinishOperatingTurn | FinishTrains) {
        return this.finishType === 'FinishTrains'
            ? isFinishTrains(action)
            : isFinishOperatingTurn(action)
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        const state = context.gameState
        if (
            action.source !== ActionSource.User ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId) ||
            (!isBuyTrain(action) && !this.isFinish(action))
        )
            return false
        const purchase = new TrainPurchase(state, this.rules)
        return isBuyTrain(action)
            ? purchase.canAct(action.playerId, action.companyId) &&
                  purchase.evaluate(action).details?.price === action.expectedPrice
            : purchase.canAct(action.playerId, action.companyId) &&
                  !finishOperatingTurnReason(state, this.rules, action.companyId)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
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
            ...(!finishOperatingTurnReason(state, this.rules, companyId) ? [this.finishType] : [])
        ]
    }

    enter(context: MachineContext<S>): void {
        const state = context.gameState
        const operatingCompanyId = nextOperatingCompany(state)
        assertExists(operatingCompanyId, 'Step entry requires an operating company')
        if (!state.trainPurchaseStep) {
            state.trainPurchaseStep = { companyId: operatingCompanyId, purchasedTrainIds: [] }
        }
    }
    onAction(
        action: HydratedBuyTrain | HydratedFinishOperatingTurn | HydratedFinishTrains,
        context: MachineContext<S>
    ): string {
        return this.isFinish(action)
            ? this.nextState
            : context.gameState.phaseChange
              ? 'AdvancingPhase'
              : context.gameState.machineState
    }
}

export class BuyingTrainsHandler extends OrdinaryBuyingTrainsHandler<State & FundingState> {
    constructor(
        rules: TrainRules,
        private readonly fundingRules: TrainFundingRules,
        private readonly stocks: StockRules,
        nextState: string
    ) {
        super(rules, nextState)
    }
    override isValidAction(
        action: HydratedAction,
        context: MachineContext<State & FundingState>
    ): boolean {
        return action instanceof HydratedFundTrain
            ? action.isValid(context.gameState)
            : super.isValidAction(action, context)
    }
    override validActionsForPlayer(
        playerId: string,
        context: MachineContext<State & FundingState>
    ): string[] {
        const actions = super.validActionsForPlayer(playerId, context)
        const state = context.gameState
        const companyId = state.trainPurchaseStep?.companyId
        if (
            companyId &&
            state.activePlayerIds.includes(playerId) &&
            new TrainPurchase(state, this.rules).canAct(playerId, companyId) &&
            new EmergencyTrainFunding(state, this.fundingRules, this.stocks, this.rules).purchases()
                .length
        )
            return ['FundTrain', ...actions]
        return actions
    }
    override onAction(
        action:
            | HydratedBuyTrain
            | HydratedFinishOperatingTurn
            | HydratedFinishTrains
            | HydratedFundTrain,
        context: MachineContext<State & FundingState>
    ): string {
        return action instanceof HydratedFundTrain
            ? 'FundingTrain'
            : super.onAction(action, context)
    }
}
