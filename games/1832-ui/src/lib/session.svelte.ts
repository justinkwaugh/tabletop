import {
    BuyCoalRights,
    EighteenThirtyTwoTitleRules,
    PlaceRevenueToken,
    TakeLondonShare,
    londonShareChoices,
    revenueTokenChoices,
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

type TokenPrivate = { kind: 'port' | 'cotton'; privateCompanyId: string; name: string }
const TokenPrivates: readonly TokenPrivate[] = [
    { kind: 'port', privateCompanyId: 'P3', name: 'Port' },
    { kind: 'cotton', privateCompanyId: 'P2', name: 'Cotton' }
]

export class EighteenThirtyTwoSession extends BaseSession {
    // A chosen hex with several cities for a Port or Cotton token, awaiting its city; a new state
    // clears it.
    pendingTokenLocation = $derived.by(
        (): Pick<RevenueTokenChoice, 'kind' | 'locationId'> | undefined => {
            void this.gameState.actionCount
            void this.gameState.machineState
            return undefined
        }
    )
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register({
            hasManual: () => !!this.pendingTokenLocation,
            undo: () => {
                if (!this.pendingTokenLocation) return false
                this.pendingTokenLocation = undefined
                return true
            },
            clear: () => {
                this.pendingTokenLocation = undefined
            }
        })
    }
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
    readonly tokenCityChoices = $derived.by(() => {
        const pending = this.pendingTokenLocation
        return pending
            ? this.revenueTokenChoices.filter(
                  (choice) =>
                      choice.kind === pending.kind && choice.locationId === pending.locationId
              )
            : []
    })
    readonly canBuyCoalRights = $derived(
        this.canChooseAction && this.validActionTypes.includes('BuyCoalRights')
    )
    readonly londonChoices = $derived(
        this.myPlayer && !this.isViewingHistory
            ? londonShareChoices(this.gameState, this.myPlayer.id)
            : []
    )
    protected override get titlePrivatePowers(): readonly TitlePrivatePower[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return TokenPrivates.flatMap(({ kind, privateCompanyId, name }): TitlePrivatePower[] => {
            const choices = this.revenueTokenChoices.filter((choice) => choice.kind === kind)
            if (!choices.length) return []
            return [
                {
                    kind: 'location',
                    privateCompanyId,
                    playerId,
                    label: `${name} token`,
                    prompt: `Choose a ${kind === 'port' ? 'coastal' : 'non-coastal'} city for the ${name} token`,
                    locationIds: [...new Set(choices.map((choice) => choice.locationId))],
                    choose: (locationId) => this.chooseTokenLocation(kind, locationId)
                }
            ]
        })
    }
    private async chooseTokenLocation(kind: 'port' | 'cotton', locationId: string) {
        const cities = this.revenueTokenChoices.filter(
            (choice) => choice.kind === kind && choice.locationId === locationId
        )
        if (cities.length === 1) await this.placeRevenueToken(cities[0])
        else this.pendingTokenLocation = { kind, locationId }
    }
    async placeRevenueToken(choice: RevenueTokenChoice): Promise<void> {
        this.pendingTokenLocation = undefined
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
    protected override projectMapState(state: HydratedEighteenThirtyTwoState): HistoricalMapState {
        return mapState1832(state)
    }
}
