import {
    AnswerMerger,
    AnswerRedemption,
    DiscardMergedTrain,
    MergingState,
    PassMerger,
    ProposeMerger,
    SellTakeoverShares,
    discardableMergedTrains,
    mergerDecision,
    mergerOptions,
    systemMarketSpace,
    systemPresident,
    takeoverPayments,
    takeoverSales,
    type MergerOption,
    BuyCoalRights,
    ConsentingRedemptionState,
    DeclineProtection,
    EighteenThirtyTwoTitleRules,
    PlaceRevenueToken,
    ProtectShares,
    ProtectingPriceState,
    RedeemShare,
    ReissueShares,
    protectionDecision,
    redemptionChoices,
    reissueChoices,
    RevenueTokenPrivateIds,
    TakeLondonShare,
    londonShareCompanies,
    revenueTokenChoices,
    revenueTokenUnplaced,
    type EighteenThirtyTwoState,
    type HydratedEighteenThirtyTwoState,
    type RedemptionChoice,
    type ReissueChoice,
    type RevenueTokenChoice
} from '@tabletop/1832'
import { assertExists } from '@tabletop/common'
import {
    controllingOwner,
    getCompany,
    stockMarketSpace,
    type ShareSaleDetails
} from '@tabletop/18xx'
import {
    createEighteenXXSessionClass,
    type HistoricalMapState,
    type TitlePrivatePower
} from '@tabletop/18xx-ui'
import { mapState1832 } from './mapState.js'
import { EighteenThirtyTwoMapView } from './mapView.js'
import { EighteenThirtyTwoPresentation } from './presentation.js'
import { PrivateOperatingPowers } from './privatePowers.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<
        typeof EighteenThirtyTwoState,
        HydratedEighteenThirtyTwoState
    >
> = createEighteenXXSessionClass<typeof EighteenThirtyTwoState, HydratedEighteenThirtyTwoState>(
    EighteenThirtyTwoTitleRules,
    EighteenThirtyTwoMapView,
    EighteenThirtyTwoPresentation
)

const TokenPrivates = [
    { kind: 'port', name: 'Port' },
    { kind: 'cotton', name: 'Cotton' }
] as const

/** What a president may do for one company in place of their own stock action (§5.3). */
export type CompanyShareOptions = {
    companyId: string
    redemptions: RedemptionChoice[]
    reissue?: ReissueChoice
}

export class EighteenThirtyTwoSession extends BaseSession {
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    readonly stockPanels = this.titleStockPanels<'company'>([
        {
            id: 'company',
            label: 'Act for a company',
            available: () => this.companyShareOptions.length > 0
        }
    ])
    readonly companyShareOptions = $derived.by((): CompanyShareOptions[] => {
        const playerId = this.gameState.activePlayerIds[0]
        if (
            !playerId ||
            !(
                this.validActionTypes.includes('RedeemShare') ||
                this.validActionTypes.includes('ReissueShares')
            )
        )
            return []
        const redemptions = redemptionChoices(this.gameState, playerId)
        const reissues = reissueChoices(this.gameState, playerId)
        const companyIds = [
            ...new Set([...redemptions, ...reissues].map((choice) => choice.companyId))
        ]
        return companyIds.map((companyId) => {
            const reissue = reissues.find((choice) => choice.companyId === companyId)
            return {
                companyId,
                redemptions: redemptions.filter((choice) => choice.companyId === companyId),
                ...(reissue ? { reissue } : {})
            }
        })
    })
    /** The merger phase's open decision, and who makes it. */
    readonly mergerDecision = $derived(
        this.gameState.machineState === MergingState ? mergerDecision(this.gameState) : undefined
    )
    readonly myMergerDecision = $derived(
        this.mergerDecision &&
            this.canChooseAction &&
            this.mergerDecision.playerId === this.myPlayer?.id
            ? this.mergerDecision
            : undefined
    )
    /** The mergers the player may propose, with what each would cost or make. */
    readonly mergerProposals = $derived.by(() => {
        const decision = this.myMergerDecision
        if (decision?.kind !== 'propose') return []
        return mergerOptions(this.gameState, decision.playerId).map((option) =>
            this.describeMerger(option, decision.playerId)
        )
    })
    /** The proposals grouped by the pair of companies they would merge. */
    readonly mergerPairings = $derived.by(() => {
        const keys = [
            ...new Set(
                this.mergerProposals.map(({ option }) => `${option.companyId}|${option.partnerId}`)
            )
        ]
        return keys.map((key) => {
            const proposals = this.mergerProposals.filter(
                ({ option }) => `${option.companyId}|${option.partnerId}` === key
            )
            const [{ option }] = proposals
            return { companyId: option.companyId, partnerId: option.partnerId, proposals }
        })
    })
    /** The proposal the player is asked to answer, with what it would cost or make. */
    readonly mergerAnswer = $derived.by(() => {
        const decision = this.myMergerDecision
        if (decision?.kind !== 'answer') return undefined
        return this.describeMerger(decision.proposal, decision.proposal.proposerPlayerId)
    })
    /** The sales the buyer's president may make toward a takeover, and what remains to raise. */
    readonly takeoverFunding = $derived.by(() => {
        const decision = this.myMergerDecision
        const funding = this.gameState.mergerPhase?.funding
        if (decision?.kind !== 'fund' || !funding) return undefined
        return {
            ...funding,
            sales: takeoverSales(this.gameState, funding.playerId, funding.targetId)
        }
    })
    readonly mergedTrainDiscards = $derived(
        this.myMergerDecision?.kind === 'discard'
            ? discardableMergedTrains(this.gameState, this.myMergerDecision.playerId)
            : []
    )
    private describeMerger(option: MergerOption, proposerPlayerId: string) {
        const partnerPresident = controllingOwner(this.gameState, option.partnerId)?.playerId
        assertExists(partnerPresident, 'A merger partner has a president')
        const initiator = option.yielded ? partnerPresident : proposerPlayerId
        if (option.kind === 'system') {
            const companyIds = [option.companyId, option.partnerId]
            const president = systemPresident(this.gameState, companyIds, initiator)
            assertExists(president, 'A System has a president')
            return {
                kind: 'system' as const,
                option,
                proposerPlayerId,
                initiator,
                president,
                price: systemMarketSpace(this.gameState.stockMarket, companyIds).price
            }
        }
        const [buyerId, targetId] = option.yielded
            ? [option.partnerId, option.companyId]
            : [option.companyId, option.partnerId]
        return {
            kind: 'takeover' as const,
            option,
            proposerPlayerId,
            initiator,
            buyerId,
            targetId,
            price: takeoverPayments(this.gameState, buyerId, targetId).reduce(
                (total, payment) => total + payment.amount,
                0
            )
        }
    }
    async proposeMerger(option: MergerOption): Promise<void> {
        await this.applyAction(this.createPlayerAction(ProposeMerger, option))
    }
    async passMerger(): Promise<void> {
        await this.applyAction(this.createPlayerAction(PassMerger, {}))
    }
    async answerMerger(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerMerger, { accept }))
    }
    async sellTakeoverShares(sale: ShareSaleDetails): Promise<void> {
        const [{ companyId, shares }] = sale.sales
        await this.applyAction(this.createPlayerAction(SellTakeoverShares, { companyId, shares }))
    }
    async discardMergedTrain(trainId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(DiscardMergedTrain, { trainId }))
    }
    /** A redemption awaiting a holder's consent. */
    readonly redemptionPrompt = $derived.by(() => {
        const request = this.gameState.redemptionRequest
        if (this.gameState.machineState !== ConsentingRedemptionState || !request) return undefined
        return { ...request, companyName: getCompany(this.gameState, request.companyId).name }
    })
    readonly canAnswerRedemption = $derived(
        this.canChooseAction && this.validActionTypes.includes('AnswerRedemption')
    )
    readonly revenueTokenChoices = $derived(
        this.myPlayer && !this.isViewingHistory
            ? revenueTokenChoices(this.gameState, this.myPlayer.id)
            : []
    )
    readonly keyWestChoice = $derived(
        this.revenueTokenChoices.find((choice) => choice.kind === 'key-west')
    )
    readonly canBuyCoalRights = $derived(
        this.canChooseAction && this.validActionTypes.includes('BuyCoalRights')
    )
    readonly londonCompanies = $derived(
        this.myPlayer && this.canChooseAction
            ? londonShareCompanies(this.gameState, this.myPlayer.id)
            : []
    )
    /** The sale whose president is deciding whether to protect its price, and its terms. */
    readonly protectionPrompt = $derived.by(() => {
        const record = this.gameState.priceProtection
        const decision =
            this.gameState.machineState === ProtectingPriceState
                ? protectionDecision(this.gameState)
                : undefined
        if (!record || !decision) return undefined
        return {
            ...decision.sale,
            sellerPlayerId: record.sellerPlayerId,
            presidentPlayerId: decision.playerId,
            restoredPrice: stockMarketSpace(
                this.gameState.stockMarket,
                decision.sale.fromMarketSpaceId
            ).price
        }
    })
    readonly canDecideProtection = $derived(
        this.canChooseAction && this.validActionTypes.includes('ProtectShares')
    )
    /** What a private lets its owning company do, while that power remains to be used. */
    privateOperationDescription(privateCompanyId: string): string | undefined {
        return revenueTokenUnplaced(this.gameState, privateCompanyId)
            ? PrivateOperatingPowers[privateCompanyId]
            : undefined
    }
    protected override get titlePrivatePowers(): readonly TitlePrivatePower[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return TokenPrivates.flatMap(({ kind, name }): TitlePrivatePower[] => {
            const choices = this.revenueTokenChoices.filter((choice) => choice.kind === kind)
            if (!choices.length) return []
            return [
                {
                    kind: 'location',
                    privateCompanyId: RevenueTokenPrivateIds[kind],
                    playerId,
                    label: `${name} token`,
                    prompt: `Choose a ${kind === 'port' ? 'coastal' : 'non-coastal'} city for the ${name} token`,
                    locationIds: [...new Set(choices.map((choice) => choice.locationId))],
                    choose: (locationId, nodeId) => this.chooseTokenCity(kind, locationId, nodeId)
                }
            ]
        })
    }
    // In a hex with several cities, such as Atlanta, the city clicked is the choice.
    private async chooseTokenCity(
        kind: 'port' | 'cotton',
        locationId: string,
        nodeId: string | undefined
    ) {
        const cities = this.revenueTokenChoices.filter(
            (choice) => choice.kind === kind && choice.locationId === locationId
        )
        const choice =
            cities.length === 1 ? cities[0] : cities.find((city) => city.nodeId === nodeId)
        if (choice) await this.placeRevenueToken(choice)
    }
    async placeRevenueToken(choice: RevenueTokenChoice): Promise<void> {
        await this.applyAction(this.createPlayerAction(PlaceRevenueToken, choice))
    }
    async buyCoalRights(): Promise<void> {
        const companyId = this.gameState.trackStep?.companyId
        assertExists(companyId, 'WVCF tokens are bought in the track step')
        await this.applyAction(this.createPlayerAction(BuyCoalRights, { companyId }))
    }
    async takeLondonShare(certificateId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(TakeLondonShare, { certificateId }))
    }
    async redeemShare(choice: RedemptionChoice): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(RedeemShare, {
                companyId: choice.companyId,
                certificateId: choice.certificateId
            })
        )
    }
    async answerRedemption(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerRedemption, { accept }))
    }
    async reissueShares(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(ReissueShares, { companyId }))
    }
    async protectShares(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(ProtectShares, { companyId }))
    }
    async declineProtection(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(DeclineProtection, { companyId }))
    }
    protected override projectMapState(state: HydratedEighteenThirtyTwoState): HistoricalMapState {
        return mapState1832(state)
    }
}
