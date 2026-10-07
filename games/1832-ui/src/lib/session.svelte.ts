import {
    AnswerRedemption,
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
import { companyMarketSpace, getCompany, stockMarketSpace } from '@tabletop/18xx'
import {
    TitleStockPanels,
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
export type CompanyShareActions = {
    companyId: string
    redemptions: RedemptionChoice[]
    reissue?: ReissueChoice
}

export class EighteenThirtyTwoSession extends BaseSession {
    readonly stockPanels = new TitleStockPanels<'company'>(this.stock, [
        {
            id: 'company',
            available: () => this.companyShareActions.length > 0,
            held: () => !!this.gameState.stockRound.turn.corporateAction
        }
    ])
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(this.stockPanels, 'first')
    }
    override get additionalStockMenuCount() {
        return this.stockPanels.count
    }
    protected override onStockSelectionCancelled() {
        this.stockPanels.clear()
    }
    readonly companyShareActions = $derived.by((): CompanyShareActions[] => {
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
    /** A redemption awaiting a holder's consent, with its price. */
    readonly redemptionPrompt = $derived.by(() => {
        const request = this.gameState.redemptionRequest
        if (this.gameState.machineState !== ConsentingRedemptionState || !request) return undefined
        const certificate = this.gameState.certificates.find(
            (item) => item.id === request.certificateId
        )
        assertExists(certificate, 'A redemption request names a share')
        const shares = certificate.kind === 'share' ? certificate.shares : 1
        return {
            ...request,
            companyName: getCompany(this.gameState, request.companyId).name,
            price: companyMarketSpace(this.gameState.stockMarket, request.companyId).price * shares
        }
    })
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
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
