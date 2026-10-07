import {
    BuyCoalRights,
    DeclineProtection,
    EighteenThirtyTwoTitleRules,
    PlaceRevenueToken,
    ProtectShares,
    ProtectingPriceState,
    protectionDecision,
    RevenueTokenPrivateIds,
    TakeLondonShare,
    londonShareCompanies,
    revenueTokenChoices,
    revenueTokenUnplaced,
    type EighteenThirtyTwoState,
    type HydratedEighteenThirtyTwoState,
    type RevenueTokenChoice
} from '@tabletop/1832'
import { assertExists } from '@tabletop/common'
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

export class EighteenThirtyTwoSession extends BaseSession {
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
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
    /** The sale whose president is deciding whether to protect its price, and that president. */
    readonly priceProtection = $derived(
        this.gameState.machineState === ProtectingPriceState
            ? protectionDecision(this.gameState)
            : undefined
    )
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
