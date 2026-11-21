import type { EighteenUSAState, HydratedEighteenUSAState, TrainPower } from '@tabletop/18usa'
import {
    AssignTrainPower,
    BuyPullman,
    EighteenUSAAcquisitionRounds,
    EighteenUSABuyBacks,
    EighteenUSACompanyExcess,
    EighteenUSACompanyMarket,
    EighteenUSAConversionRounds,
    EighteenUSALoanRules,
    EighteenUSAShortSelling,
    EighteenUSAStations,
    EighteenUSATitleRules,
    PullmanScrapValue,
    PullmanTrainId,
    SaveTrain,
    ScrapPullman,
    TurnDenver,
    UpgradeOre,
    assignableTrains,
    denverRotations,
    oreUpgrades,
    pullmanPurchaseReason
} from '@tabletop/18usa'
import { assert, assertExists } from '@tabletop/common'
import { controllingOwner, trainsOwnedBy, type TileRotation, type Train } from '@tabletop/18xx'
import {
    SizedCompanySession,
    type CardAction,
    type SessionOptions,
    type TitleOperatingMode
} from '@tabletop/18xx-ui'
import { EighteenUSAMapView } from './mapView.js'
import { EighteenUSAPresentation } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

/** The title's own operating actions, each an entry in the operating mode switch. */
export const EighteenUSAModes = {
    pullman: { id: 'pullman', label: 'Pullman', shortLabel: 'Pullman' },
    ore: { id: 'ore', label: 'Upgrade ore', shortLabel: 'Ore' },
    denver: { id: 'denver', label: 'Turn Denver', shortLabel: 'Denver' },
    powers: { id: 'powers', label: 'Train powers', shortLabel: 'Powers' }
} as const satisfies Readonly<Record<string, TitleOperatingMode>>

/** A train a private's power may be given to for the run (P19, P30). */
export type TrainPowerChoice = { power: TrainPower; train: Train }

const PowerOrder: readonly TrainPower[] = ['double-heading', 'switcher']

export class EighteenUSASession extends SizedCompanySession<
    typeof EighteenUSAState,
    HydratedEighteenUSAState
> {
    constructor(options: SessionOptions<typeof EighteenUSAState, HydratedEighteenUSAState>) {
        super(options, {
            rules: EighteenUSATitleRules,
            mapView: EighteenUSAMapView,
            presentation: EighteenUSAPresentation,
            mechanisms: {
                market: EighteenUSACompanyMarket,
                stations: EighteenUSAStations,
                loanRules: EighteenUSALoanRules,
                conversionRounds: EighteenUSAConversionRounds,
                acquisitionRounds: EighteenUSAAcquisitionRounds,
                excess: EighteenUSACompanyExcess,
                shortSelling: EighteenUSAShortSelling,
                buyBacks: EighteenUSABuyBacks
            },
            createRouteWorker,
            corporateTitleActions: ['ScrapPullman']
        })
    }

    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }

    /** The company taking its operating turn, whose president the title's actions are for. */
    readonly operatingCompanyId = $derived.by(() => {
        const state = this.gameState
        return (
            state.trackStep?.companyId ??
            state.stationStep?.companyId ??
            state.routeStep?.companyId ??
            state.trainPurchaseStep?.companyId ??
            state.loanStep?.companyId
        )
    })
    private requireOperatingCompany(): string {
        const companyId = this.operatingCompanyId
        assertExists(companyId, 'A company is operating')
        return companyId
    }

    readonly canBuyPullman = $derived(this.can('BuyPullman'))
    readonly canScrapPullman = $derived(this.can('ScrapPullman'))
    /** Why the operating company may not buy a Pullman now, while it could at another time. */
    readonly pullmanUnavailable = $derived.by(() => {
        const companyId = this.operatingCompanyId
        return companyId && !this.canBuyPullman
            ? pullmanPurchaseReason(this.gameState, companyId)
            : undefined
    })
    readonly pullmanPrice = $derived(this.trainDepot.trainDefinition(PullmanTrainId).price)
    readonly ownedPullman = $derived.by(() => {
        const companyId = this.operatingCompanyId
        return companyId
            ? trainsOwnedBy(this.gameState, { kind: 'company', companyId }).find(
                  (train) => train.definitionId === PullmanTrainId
              )
            : undefined
    })
    async buyPullman(): Promise<void> {
        assert(this.canBuyPullman, 'The company may buy a Pullman')
        await this.applyAction(
            this.createPlayerAction(BuyPullman, { companyId: this.requireOperatingCompany() })
        )
    }
    async scrapPullman(companyId = this.requireOperatingCompany()): Promise<void> {
        assert(this.canScrapPullman, 'The company may scrap its Pullman')
        await this.applyAction(this.createPlayerAction(ScrapPullman, { companyId }))
    }

    /**
     * Scrapping a Pullman for a company the president acts for outside its operating turn: on a
     * stock turn, or deciding in the merger or acquisition round (§12.7).
     */
    readonly pullmanScrapActions = $derived.by((): Record<string, readonly CardAction[]> => {
        const state = this.gameState
        if (!this.canScrapPullman || this.operatingCompanyId) return {}
        const acting =
            state.machineState === 'StockRound'
                ? state.stockRound.turn.corporateAction?.companyId
                : (this.conversions.companyId ?? this.acquisitions.buyerLoans?.buyerId)
        if (state.machineState !== 'StockRound' && !acting) return {}
        const companyIds = state.companies.flatMap((company) =>
            company.kind !== 'private' &&
            !company.closed &&
            (!acting || company.id === acting) &&
            state.activePlayerIds.includes(controllingOwner(state, company.id)?.playerId ?? '') &&
            trainsOwnedBy(state, { kind: 'company', companyId: company.id }).some(
                (train) => train.definitionId === PullmanTrainId
            )
                ? [company.id]
                : []
        )
        return Object.fromEntries(
            companyIds.map((companyId) => [
                companyId,
                [
                    {
                        label: 'Scrap Pullman',
                        detail: this.presentation.money(PullmanScrapValue),
                        ariaLabel: `Scrap ${this.companyName(companyId)}’s Pullman for ${this.presentation.money(PullmanScrapValue)}`,
                        disabled: !this.canChooseAction,
                        onclick: () => void this.scrapPullman(companyId)
                    }
                ]
            ])
        )
    })

    /** The ore tokens the company may raise to $20 with a tile action (§13.3). */
    readonly oreUpgrades = $derived.by(() => {
        const companyId = this.operatingCompanyId
        return companyId && this.can('UpgradeOre') ? oreUpgrades(this.gameState, companyId) : []
    })
    async upgradeOre(locationId: string): Promise<void> {
        assert(
            this.oreUpgrades.some((entry) => entry.locationId === locationId),
            'The company may upgrade the ore there'
        )
        await this.applyAction(
            this.createPlayerAction(UpgradeOre, {
                companyId: this.requireOperatingCompany(),
                locationId
            })
        )
    }

    /** The ways Denver's metropolis tile may be turned by the first company to reach it (§12.2.3). */
    readonly denverRotations = $derived.by(() => {
        const companyId = this.operatingCompanyId
        return companyId && this.can('TurnDenver') ? denverRotations(this.gameState, companyId) : []
    })
    async turnDenver(rotation: TileRotation): Promise<void> {
        assert(this.denverRotations.includes(rotation), 'Denver may be turned that way')
        await this.applyAction(
            this.createPlayerAction(TurnDenver, {
                companyId: this.requireOperatingCompany(),
                rotation
            })
        )
    }

    /** The trains P30 Double Heading and P19 Union Switch & Signal may be given to (P19, P30). */
    readonly trainPowerChoices = $derived.by((): TrainPowerChoice[] => {
        const companyId = this.operatingCompanyId
        if (!companyId || !this.can('AssignTrainPower')) return []
        return PowerOrder.flatMap((power) =>
            assignableTrains(this.gameState, companyId, power).map((train) => ({ power, train }))
        )
    })
    async assignTrainPower({ power, train }: TrainPowerChoice): Promise<void> {
        assert(
            this.trainPowerChoices.some(
                (choice) => choice.power === power && choice.train.id === train.id
            ),
            'The power may go to that train'
        )
        await this.applyAction(
            this.createPlayerAction(AssignTrainPower, {
                companyId: this.requireOperatingCompany(),
                trainId: train.id,
                power
            })
        )
    }

    /** The rusting trains P13 Pennsy Boneyard's president may save one of (P13). */
    readonly boneyard = $derived(this.gameState.boneyard)
    readonly canSaveTrain = $derived(this.can('SaveTrain'))
    async saveTrain(trainId: string | undefined): Promise<void> {
        const boneyard = this.boneyard
        assertExists(boneyard, 'A rust waits on the Pennsy Boneyard')
        assert(this.canSaveTrain, 'The player may save a train')
        assert(
            trainId === undefined || boneyard.trainIds.includes(trainId),
            'Only a rusting train may be saved'
        )
        await this.applyAction(
            this.createPlayerAction(SaveTrain, {
                companyId: boneyard.companyId,
                ...(trainId ? { trainId } : {})
            })
        )
    }

    /** The name a train's card prints. */
    trainLabel(train: Train): string {
        return this.trainDepot.trainDefinition(train.definitionId).name
    }

    override get titleOperatingModes(): readonly TitleOperatingMode[] {
        return [
            ...(this.canBuyPullman || this.canScrapPullman ? [EighteenUSAModes.pullman] : []),
            ...(this.oreUpgrades.length ? [EighteenUSAModes.ore] : []),
            ...(this.denverRotations.length > 1 ? [EighteenUSAModes.denver] : []),
            ...(this.trainPowerChoices.length ? [EighteenUSAModes.powers] : [])
        ]
    }

    override get mapLocationChoice() {
        if (
            this.operatingMode.titleModeShown === EighteenUSAModes.ore.id &&
            this.oreUpgrades.length
        )
            return {
                locationIds: this.oreUpgrades.map((entry) => entry.locationId),
                choose: (locationId: string) => void this.upgradeOre(locationId)
            }
        return super.mapLocationChoice
    }
}

export function requireEighteenUSASession(session: unknown): EighteenUSASession {
    assert(session instanceof EighteenUSASession, 'Expected an 18USA session')
    return session
}
