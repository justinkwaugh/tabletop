import {
    AnswerMerger,
    BidStep,
    BuildToLondon,
    BuyStations,
    BuyWarranties,
    DeclineCharter,
    DecideOption,
    GoBankrupt,
    ObtainCharter,
    OpenCharterAuction,
    PassCharterBid,
    PlaceSmallStation,
    ProposeMerger,
    RaiseCharterBid,
    RedeemShare,
    Refinance,
    SellForFine,
    SellTreasuryShares,
    TitleRules1862,
    canBid,
    canBuildToLondon,
    canOpen,
    canRefinance,
    charterPars,
    charterShareChoices,
    charterableCompanies,
    deciderOf,
    fineSales,
    holderPlayer,
    mergedPrice,
    mergerDecision,
    mergerKind,
    mergerPartners,
    mustRaiseCash,
    parliamentDecision,
    redeemableShare,
    refinancingCapital,
    smallStationLines,
    SmallStationRevenue,
    stationCounts,
    trainWarranties,
    treasurySale,
    warrantyChoices,
    type HydratedState1862,
    type State1862
} from '@tabletop/1862'
import { RailwayMapState, withTrackStops, type TileEdge, type TrackStop } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import type { LocalSelection } from '@tabletop/frontend-components'
import {
    createEighteenXXSessionClass,
    placedTileLayout,
    type AwaitedDecision,
    type MapLocationChoice,
    type MapLocationFollowUpTile
} from '@tabletop/18xx-ui'
import { MapView1862 } from './mapView.js'
import { Presentation1862 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1862, HydratedState1862>
> = createEighteenXXSessionClass<typeof State1862, HydratedState1862>(
    TitleRules1862,
    MapView1862,
    Presentation1862,
    createRouteWorker
)

/** The flat map's sides, as players name them. */
const SideNames: Readonly<Record<TileEdge, string>> = {
    0: 'south',
    1: 'south-west',
    2: 'north-west',
    3: 'north',
    4: 'north-east',
    5: 'south-east'
}

export function lineName([a, b]: readonly [TileEdge, TileEdge]): string {
    return `${SideNames[a]} to ${SideNames[b]}`
}

export type BuildMode = 'small-station' | 'london' | 'merge'

/** A one-step choice made before an Action, which Undo or a new state backs out. */
function stagedChoice(isMade: () => boolean, clear: () => void): LocalSelection {
    return {
        hasManual: isMade,
        undo() {
            if (!isMade()) return false
            clear()
            return true
        },
        clear
    }
}

export class Session1862 extends BaseSession {
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        const choices: [() => boolean, () => void][] = [
            [
                () => this.selectedCharterCompany !== undefined,
                () => {
                    this.selectedCharterCompany = undefined
                    this.charterBid = 0
                }
            ],
            [() => this.raiseAmount !== undefined, () => (this.raiseAmount = undefined)],
            [() => this.charterPar !== undefined, () => (this.charterPar = undefined)],
            [() => this.mergerPartner !== undefined, () => (this.mergerPartner = undefined)],
            [() => this.smallStationLine !== undefined, () => (this.smallStationLine = undefined)],
            [
                () => this.smallStationLocation !== undefined,
                () => {
                    this.smallStationLocation = undefined
                    this.smallStationLine = undefined
                }
            ]
        ]
        for (const [isMade, clear] of choices)
            this.localSelections.register(stagedChoice(isMade, clear))
    }
    // Whether the decision is this player's, even while an Action of theirs is being sent or shown.
    private readonly deciding = $derived(this.isPlayable && this.isMyTurn && !this.isViewingHistory)
    readonly canChooseAction = $derived(this.deciding && !this.busy && !this.updatingVisibleState)
    private me = $derived(this.myPlayer?.id)
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }

    // Parliament (§4).
    readonly parliamentDecision = $derived(parliamentDecision(this.gameState))
    readonly charterableCompanyIds = $derived(
        this.gameState.parliament ? charterableCompanies(this.gameState) : []
    )
    readonly myParliamentTurn = $derived(
        !!this.me && this.parliamentDecision?.playerId === this.me && this.canChooseAction
    )
    readonly mayOpen = $derived(
        this.myParliamentTurn && !!this.me && canOpen(this.gameState, this.me)
    )
    selectedCharterCompany = $state<string>()
    charterBid = $state(0)
    mayBid(amount: number): boolean {
        return !!this.me && canBid(this.gameState, this.me, amount)
    }
    async openCharterAuction(): Promise<void> {
        assertExists(this.selectedCharterCompany, 'Choose a company to charter')
        await this.applyAction(
            this.createPlayerAction(OpenCharterAuction, {
                companyId: this.selectedCharterCompany,
                bid: this.charterBid
            })
        )
    }
    async declineCharter(): Promise<void> {
        await this.applyAction(this.createPlayerAction(DeclineCharter, {}))
    }
    raiseAmount = $state<number>()
    readonly minimumRaise = $derived(
        this.parliamentDecision?.kind === 'bid' ? this.parliamentDecision.bid + BidStep : 0
    )
    async raiseCharterBid(bid: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(RaiseCharterBid, { bid }))
    }
    async passCharterBid(): Promise<void> {
        await this.applyAction(this.createPlayerAction(PassCharterBid, {}))
    }
    readonly charterPars = $derived.by(() => {
        const decision = this.parliamentDecision
        return decision?.kind === 'charter' && this.me === decision.playerId
            ? charterPars(this.gameState, decision.playerId, decision.bid)
            : []
    })
    charterPar = $state<number>()
    charterShares(par: number): number[] {
        const decision = this.parliamentDecision
        return decision?.kind === 'charter'
            ? charterShareChoices(this.gameState, decision.playerId, decision.bid, par)
            : []
    }
    async obtainCharter(parPrice: number, extraShares: number): Promise<void> {
        const decision = this.parliamentDecision
        if (decision?.kind !== 'charter') return
        await this.applyAction(
            this.createPlayerAction(ObtainCharter, {
                companyId: decision.companyId,
                parPrice,
                extraShares
            })
        )
    }

    // Stations bought at flotation (§6.5.4.2).
    readonly stationCounts = $derived(
        this.gameState.stationPurchase
            ? stationCounts(this.gameState, this.gameState.stationPurchase)
            : []
    )
    async buyStations(count: number): Promise<void> {
        const companyId = this.gameState.stationPurchase
        assertExists(companyId, 'A company is buying stations')
        await this.applyAction(this.createPlayerAction(BuyStations, { companyId, count }))
    }

    // Fines for missed obligations (§4.3).
    readonly fineSales = $derived(
        this.me && this.gameState.fines?.[0]?.playerId === this.me
            ? fineSales(this.gameState, this.me)
            : []
    )
    async sellForFine(companyId: string, shares: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(SellForFine, { companyId, shares }))
    }

    // Mergers, acquisitions and options (§5, §7.5, §7.14).
    readonly mergerDecision = $derived(mergerDecision(this.gameState))
    readonly myMergerDecision = $derived(
        this.mergerDecision &&
            'playerId' in this.mergerDecision &&
            this.mergerDecision.playerId === this.me &&
            this.canChooseAction
            ? this.mergerDecision
            : undefined
    )
    async answerMerger(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerMerger, { accept }))
    }
    async decideOption(redeem: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(DecideOption, { redeem }))
    }
    /** The company that may merge or acquire now. */
    readonly mergingCompanyId = $derived(
        this.gameState.machineState === 'BuyingTrains'
            ? this.gameState.trainPurchaseStep?.companyId
            : this.gameState.trackStep?.companyId
    )
    readonly mergerKind = $derived(
        this.me && this.mergingCompanyId && this.can('ProposeMerger')
            ? mergerKind(this.gameState, this.me, this.mergingCompanyId)
            : undefined
    )
    readonly mergerPartners = $derived(
        this.mergerKind && this.mergingCompanyId
            ? mergerPartners(this.gameState, this.mergingCompanyId)
            : []
    )
    mergerPartner = $state<string>()
    /** The merged company's price with this partner (§7.5.3). */
    mergedPrice(partnerId: string): number | undefined {
        const companyId = this.mergingCompanyId
        return companyId ? mergedPrice(this.gameState, companyId, partnerId) : undefined
    }
    async proposeMerger(partnerId: string, survivorId: string): Promise<void> {
        const companyId = this.mergingCompanyId
        assertExists(companyId, 'A company is operating')
        await this.applyAction(
            this.createPlayerAction(ProposeMerger, { companyId, partnerId, survivorId })
        )
    }

    // A train-less company's funding, redemption and warranties (§7.10, §7.11, §7.13).
    readonly funding = $derived.by(() => {
        const companyId = this.gameState.trainPurchaseStep?.companyId
        if (!companyId || !this.canChooseAction || !mustRaiseCash(this.gameState, companyId))
            return undefined
        return {
            companyId,
            shares: treasurySale(this.gameState, companyId),
            refinance: canRefinance(this.gameState, companyId)
                ? refinancingCapital(this.gameState, companyId)
                : undefined,
            bankrupt: this.validActionTypes.includes('GoBankrupt')
        }
    })
    async sellTreasuryShares(companyId: string, shares: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(SellTreasuryShares, { companyId, shares }))
    }
    async refinance(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(Refinance, { companyId }))
    }
    async goBankrupt(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(GoBankrupt, { companyId }))
    }
    readonly redeemable = $derived.by(() => {
        const companyId = this.gameState.trainPurchaseStep?.companyId
        return companyId && this.me && this.can('RedeemShare')
            ? redeemableShare(this.gameState, this.me, companyId)
            : undefined
    })
    async redeemShare(): Promise<void> {
        const companyId = this.gameState.trainPurchaseStep?.companyId
        assertExists(companyId, 'A company is buying trains')
        assertExists(this.redeemable, 'A share can be redeemed')
        await this.applyAction(
            this.createPlayerAction(RedeemShare, {
                companyId,
                certificateId: this.redeemable.certificateId
            })
        )
    }
    /**
     * What a train bought this turn holds, and whether the company may buy it one more. The offer
     * stands while an Action is being sent, so the row keeps its button, disabled, between presses.
     */
    warranties(trainId: string): { held: number; lapsing: boolean; offered: boolean } {
        const train = this.gameState.trainInventory.trains.find((train) => train.id === trainId)
        assertExists(train, 'A train bought this turn is in the inventory')
        const { count, lapsing } = trainWarranties(this.gameState, train)
        return {
            held: count,
            lapsing,
            offered:
                this.deciding &&
                this.validActionTypes.includes('BuyWarranties') &&
                warrantyChoices(this.gameState, trainId).includes(1)
        }
    }
    async buyWarranty(trainId: string): Promise<void> {
        const companyId = this.gameState.trainPurchaseStep?.companyId
        assertExists(companyId, 'A company is buying trains')
        await this.applyAction(
            this.createPlayerAction(BuyWarranties, { companyId, trainId, count: 1 })
        )
    }

    // Small stations and London links, in place of track (§7.6.4, §7.6.5).
    readonly smallStationLines = $derived(
        this.can('PlaceSmallStation') ? smallStationLines(this.gameState) : {}
    )
    readonly canBuildToLondon = $derived(
        !!this.me &&
            !!this.gameState.trackStep &&
            this.can('BuildToLondon') &&
            canBuildToLondon(this.gameState, this.me, this.gameState.trackStep.companyId)
    )
    smallStationLocation = $state<string>()
    smallStationLine = $state<string>()
    async placeSmallStation(
        locationId: string,
        edges: readonly [TileEdge, TileEdge]
    ): Promise<void> {
        const companyId = this.gameState.trackStep?.companyId
        assertExists(companyId, 'A company is building')
        await this.applyAction(
            this.createPlayerAction(PlaceSmallStation, { companyId, locationId, edges: [...edges] })
        )
    }
    async buildToLondon(): Promise<void> {
        const companyId = this.gameState.trackStep?.companyId
        assertExists(companyId, 'A company is building')
        await this.applyAction(this.createPlayerAction(BuildToLondon, { companyId }))
    }

    override get titleOperatingModes() {
        if (this.gameState.machineState !== 'LayingTrack') return []
        return [
            ...(Object.keys(this.smallStationLines).length
                ? [{ id: 'small-station', label: 'Small station', shortLabel: 'Small' }]
                : []),
            ...(this.canBuildToLondon
                ? [{ id: 'london', label: 'London link', shortLabel: 'London' }]
                : []),
            ...(this.mergerKind === 'merge' && this.mergerPartners.length
                ? [{ id: 'merge', label: 'Merge', shortLabel: 'Merge' }]
                : [])
        ]
    }

    override get mapLocationChoice(): MapLocationChoice | undefined {
        const lines = this.smallStationLines
        if (this.operatingMode.titleModeShown !== 'small-station' || !Object.keys(lines).length)
            return super.mapLocationChoice
        const locationId = this.smallStationLocation
        const open = locationId ? lines[locationId] : undefined
        const options = open?.map((line) => ({
            id: line.join(),
            label: lineName(line),
            tile: locationId ? this.smallStationPreview(locationId, line) : undefined
        }))
        const clear = () => {
            this.smallStationLocation = undefined
            this.smallStationLine = undefined
        }
        return {
            locationIds: Object.keys(lines),
            choose: (chosenId) => {
                const choices = lines[chosenId]
                if (choices?.length === 1) void this.placeSmallStation(chosenId, choices[0])
                else if (chosenId === locationId && options?.length) {
                    // Tapping the chosen hex again moves the station to its next line.
                    const at = options.findIndex((option) => option.id === this.smallStationLine)
                    this.smallStationLine = options[(at + 1) % options.length].id
                } else {
                    this.smallStationLocation = chosenId
                    this.smallStationLine = undefined
                }
            },
            followUp:
                locationId && open && options
                    ? {
                          locationId,
                          label: 'Which line takes the station?',
                          options,
                          selected: this.smallStationLine,
                          select: (id) => (this.smallStationLine = id),
                          choose: (id) => {
                              const line = open.find((entry) => entry.join() === id)
                              assertExists(line, 'The chosen line is open')
                              clear()
                              void this.placeSmallStation(locationId, line)
                          },
                          cancel: clear
                      }
                    : undefined
        }
    }

    /** The hex's tile as it would look with a small station on the line (§7.6.4). */
    private smallStationPreview(
        locationId: string,
        line: readonly [TileEdge, TileEdge]
    ): MapLocationFollowUpTile {
        const tile = new RailwayMapState(
            this.mapView.map,
            this.mapView.tileSet,
            this.gameState.tileInventory
        ).tile(locationId)
        const stop: TrackStop = { edges: [line[0], line[1]], revenue: SmallStationRevenue }
        const placement = tile.placement
        if (!placement) return { face: withTrackStops(tile.face, [stop], 0), rotation: 0 }
        const definition = this.mapView.tileSet.definitions.find(
            (candidate) => candidate.id === placement.definitionId
        )
        assertExists(definition, 'A placed tile has a definition')
        return {
            face: withTrackStops(
                definition.face,
                [...(placement.trackStops ?? []), stop],
                placement.rotation
            ),
            rotation: placement.rotation,
            layout: placedTileLayout(this.mapView.layouts, placement.definitionId)
        }
    }

    protected override titleAwaitedDecision(state: HydratedState1862): AwaitedDecision | undefined {
        const name = (playerId: string) => this.getPlayerName(playerId)
        const parliament = parliamentDecision(state)
        if (parliament)
            return {
                title: 'Parliament',
                text:
                    parliament.kind === 'charter'
                        ? `${name(parliament.playerId)} sets the par of ${this.companyName(parliament.companyId)}`
                        : parliament.kind === 'bid'
                          ? `${name(parliament.playerId)} may raise the bid for ${this.companyName(parliament.companyId)}`
                          : `${name(parliament.playerId)} may petition for a charter`
            }
        if (state.stationPurchase) {
            const playerId = deciderOf(state, state.stationPurchase)
            return {
                title: 'Stations',
                companyId: state.stationPurchase,
                text: `${playerId ? name(playerId) : 'The director'} chooses how many stations ${this.companyName(state.stationPurchase)} buys`
            }
        }
        const fine = state.fines?.[0]
        if (fine)
            return {
                title: 'Fine',
                text: `${name(fine.playerId)} sells shares to pay a fine of ${this.presentation.money(fine.amount)}`
            }
        const merger = mergerDecision(state)
        if (merger?.kind === 'answer' && state.mergerProposal)
            return {
                title: 'Merger',
                companyId: state.mergerProposal.partnerId,
                text: `${name(merger.playerId)} decides whether ${this.companyName(state.mergerProposal.partnerId)} merges with ${this.companyName(state.mergerProposal.companyId)}`
            }
        if (merger?.kind === 'option' && state.shareMerge?.option)
            return {
                title: 'Option share',
                companyId: state.shareMerge.survivorId,
                text: `${name(holderPlayer(state.shareMerge, state.shareMerge.option.holder))} redeems or gives up an option share`
            }
        return undefined
    }
}
