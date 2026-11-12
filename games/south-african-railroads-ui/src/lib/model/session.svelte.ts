import type { AuctionParticipant } from '@tabletop/common'
import { GameSession, undoableStagedSelection } from '@tabletop/frontend-components'
import {
    ActionBox,
    AuctionKind,
    BuildConnection,
    BuildTrack,
    ChooseAction,
    DeclineOffer,
    DelegateBuild,
    Develop,
    FinishDevelopment,
    FoundSpecialConnection,
    LeaveTown,
    MachineState,
    OfferShare,
    PassBid,
    PlaceBid,
    HydratedSarGameState,
    homeLinks,
    type IncomeGain,
    type HydratedSarPlayerState,
    type RailroadId,
    type SarGameState
} from '@tabletop/south-african-railroads'
import {
    BuildStageOrder,
    SettlementStageOrder,
    selectBuildRailroad,
    selectFirstLink,
    selectSettlement,
    type BuildSelection,
    type SettlementSelection
} from './selection.js'

export type DevelopTarget = { settlementId: string; cost: number; gains: IncomeGain[] }

export type AuctionView = {
    railroadId: RailroadId
    kind: AuctionKind
    sellerId: string | undefined
    openerId: string | undefined
    minimum: number
    seats: AuctionParticipant[]
    currentBidderId: string | undefined
    smallestBid: number
    upcomingOfferings: RailroadId[]
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<SarGameState, HydratedSarGameState>
>[0]

export class SarGameSession extends GameSession<SarGameState, HydratedSarGameState> {
    private buildSelection: BuildSelection = $state({})
    private settlementSelection: SettlementSelection = $state({})

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                BuildStageOrder,
                () => this.buildSelection,
                (selection) => (this.buildSelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection(
                SettlementStageOrder,
                () => this.settlementSelection,
                (selection) => (this.settlementSelection = selection)
            )
        )
    }

    rulesOpen = $state(false)

    toggleRules() {
        this.rulesOpen = !this.rulesOpen
    }

    closeRules() {
        this.rulesOpen = false
    }

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && !this.gameState.result)

    private actingIn(...states: MachineState[]): boolean {
        return this.canAct && states.includes(this.gameState.machineState)
    }

    selectableBoxes: ActionBox[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.actingIn(MachineState.ChoosingAction)
            ? this.gameState.availableBoxes(playerId)
            : []
    })

    // Boxes the turn player may choose that would pay dividends at once, shown to every viewer.
    dividendBoxes: ActionBox[] = $derived.by(() => {
        const state = this.gameState
        if (state.machineState !== MachineState.ChoosingAction || state.result) {
            return []
        }
        return state
            .availableBoxes(state.turnPlayerId())
            .filter((box) => state.triggersDividends(box))
    })

    // Every locomotive starts in Construct Track, but the boxes show a player only once they have
    // chosen a first action.
    placedPlayers: HydratedSarPlayerState[] = $derived.by(() => {
        const turnManager = this.gameState.turnManager
        const actingPlayerId =
            this.gameState.machineState === MachineState.ChoosingAction
                ? undefined
                : turnManager.currentTurn()?.playerId
        return this.gameState.players.filter(
            (player) =>
                turnManager.turnCount(player.playerId) > 0 || player.playerId === actingPlayerId
        )
    })

    private building = $derived(
        this.actingIn(MachineState.ConstructingTrack, MachineState.DelegatedBuild)
    )

    delegating = $derived(
        this.building &&
            this.gameState.machineState === MachineState.ConstructingTrack &&
            this.myPlayerId !== undefined &&
            this.gameState.ownBuildableRailroads(this.myPlayerId).length === 0
    )

    buildRailroadOptions: RailroadId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.building || !playerId) {
            return []
        }
        return this.delegating
            ? this.gameState.buildableRailroads()
            : this.gameState.builderRailroads(playerId)
    })

    // A lone option counts as an automatic choice, so Undo steps straight past it.
    selectedRailroad: RailroadId | undefined = $derived.by(() => {
        const options = this.buildRailroadOptions
        const chosen = this.buildSelection.railroad?.value
        if (chosen && options.includes(chosen)) {
            return chosen
        }
        return !this.delegating && options.length === 1 ? options[0] : undefined
    })

    railroadChoices: RailroadId[] = $derived(
        this.delegating || this.buildRailroadOptions.length > 1 ? this.buildRailroadOptions : []
    )

    delegateBuilders: string[] = $derived(
        this.delegating && this.selectedRailroad
            ? this.gameState.controllers(this.selectedRailroad)
            : []
    )

    firstLink: string | undefined = $derived(
        this.selectedRailroad && !this.delegating ? this.buildSelection.firstLink?.value : undefined
    )

    // The game as it stands once the staged first link of a double build is laid, so incomes and
    // dividends show what the build would do.
    shownState: HydratedSarGameState = $derived.by(() => {
        const railroadId = this.selectedRailroad
        const linkId = this.firstLink
        if (!railroadId || !linkId) {
            return this.gameState
        }
        const preview = new HydratedSarGameState(structuredClone(this.gameState.dehydrate()))
        preview.track.push({ linkId, railroadId })
        return preview
    })

    private doubleStarts: Map<string, string[]> = $derived.by(() => {
        const railroadId = this.selectedRailroad
        const starts = new Map<string, string[]>()
        if (!railroadId || this.delegating) {
            return starts
        }
        for (const [first, second] of this.gameState.doubleBuilds(railroadId)) {
            starts.set(first, [...(starts.get(first) ?? []), second])
        }
        return starts
    })

    linkTargets: string[] = $derived.by(() => {
        const due = this.gameState.freeBuild
        if (due && this.actingIn(MachineState.FreeBuild) && due.playerId === this.myPlayerId) {
            return homeLinks(this.gameState, this.gameState.map.home(due.railroadId))
        }
        const railroadId = this.selectedRailroad
        if (!railroadId || this.delegating) {
            return []
        }
        const first = this.firstLink
        return first
            ? (this.doubleStarts.get(first) ?? [])
            : this.gameState.singleBuilds(railroadId)
    })

    connectionTargets: string[] = $derived(
        this.selectedRailroad && !this.delegating && !this.firstLink
            ? this.gameState
                  .connectionBuilds(this.selectedRailroad)
                  .map((connection) => connection.id)
            : []
    )

    specialConnectionPartners: RailroadId[] = $derived(
        this.selectedRailroad && !this.delegating && !this.firstLink
            ? this.gameState.specialConnectionPartners(this.selectedRailroad)
            : []
    )

    async foundSpecialConnection(partnerId: RailroadId) {
        const railroadId = this.selectedRailroad
        if (railroadId && this.specialConnectionPartners.includes(partnerId)) {
            await this.applyAction(
                this.createPlayerAction(FoundSpecialConnection, { railroadId, partnerId })
            )
        }
    }

    buildingRailroad: RailroadId | undefined = $derived(
        this.actingIn(MachineState.FreeBuild)
            ? this.gameState.freeBuild?.railroadId
            : this.delegating
              ? undefined
              : this.selectedRailroad
    )

    selectRailroad(railroadId: RailroadId) {
        if (!this.buildRailroadOptions.includes(railroadId)) {
            return
        }
        if (this.delegating) {
            const builders = this.gameState.controllers(railroadId)
            if (builders.length === 1) {
                void this.delegateBuild(railroadId, builders[0])
                return
            }
        }
        this.buildSelection = selectBuildRailroad(this.buildSelection, railroadId)
    }

    async clickLink(linkId: string) {
        if (!this.linkTargets.includes(linkId)) {
            return
        }
        const due = this.gameState.freeBuild
        if (due && this.actingIn(MachineState.FreeBuild)) {
            await this.buildTrack(due.railroadId, [linkId])
            return
        }
        const railroadId = this.selectedRailroad
        if (!railroadId) {
            return
        }
        const first = this.firstLink
        if (first) {
            await this.buildTrack(railroadId, [first, linkId])
            return
        }
        if (this.doubleStarts.has(linkId)) {
            this.buildSelection = selectFirstLink(this.buildSelection, linkId)
            return
        }
        await this.buildTrack(railroadId, [linkId])
    }

    async buildFirstLinkAlone() {
        const railroadId = this.selectedRailroad
        const first = this.firstLink
        if (railroadId && first) {
            await this.buildTrack(railroadId, [first])
        }
    }

    async buildTrack(railroadId: RailroadId, linkIds: string[]) {
        await this.applyAction(this.createPlayerAction(BuildTrack, { railroadId, linkIds }))
    }

    async buildConnection(connectionId: string) {
        const railroadId = this.selectedRailroad
        if (railroadId && this.connectionTargets.includes(connectionId)) {
            await this.applyAction(
                this.createPlayerAction(BuildConnection, { railroadId, connectionId })
            )
        }
    }

    async delegateBuild(railroadId: RailroadId, builderId: string) {
        await this.applyAction(this.createPlayerAction(DelegateBuild, { railroadId, builderId }))
    }

    developTargets: DevelopTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!playerId || !this.actingIn(MachineState.DevelopingSettlements)) {
            return []
        }
        return this.gameState.affordableDevelopments(playerId).map((settlementId) => ({
            settlementId,
            cost: this.gameState.developmentCost(settlementId),
            gains: this.gameState.developmentIncomeGains(settlementId)
        }))
    })

    // Leave Town takes the place of the first development, on maps that have it.
    leaveTownTargets: string[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.actingIn(MachineState.DevelopingSettlements)
            ? this.gameState.leaveTownOptions(playerId)
            : []
    })

    async leaveTown(settlementId: string) {
        if (this.leaveTownTargets.includes(settlementId)) {
            await this.applyAction(this.createPlayerAction(LeaveTown, { settlementId }))
        }
    }

    // A settlement that may be both developed and left, picked on the board: its picker asks which.
    settlementChoice: string | undefined = $derived.by(() => {
        const settlementId = this.settlementSelection.settlement?.value
        return settlementId &&
            this.developTargets.some((target) => target.settlementId === settlementId) &&
            this.leaveTownTargets.includes(settlementId)
            ? settlementId
            : undefined
    })

    // Develops or leaves a settlement picked on the board, or opens its picker when it offers both.
    // Picking the open settlement again closes the picker.
    async clickSettlement(settlementId: string) {
        const develops = this.developTargets.some((target) => target.settlementId === settlementId)
        const leaves = this.leaveTownTargets.includes(settlementId)
        if (develops && leaves) {
            this.settlementSelection =
                this.settlementChoice === settlementId
                    ? {}
                    : selectSettlement(this.settlementSelection, settlementId)
            return
        }
        if (develops) {
            await this.develop(settlementId)
        } else if (leaves) {
            await this.leaveTown(settlementId)
        }
    }

    closeSettlementChoice() {
        this.settlementSelection = {}
    }

    mayFinishDeveloping = $derived(
        this.actingIn(MachineState.DevelopingSettlements) && this.gameState.mayFinishDeveloping()
    )

    async develop(settlementId: string) {
        if (this.developTargets.some((target) => target.settlementId === settlementId)) {
            await this.applyAction(this.createPlayerAction(Develop, { settlementId }))
        }
    }

    async finishDevelopment() {
        await this.applyAction(this.createPlayerAction(FinishDevelopment, {}))
    }

    offeringStock = $derived(this.actingIn(MachineState.OfferingStock))

    async chooseBox(box: ActionBox) {
        if (this.selectableBoxes.includes(box)) {
            await this.applyAction(this.createPlayerAction(ChooseAction, { box }))
        }
    }

    async offerShare(railroadId: RailroadId, ownShare: boolean) {
        await this.applyAction(this.createPlayerAction(OfferShare, { railroadId, ownShare }))
    }

    async declineOffer() {
        await this.applyAction(this.createPlayerAction(DeclineOffer, {}))
    }

    bidding = $derived(this.actingIn(MachineState.Bidding))

    auctionView: AuctionView | undefined = $derived.by(() => {
        const auction = this.gameState.auction
        if (!auction) {
            return undefined
        }
        return {
            railroadId: auction.railroadId,
            kind: auction.kind,
            sellerId: auction.sellerId,
            openerId: auction.bidding.auctioneerId,
            minimum: this.gameState.auctionMinimum(),
            seats: auction.bidding.participants,
            currentBidderId: this.gameState.bidding().currentBidderId,
            smallestBid: this.gameState.smallestBid(),
            upcomingOfferings:
                auction.kind === AuctionKind.InitialOffering
                    ? this.gameState.map.initialOffering.filter(
                          (railroadId) =>
                              railroadId !== auction.railroadId &&
                              !this.gameState.isOpen(railroadId)
                      )
                    : []
        }
    })

    displayName(playerId: string): string {
        return playerId === this.myPlayerId ? 'You' : this.getPlayerName(playerId)
    }

    async placeBid(amount: number) {
        await this.applyAction(this.createPlayerAction(PlaceBid, { amount }))
    }

    async passBid() {
        await this.applyAction(this.createPlayerAction(PassBid, {}))
    }
}
