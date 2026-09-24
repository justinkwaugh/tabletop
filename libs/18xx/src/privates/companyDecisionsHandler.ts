import { TrackConstruction, type TrackRules } from '../construction/trackConstruction.js'
import { purchaseChoices } from '../transfers/purchaseChoices.js'
import {
    assert,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { nextCompanyToFloat } from '../company/companyFlotation.js'
import type { CompanyRules } from '../company/companyRules.js'
import { controllingOwner } from '../finance/finance.js'
import { type TransferRules } from '../transfers/purchaseOffer.js'
import {
    HydratedOfferPurchase,
    HydratedRespondToPurchaseOffer
} from '../transfers/offerPurchase.js'
import {
    HydratedRequestTrackConsent,
    HydratedRespondToTrackConsent
} from '../construction/trackConsent.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { HydratedLayPrivateTile, HydratedDeclinePrivateTile } from './layPrivateTile.js'
import { HydratedBuyPrivateTrain, privateTrainPurchase } from './buyPrivateTrain.js'
import { pendingCompanyDecision, type CompanyDecisionState } from './companyDecision.js'
import type { PrivatePowerRules } from './privatePowers.js'
export function isCompanyDecisionAction(
    action: HydratedAction
): action is
    | HydratedOfferPurchase
    | HydratedRespondToPurchaseOffer
    | HydratedRequestTrackConsent
    | HydratedRespondToTrackConsent
    | HydratedLayPrivateTile
    | HydratedDeclinePrivateTile
    | HydratedBuyPrivateTrain {
    return (
        action instanceof HydratedOfferPurchase ||
        action instanceof HydratedRespondToPurchaseOffer ||
        action instanceof HydratedRequestTrackConsent ||
        action instanceof HydratedRespondToTrackConsent ||
        action instanceof HydratedLayPrivateTile ||
        action instanceof HydratedDeclinePrivateTile ||
        action instanceof HydratedBuyPrivateTrain
    )
}
export class CompanyDecisionsHandler<
    State extends HydratedGameState & CompanyDecisionState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly transfers: TransferRules,
        private readonly powers: PrivatePowerRules,
        private readonly trains: TrainRules,
        private readonly companies: CompanyRules,
        private readonly track: TrackRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (isCompanyDecisionAction(action))
            return (
                !nextCompanyToFloat(context.gameState, this.companies) &&
                action.isValid(context.gameState)
            )
        return (
            !pendingCompanyDecision(context.gameState) &&
            this.handler.isValidAction(action, context)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        if (!state.activePlayerIds.includes(playerId) || nextCompanyToFloat(state, this.companies))
            return []
        if (state.purchaseOffer)
            return state.purchaseOffer.sellerPlayerId === playerId ? ['RespondToPurchaseOffer'] : []
        if (state.trackConsent)
            return state.trackConsent.details.consentPlayerId === playerId
                ? ['RespondToTrackConsent']
                : []
        if (state.privateTrackLay)
            return state.privateTrackLay.playerId === playerId
                ? ['LayPrivateTile', 'DeclinePrivateTile']
                : []
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const companyId = this.transfers.operatingCompany(state)
        if (companyId && controllingOwner(state, companyId)?.playerId === playerId) {
            if (purchaseChoices(state, playerId, this.transfers, this.trains).length)
                actions.push('OfferPurchase')
            if (state.machineState === 'LayingTrack' && this.track.consentPlayerId) {
                const construction = new TrackConstruction(state, this.track)
                if (
                    this.track.map.definition.locations.some((location) =>
                        construction
                            .choices(location.id)
                            .some(
                                (choice) =>
                                    choice.consentPlayerId && choice.consentPlayerId !== playerId
                            )
                    )
                )
                    actions.push('RequestTrackConsent')
            }
        }
        for (const company of state.companies.filter(
            (company) => company.kind === 'private' && !company.closed
        )) {
            if (
                !state.usedPrivatePowerIds.includes(company.id) &&
                this.powers.trackTerms(state, company.id, playerId)
            )
                actions.push('LayPrivateTile')
            const buyer = this.powers.earlyTrainCompany(state, company.id, playerId)
            if (
                buyer &&
                privateTrainPurchase(state, buyer, this.trains)
                    .offers()
                    .some((offer) => offer.evaluation.details)
            )
                actions.push('BuyPrivateTrain')
        }
        return [...new Set(actions)]
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const playerId =
            state.purchaseOffer?.sellerPlayerId ??
            state.privateTrackLay?.playerId ??
            state.trackConsent?.details.consentPlayerId
        if (pendingCompanyDecision(state)) {
            assert(playerId, 'A pending decision requires its player')
            state.activePlayerIds = [playerId]
            return
        }
        this.handler.enter(context)
        if (nextCompanyToFloat(state, this.companies)) return
        for (const player of state.players) {
            if (state.activePlayerIds.includes(player.playerId)) continue
            if (
                state.companies.some(
                    (company) =>
                        company.kind === 'private' &&
                        !company.closed &&
                        !state.usedPrivatePowerIds.includes(company.id) &&
                        this.powers.trackTerms(state, company.id, player.playerId)
                )
            )
                state.activePlayerIds.push(player.playerId)
        }
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return isCompanyDecisionAction(action)
            ? context.gameState.phaseChange
                ? 'AdvancingPhase'
                : context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
