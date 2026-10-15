import { sameCoordinates, type AuctionParticipant, type AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ChooseAction,
    Consolidate,
    HydratedRailheadsGameState,
    Industry,
    InvestInIndustry,
    IssueShare,
    LayTrack,
    MachineState,
    PassBid,
    PlacementKind,
    PlaceBid,
    PlaceSealedBid,
    ShareAuctionKind,
    isLayTrackSpace,
    type ActionSpaceId,
    type CompanyId,
    type IndustryBoost,
    type InitialOffer,
    type LayTrackRules,
    type LayTrackSpace,
    type Placement,
    type PlacementTarget,
    type RailheadsProjectedState
} from '@tabletop/railheads'
import {
    addPiece,
    clearBoostHex,
    hasManualIssueSelection,
    hasManualTrackSelection,
    pickBoostHex,
    piecesOf,
    popIssueSelection,
    popTrackSelection,
    selectCompany,
    selectIssueCompany,
    selectedCompany,
    stagedPlacements,
    type CompanySlot,
    type IssueSelection,
    type TrackSelection
} from './selection.js'

export type ShareAuctionView = {
    companyId: CompanyId
    kind: ShareAuctionKind
    industry: Industry | undefined
    startPlayer: boolean
    openerId: string | undefined
    minimum: number
    seats: AuctionParticipant[]
    currentBidderId: string | undefined
    smallestBid: number
    upcoming: InitialOffer[]
}

export type SealedBidSeat = {
    playerId: string
    waiting: boolean
    sealed: boolean
    amount: number | undefined
}

export type IndustryAuctionView = {
    industry: Industry
    investorId: string
    minimum: number
    seats: SealedBidSeat[]
}

export type TrackTarget = PlacementTarget & { companyId: CompanyId }

export class RailheadsGameSession extends GameSession<
    RailheadsProjectedState,
    HydratedRailheadsGameState
> {
    private trackSelection: TrackSelection = $state({})
    private issueSelection: IssueSelection = $state({})

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && !this.gameState.result)

    private actingIn(...states: MachineState[]): boolean {
        return this.canAct && states.includes(this.gameState.machineState)
    }

    displayName(playerId: string): string {
        return playerId === this.myPlayerId ? 'You' : this.getPlayerName(playerId)
    }

    choosingAction = $derived(this.actingIn(MachineState.ChoosingAction))

    selectableSpaces: ActionSpaceId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.choosingAction ? this.gameState.availableSpaces(playerId) : []
    })

    consolidatableSpaces: ActionSpaceId[] = $derived(
        this.choosingAction ? this.gameState.consolidatableSpaces() : []
    )

    async chooseSpace(space: ActionSpaceId) {
        if (this.selectableSpaces.includes(space)) {
            await this.applyAction(this.createPlayerAction(ChooseAction, { space }))
        }
    }

    async consolidate(space: ActionSpaceId) {
        if (this.consolidatableSpaces.includes(space)) {
            await this.applyAction(this.createPlayerAction(Consolidate, { space }))
        }
    }

    issuing = $derived(this.actingIn(MachineState.IssuingShare))

    issuableCompanies: CompanyId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.issuing ? this.gameState.issuableCompanies(playerId) : []
    })

    issueCompany: CompanyId | undefined = $derived.by(() => {
        const chosen = this.issueSelection.company?.value
        if (chosen && this.issuableCompanies.includes(chosen)) {
            return chosen
        }
        return this.issuableCompanies.length === 1 ? this.issuableCompanies[0] : undefined
    })

    selectIssueCompany(companyId: CompanyId) {
        if (this.issuableCompanies.includes(companyId)) {
            this.issueSelection = selectIssueCompany(this.issueSelection, companyId)
        }
    }

    async issueShare(amount: number) {
        const companyId = this.issueCompany
        if (companyId) {
            await this.applyAction(this.createPlayerAction(IssueShare, { companyId, amount }))
        }
    }

    bidding = $derived(this.actingIn(MachineState.ShareBidding))

    shareAuctionView: ShareAuctionView | undefined = $derived.by(() => {
        const auction = this.gameState.shareAuction
        if (!auction) {
            return undefined
        }
        return {
            companyId: auction.companyId,
            kind: auction.kind,
            industry: auction.industry,
            startPlayer: auction.startPlayer,
            openerId: auction.bidding.auctioneerId,
            minimum: auction.minimum,
            seats: auction.bidding.participants,
            currentBidderId: this.gameState.bidding().currentBidderId,
            smallestBid: this.gameState.smallestBid(),
            upcoming:
                auction.kind === ShareAuctionKind.Initial
                    ? this.gameState.initialOffers.slice(1)
                    : []
        }
    })

    async placeBid(amount: number) {
        await this.applyAction(this.createPlayerAction(PlaceBid, { amount }))
    }

    async passBid() {
        await this.applyAction(this.createPlayerAction(PassBid, {}))
    }

    choosingIndustry = $derived(this.actingIn(MachineState.ChoosingIndustry))

    investableIndustries: Industry[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.choosingIndustry
            ? this.gameState.investableIndustries(playerId)
            : []
    })

    async investIn(industry: Industry) {
        if (this.investableIndustries.includes(industry)) {
            await this.applyAction(this.createPlayerAction(InvestInIndustry, { industry }))
        }
    }

    industryAuctionView: IndustryAuctionView | undefined = $derived.by(() => {
        const auction = this.gameState.industryAuction
        if (!auction) {
            return undefined
        }
        return {
            industry: auction.industry,
            investorId: auction.investorId,
            minimum: auction.minimum,
            seats: this.gameState.turnManager.turnOrder.map((playerId) => ({
                playerId,
                waiting: auction.bidders.includes(playerId),
                sealed: auction.bids.some((bid) => bid.playerId === playerId),
                amount:
                    playerId === this.myPlayerId
                        ? auction.bids.find((bid) => bid.playerId === playerId)?.amount
                        : undefined
            }))
        }
    })

    sealedBidding = $derived(
        !this.isViewingHistory &&
            this.myPlayerId !== undefined &&
            this.gameState.machineState === MachineState.SealedBidding &&
            (this.gameState.industryAuction?.bidders.includes(this.myPlayerId) ?? false)
    )

    mayBidZero = $derived(this.gameState.industryAuction?.investorId !== this.myPlayerId)

    async placeSealedBid(amount: number) {
        const auction = this.gameState.industryAuction
        if (!auction || !this.sealedBidding) {
            return
        }
        const action = this.createPlayerAction(PlaceSealedBid, { amount })
        action.simultaneousGroupId = auction.id
        await this.applyAction(action)
    }

    layingTrack = $derived(this.actingIn(MachineState.LayingTrack))

    laySpace: LayTrackSpace | undefined = $derived.by(() => {
        const space = this.gameState.activeSpace
        return this.layingTrack && space !== undefined && isLayTrackSpace(space) ? space : undefined
    })

    layRules: LayTrackRules | undefined = $derived(
        this.laySpace ? this.gameState.layTrackRules(this.laySpace) : undefined
    )

    placements: Placement[] = $derived(this.laySpace ? stagedPlacements(this.trackSelection) : [])

    shownState: HydratedRailheadsGameState = $derived.by(() => {
        const space = this.laySpace
        const playerId = this.myPlayerId
        if (!space || !playerId || this.placements.length === 0) {
            return this.gameState
        }
        const preview = new HydratedRailheadsGameState(structuredClone(this.gameState.dehydrate()))
        for (const placement of this.placements) {
            preview.placeTrack(playerId, space, placement)
        }
        return preview
    })

    private companiesWithTargets(
        state: HydratedRailheadsGameState,
        exclude?: CompanyId
    ): CompanyId[] {
        const space = this.laySpace
        const playerId = this.myPlayerId
        if (!space || !playerId) {
            return []
        }
        return state
            .buildableCompanies(playerId, space)
            .filter(
                (companyId) =>
                    companyId !== exclude &&
                    state.placementTargets(playerId, space, companyId).length > 0
            )
    }

    firstCompanyOptions: CompanyId[] = $derived(
        this.laySpace ? this.companiesWithTargets(this.gameState) : []
    )

    firstCompany: CompanyId | undefined = $derived.by(() => {
        const chosen = selectedCompany(this.trackSelection, 'first')
        if (chosen) {
            return chosen
        }
        return this.firstCompanyOptions.length === 1 ? this.firstCompanyOptions[0] : undefined
    })

    secondCompany: CompanyId | undefined = $derived(selectedCompany(this.trackSelection, 'second'))

    secondCompanyOptions: CompanyId[] = $derived.by(() => {
        const first = this.firstCompany
        if (!first || !this.layRules || this.layRules.maxCompanies < 2 || this.secondCompany) {
            return []
        }
        return this.companiesWithTargets(this.shownState, first)
    })

    private slotFull(slot: CompanySlot): boolean {
        return (
            piecesOf(this.trackSelection, slot).length >= (this.layRules?.placementsPerCompany ?? 0)
        )
    }

    buildingSlot: CompanySlot | undefined = $derived.by(() => {
        if (this.secondCompany) {
            return this.slotFull('second') ? undefined : 'second'
        }
        return this.firstCompany && !this.slotFull('first') ? 'first' : undefined
    })

    buildingCompany: CompanyId | undefined = $derived(
        this.buildingSlot === 'second'
            ? this.secondCompany
            : this.buildingSlot
              ? this.firstCompany
              : undefined
    )

    boostHex: AxialCoordinates | undefined = $derived(
        this.laySpace ? this.trackSelection.boostHex?.value : undefined
    )

    private buildingTargets: TrackTarget[] = $derived.by(() => {
        const space = this.laySpace
        const playerId = this.myPlayerId
        const companyId = this.buildingCompany
        if (!space || !playerId || !companyId) {
            return []
        }
        return this.shownState
            .placementTargets(playerId, space, companyId)
            .map((target) => ({ ...target, companyId }))
    })

    trackTargets: TrackTarget[] = $derived(this.boostHex ? [] : this.buildingTargets)

    boostTarget: TrackTarget | undefined = $derived.by(() => {
        const coords = this.boostHex
        return coords
            ? this.buildingTargets.find((target) => sameCoordinates(target.coords, coords))
            : undefined
    })

    stagedCost: number = $derived.by(() => {
        const playerId = this.myPlayerId
        const space = this.laySpace
        if (!playerId || !space) {
            return 0
        }
        return this.placements.reduce(
            (sum, placement) =>
                sum +
                this.gameState.placementCost(
                    playerId,
                    space,
                    placement.companyId,
                    placement.coords,
                    placement.kind
                ),
            0
        )
    })

    chooseTrackCompany(companyId: CompanyId) {
        if (this.placements.length === 0 && this.firstCompanyOptions.includes(companyId)) {
            this.trackSelection = selectCompany(this.trackSelection, 'first', companyId)
        } else if (this.secondCompanyOptions.includes(companyId)) {
            this.trackSelection = selectCompany(this.trackSelection, 'second', companyId)
        }
    }

    async clickHex(coords: AxialCoordinates) {
        const target = this.trackTargets.find((candidate) =>
            sameCoordinates(candidate.coords, coords)
        )
        const slot = this.buildingSlot
        if (!target || !slot) {
            return
        }
        if (target.kind === PlacementKind.Disc && this.gameState.needsBoostChoice(coords)) {
            this.trackSelection = pickBoostHex(this.trackSelection, coords)
            return
        }
        this.trackSelection = addPiece(this.trackSelection, slot, {
            companyId: target.companyId,
            coords: target.coords,
            kind: target.kind
        })
    }

    chooseBoost(boost: IndustryBoost) {
        const target = this.boostTarget
        const slot = this.buildingSlot
        if (!target || !slot) {
            return
        }
        this.trackSelection = addPiece(clearBoostHex(this.trackSelection), slot, {
            companyId: target.companyId,
            coords: target.coords,
            kind: target.kind,
            boost
        })
    }

    async layTrack() {
        if (this.laySpace) {
            await this.applyAction(
                this.createPlayerAction(LayTrack, { placements: this.placements })
            )
        }
    }

    hasManualSelection(): boolean {
        return (
            hasManualTrackSelection(this.trackSelection) ||
            hasManualIssueSelection(this.issueSelection)
        )
    }

    override async undo() {
        if (hasManualTrackSelection(this.trackSelection)) {
            this.trackSelection = popTrackSelection(this.trackSelection)
            return
        }
        if (hasManualIssueSelection(this.issueSelection)) {
            this.issueSelection = popIssueSelection(this.issueSelection)
            return
        }
        await super.undo()
    }

    override beforeNewState(): void {
        this.trackSelection = {}
        this.issueSelection = {}
    }
}
