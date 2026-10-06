import {
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { nextCompanyToFloat } from '../company/companyFlotation.js'
import type { CompanyRules } from '../company/companyRules.js'
import {
    HydratedRequestTrackConsent,
    HydratedRespondToTrackConsent
} from '../construction/trackConsent.js'
import { TrackConstruction, type TrackRules } from '../construction/trackConstruction.js'
import { controllingOwner } from '../finance/finance.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import {
    HydratedOfferPurchase,
    HydratedRespondToPurchaseOffer
} from '../transfers/offerPurchase.js'
import { purchaseOfferActions } from '../transfers/purchaseOffersHandler.js'
import { type TransferRules } from '../transfers/purchaseOffer.js'
import { HydratedBuyPrivateTrain, privateTrainPurchase } from './buyPrivateTrain.js'
import {
    pendingCompanyDecision,
    pendingDecisionPlayerId,
    privatePowerUsed,
    type CompanyDecisionState
} from './companyDecision.js'
import {
    HydratedDeclinePrivateTile,
    HydratedLayPrivateTile,
    HydratedLayPrivateTileOutOfTurn
} from './layPrivateTile.js'
import { HydratedPlacePrivateMarker } from './placePrivateMarker.js'
import { hasLegalPrivateTrackUse } from './privatePowerRequest.js'
import type { PrivatePowerRules } from './privatePowers.js'
import { HydratedDeclinePrivateStation, HydratedPlacePrivateStation } from './privateStation.js'
export function isCompanyDecisionAction(
    action: HydratedAction
): action is
    | HydratedOfferPurchase
    | HydratedRespondToPurchaseOffer
    | HydratedRequestTrackConsent
    | HydratedRespondToTrackConsent
    | HydratedLayPrivateTile
    | HydratedLayPrivateTileOutOfTurn
    | HydratedDeclinePrivateTile
    | HydratedPlacePrivateStation
    | HydratedDeclinePrivateStation
    | HydratedBuyPrivateTrain
    | HydratedPlacePrivateMarker {
    return (
        action instanceof HydratedOfferPurchase ||
        action instanceof HydratedRespondToPurchaseOffer ||
        action instanceof HydratedRequestTrackConsent ||
        action instanceof HydratedRespondToTrackConsent ||
        action instanceof HydratedLayPrivateTile ||
        action instanceof HydratedLayPrivateTileOutOfTurn ||
        action instanceof HydratedDeclinePrivateTile ||
        action instanceof HydratedPlacePrivateStation ||
        action instanceof HydratedDeclinePrivateStation ||
        action instanceof HydratedBuyPrivateTrain ||
        action instanceof HydratedPlacePrivateMarker
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
        private readonly track: TrackRules,
        private readonly outOfTurnPowers: boolean
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
        if (nextCompanyToFloat(state, this.companies)) return []
        if (!state.activePlayerIds.includes(playerId)) {
            if (pendingCompanyDecision(state)) return []
            const actions = this.handler.validActionsForPlayer(playerId, context)
            return this.offersOutOfTurnLay(state, playerId)
                ? [...actions, 'LayPrivateTileOutOfTurn']
                : actions
        }
        if (state.purchaseOffer)
            return purchaseOfferActions(state, playerId, this.transfers, this.trains)
        if (state.trackConsent)
            return state.trackConsent.details.consentPlayerId === playerId
                ? ['RespondToTrackConsent']
                : []
        if (state.privateTrackLay)
            return state.privateTrackLay.playerId === playerId
                ? ['LayPrivateTile', 'DeclinePrivateTile']
                : []
        if (state.privateStation)
            return state.privateStation.playerId === playerId
                ? ['PlacePrivateStation', 'DeclinePrivateStation']
                : []
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const companyId = this.transfers.operatingCompany(state)
        if (companyId && controllingOwner(state, companyId)?.playerId === playerId) {
            actions.push(...purchaseOfferActions(state, playerId, this.transfers, this.trains))
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
                !privatePowerUsed(state, company.id) &&
                this.powers.trackTerms(state, company.id, playerId)
            )
                actions.push('LayPrivateTile')
            if (this.powers.markerTerms?.(state, company.id, playerId)?.locationIds.length)
                actions.push('PlacePrivateMarker')
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
        const playerId = pendingDecisionPlayerId(state)
        if (playerId !== undefined) {
            state.activePlayerIds = [playerId]
            return
        }
        this.handler.enter(context)
    }
    private offersOutOfTurnLay(state: State, playerId: string): boolean {
        return (
            this.outOfTurnPowers &&
            state.machineState === 'StockRound' &&
            state.companies.some(
                (company) =>
                    company.kind === 'private' &&
                    !company.closed &&
                    !privatePowerUsed(state, company.id) &&
                    hasLegalPrivateTrackUse(state, company.id, playerId, this.powers, this.track)
            )
        )
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return isCompanyDecisionAction(action)
            ? context.gameState.phaseChange
                ? 'AdvancingPhase'
                : context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
