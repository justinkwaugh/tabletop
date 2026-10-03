import { assert, assertExists } from '@tabletop/common'
import {
    BuyPrivateTrain,
    ContinueOperatingRound,
    DeclinePrivateTile,
    LayPrivateTile,
    LayPrivateTileOutOfTurn,
    OfferPurchase,
    PlacePrivateMarker,
    RespondToPurchaseOffer,
    RespondToTrackConsent,
    cashOwnedBy,
    evaluatePrivateTrack,
    evaluatePurchaseOffer,
    pendingCompanyDecision,
    privateTrackConstruction,
    privateTrainPurchase,
    purchaseChoices,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type PurchaseOfferRequest,
    type TrackLayDetails,
    type TrainPurchaseDetails
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type PrivateTileOption = {
    privateCompanyId: string
    playerId: string
    details: TrackLayDetails
}
export type PrivateTrainOption = { privateCompanyId: string; details: TrainPurchaseDetails }
export type PrivateMarkerOption = {
    privateCompanyId: string
    playerId: string
    kind: string
    locationId: string
}
export type CompanyDecision =
    | { kind: 'purchase'; request: PurchaseOfferRequest }
    | ({ kind: 'tile' } & PrivateTileOption)
    | ({ kind: 'train' } & PrivateTrainOption)

type CompanyDecisionsState = Parameters<typeof purchaseChoices>[0] &
    Parameters<typeof evaluatePurchaseOffer>[0] &
    Parameters<typeof evaluatePrivateTrack>[0] &
    Parameters<typeof privateTrackConstruction>[0] &
    Parameters<typeof privateTrainPurchase>[0] &
    Parameters<typeof pendingCompanyDecision>[0] &
    Pick<
        EighteenXXState,
        | 'purchaseOffer'
        | 'trackConsent'
        | 'privateTrackLay'
        | 'privatePowerWindow'
        | 'usedPrivatePowerIds'
        | 'machineState'
    >

export type CompanyDecisionsSession = ModuleSession<
    CompanyDecisionsState,
    Pick<
        EighteenXXTitleRules,
        | 'transferRules'
        | 'trainRules'
        | 'trackRules'
        | 'privatePowerRules'
        | 'outOfTurnPrivatePowers'
    >
>

export class CompanyDecisionsModule {
    readonly choice = singleChoice<CompanyDecision>()
    constructor(private readonly session: CompanyDecisionsSession) {}

    selection = $derived.by(() =>
        this.session.selectionsVisible ? this.choice.value('choice') : undefined
    )
    canResolve = $derived.by(() => this.session.interactive)
    purchaseOptions = $derived.by(() =>
        this.canResolve &&
        this.session.playerId &&
        this.session.validActionTypes.includes('OfferPurchase')
            ? purchaseChoices(
                  this.session.state,
                  this.session.playerId,
                  this.session.rules.transferRules,
                  this.session.rules.trainRules
              )
            : []
    )
    privatePurchases = $derived.by(() =>
        this.purchaseOptions.filter((option) => option.request.asset.kind === 'private')
    )
    players = $derived.by(() => {
        if (!this.canResolve) return []
        const { state, rules } = this.session
        const active = this.session.actingPlayerIds.filter((playerId) =>
            state.activePlayerIds.includes(playerId)
        )
        const offTurn =
            rules.outOfTurnPrivatePowers && state.machineState === 'StockRound'
                ? state.players
                      .map((player) => player.playerId)
                      .filter(
                          (playerId) =>
                              !state.activePlayerIds.includes(playerId) &&
                              this.session.canActFor(playerId)
                      )
                : []
        return [...active, ...offTurn]
    })
    privateTileOptions = $derived.by((): PrivateTileOption[] => {
        const { state, rules } = this.session
        if (state.purchaseOffer || state.trackConsent) return []
        return this.players.flatMap((playerId) =>
            state.companies
                .filter(
                    (company) =>
                        company.kind === 'private' &&
                        !company.closed &&
                        !state.usedPrivatePowerIds.includes(company.id)
                )
                .flatMap((company) => {
                    const terms = rules.privatePowerRules.trackTerms(state, company.id, playerId)
                    if (!terms) return []
                    const construction = privateTrackConstruction(state, terms, rules.trackRules)
                    return terms.locationIds.flatMap((locationId) =>
                        construction
                            .choices(locationId)
                            .map((details) => ({ privateCompanyId: company.id, playerId, details }))
                    )
                })
        )
    })
    privateMarkerOptions = $derived.by((): PrivateMarkerOption[] => {
        const { state, rules } = this.session
        if (pendingCompanyDecision(state)) return []
        return this.players.flatMap((playerId) =>
            state.companies
                .filter((company) => company.kind === 'private' && !company.closed)
                .flatMap((company) => {
                    const terms = rules.privatePowerRules.markerTerms?.(state, company.id, playerId)
                    if (!terms) return []
                    return terms.locationIds.map((locationId) => ({
                        privateCompanyId: company.id,
                        playerId,
                        kind: terms.kind,
                        locationId
                    }))
                })
        )
    })
    privateTrainOptions = $derived.by((): PrivateTrainOption[] => {
        const { state, rules, playerId } = this.session
        if (!this.canResolve || !playerId || pendingCompanyDecision(state)) return []
        return state.companies.flatMap((company) => {
            const companyId = rules.privatePowerRules.earlyTrainCompany(state, company.id, playerId)
            return companyId
                ? privateTrainPurchase(state, companyId, rules.trainRules)
                      .offers()
                      .flatMap((offer) =>
                          offer.evaluation.details
                              ? [
                                    {
                                        privateCompanyId: company.id,
                                        details: offer.evaluation.details
                                    }
                                ]
                              : []
                      )
                : []
        })
    })
    purchaseOfferEvaluation = $derived.by(() =>
        this.selection?.kind === 'purchase'
            ? evaluatePurchaseOffer(
                  this.session.state,
                  this.selection.request,
                  this.session.rules.transferRules,
                  this.session.rules.trainRules
              )
            : undefined
    )

    privatePurchasePriceRange(companyId: string, privateCompanyId: string) {
        return this.session.rules.transferRules.priceRange(this.session.state, companyId, {
            kind: 'private',
            privateCompanyId
        })
    }
    selectPurchaseOffer(request: PurchaseOfferRequest) {
        assert(
            this.canResolve && this.session.validActionTypes.includes('OfferPurchase'),
            'Purchasing is unavailable'
        )
        let price = request.price
        if (request.asset.kind === 'private') {
            const range = this.session.rules.transferRules.priceRange(
                this.session.state,
                request.companyId,
                request.asset
            )
            assertExists(range, 'Private purchase requires a price range')
            const cash = cashOwnedBy(this.session.state, {
                kind: 'company',
                companyId: request.companyId
            })
            assert(typeof cash === 'number', 'Purchasing company requires a cash balance')
            price = Math.min(cash, range.maximum ?? cash)
        }
        this.choice.choose('choice', { kind: 'purchase', request: { ...request, price } })
    }
    setPurchasePrice(price: number) {
        const decision = this.choice.value('choice')
        assert(decision?.kind === 'purchase', 'Select an asset first')
        this.choice.choose('choice', { kind: 'purchase', request: { ...decision.request, price } })
    }
    selectPrivateTile(option: PrivateTileOption) {
        const { state, rules } = this.session
        assert(
            this.players.includes(option.playerId) &&
                evaluatePrivateTrack(
                    state,
                    option.privateCompanyId,
                    option.playerId,
                    option.details,
                    rules.privatePowerRules,
                    rules.trackRules
                ).details,
            'Choose an available private tile lay'
        )
        this.choice.choose('choice', { kind: 'tile', ...option })
    }
    selectPrivateTrain(option: PrivateTrainOption) {
        assert(
            this.privateTrainOptions.some(
                (item) =>
                    item.privateCompanyId === option.privateCompanyId &&
                    item.details.trainId === option.details.trainId
            ),
            'Choose an available private train purchase'
        )
        this.choice.choose('choice', { kind: 'train', ...option })
    }
    back() {
        this.choice.clear()
    }
    async buyPrivateTrain(option: PrivateTrainOption) {
        this.selectPrivateTrain(option)
        await this.confirm()
    }
    async confirm() {
        const decision = this.selection
        assert(this.canResolve && decision, 'Choose a company decision')
        if (decision.kind === 'purchase') {
            assert(
                this.purchaseOfferEvaluation && !this.purchaseOfferEvaluation.reason,
                'This offer is unavailable'
            )
            await this.session.applyAction(
                this.session.createPlayerAction(OfferPurchase, decision.request)
            )
        } else if (decision.kind === 'tile') {
            const { companyId, locationId, definitionId, rotation, nodeMapping, cost } =
                decision.details
            assert(
                this.players.includes(decision.playerId),
                'Only the entitled player may lay this tile'
            )
            const lay = {
                privateCompanyId: decision.privateCompanyId,
                companyId,
                locationId,
                definitionId,
                rotation,
                nodeMapping,
                expectedCost: cost
            }
            const action = this.session.state.activePlayerIds.includes(decision.playerId)
                ? this.session.createPlayerAction(LayPrivateTile, lay)
                : this.session.createPlayerAction(LayPrivateTileOutOfTurn, {
                      ...lay,
                      outOfTurn: true,
                      sequenced: true
                  })
            action.playerId = decision.playerId
            await this.session.applyAction(action)
        } else {
            const { companyId, trainId, definitionId, price } = decision.details
            await this.session.applyAction(
                this.session.createPlayerAction(BuyPrivateTrain, {
                    privateCompanyId: decision.privateCompanyId,
                    companyId,
                    trainId,
                    definitionId,
                    expectedPrice: price
                })
            )
        }
    }
    async respondToPurchaseOffer(accept: boolean) {
        const offer = this.session.state.purchaseOffer
        assert(
            this.canResolve &&
                this.session.validActionTypes.includes('RespondToPurchaseOffer') &&
                offer,
            'No offer is awaiting this player'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(RespondToPurchaseOffer, { offerId: offer.id, accept })
        )
    }
    async respondToTrackConsent(accept: boolean) {
        const request = this.session.state.trackConsent
        assert(
            this.canResolve &&
                this.session.validActionTypes.includes('RespondToTrackConsent') &&
                request,
            'No permission request is awaiting this player'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(RespondToTrackConsent, {
                requestId: request.id,
                accept
            })
        )
    }
    async continueOperatingRound() {
        const window = this.session.state.privatePowerWindow
        assert(
            this.canResolve &&
                this.session.validActionTypes.includes('ContinueOperatingRound') &&
                window,
            'No private power window awaits this player'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(ContinueOperatingRound, { companyId: window.companyId })
        )
    }
    async placePrivateMarker(option: PrivateMarkerOption) {
        assert(
            this.privateMarkerOptions.some(
                (listed) =>
                    listed.privateCompanyId === option.privateCompanyId &&
                    listed.locationId === option.locationId
            ),
            'This private cannot mark that location now'
        )
        const action = this.session.createPlayerAction(PlacePrivateMarker, {
            privateCompanyId: option.privateCompanyId,
            locationId: option.locationId
        })
        action.playerId = option.playerId
        await this.session.applyAction(action)
    }
    async declinePrivateTile() {
        const lay = this.session.state.privateTrackLay
        assert(
            this.canResolve && this.session.validActionTypes.includes('DeclinePrivateTile') && lay,
            'No private tile lay is awaiting this player'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(DeclinePrivateTile, {
                privateCompanyId: lay.privateCompanyId
            })
        )
    }
}
