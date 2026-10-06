import {
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import type { CompanyDecisionState } from '../privates/companyDecision.js'
import { controllingOwner } from '../finance/finance.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { HydratedOfferPurchase, HydratedRespondToPurchaseOffer } from './offerPurchase.js'
import { purchaseChoices } from './purchaseChoices.js'
import type { TransferRules } from './purchaseOffer.js'

export function purchaseOfferActions(
    state: CompanyDecisionState,
    playerId: string,
    rules: TransferRules,
    trains: TrainRules
): string[] {
    if (!state.activePlayerIds.includes(playerId)) return []
    if (state.purchaseOffer)
        return state.purchaseOffer.sellerPlayerId === playerId ? ['RespondToPurchaseOffer'] : []
    return purchaseChoices(state, playerId, rules, trains).length ? ['OfferPurchase'] : []
}

export class PurchaseOffersHandler<
    State extends HydratedGameState & CompanyDecisionState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: TransferRules,
        private readonly trains: TrainRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (
            action instanceof HydratedOfferPurchase ||
            action instanceof HydratedRespondToPurchaseOffer
        )
            return action.isValid(context.gameState)
        return !context.gameState.purchaseOffer && this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const purchases = purchaseOfferActions(context.gameState, playerId, this.rules, this.trains)
        return context.gameState.purchaseOffer
            ? purchases
            : [...this.handler.validActionsForPlayer(playerId, context), ...purchases]
    }
    enter(context: MachineContext<State>): void {
        if (context.gameState.purchaseOffer) {
            context.gameState.activePlayerIds = [context.gameState.purchaseOffer.sellerPlayerId]
            return
        }
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        if (
            action instanceof HydratedOfferPurchase ||
            action instanceof HydratedRespondToPurchaseOffer
        ) {
            if (!context.gameState.purchaseOffer) {
                const companyId = this.rules.operatingCompany(context.gameState)
                assertExists(companyId, 'The purchase resumes its operating company')
                const owner = controllingOwner(context.gameState, companyId)
                assertExists(owner, 'The operating company requires its controlling owner')
                context.gameState.activePlayerIds = [owner.playerId]
            }
            return context.gameState.machineState
        }
        return this.handler.onAction(action, context)
    }
}
