import { sameCoordinates, type AuctionParticipant, type AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ChooseAction,
    ClaimInvestment,
    Consolidate,
    DeclineInvestment,
    InvestmentItem,
    claimableItems,
    currentClaimant,
    mayDecline,
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
    type PlacementEffect,
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

export type InvestmentClaimView = {
    industry: Industry
    claimantId: string
    amount: number
    items: InvestmentItem[]
    mine: InvestmentItem[]
    mayDecline: boolean
}

export class RailheadsGameSession extends GameSession<
    RailheadsProjectedState,
    HydratedRailheadsGameState
> {
    private trackSelection: TrackSelection = $state({})
    private issueSelection: IssueSelection = $state({})
    // Switzerland: loans to take (positive) or repay (negative) before the staged track.
    loanChange: number = $state(0)

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

    roundEndingChoiceAvailable: boolean = $derived.by(() => {
        const state = this.gameState
        return (
            state.machineState === MachineState.ChoosingAction &&
            state
                .availableSpaces(state.turnPlayerId())
                .some((space) => state.spaceCost(space) === state.roundTimer)
        )
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

    claimingInvestment = $derived(this.actingIn(MachineState.ClaimingInvestment))

    investmentClaimView: InvestmentClaimView | undefined = $derived.by(() => {
        const state = this.gameState
        const claim = state.investmentClaim
        const claimant = currentClaimant(state)
        if (!claim || !claimant) {
            return undefined
        }
        return {
            industry: claim.industry,
            claimantId: claimant.playerId,
            amount: claimant.amount,
            items: claim.items,
            mine:
                this.myPlayerId && this.claimingInvestment
                    ? claimableItems(state, this.myPlayerId)
                    : [],
            mayDecline: mayDecline(state)
        }
    })

    async claimInvestment(item: InvestmentItem, fundedCompanyId?: CompanyId) {
        if (this.investmentClaimView?.mine.includes(item)) {
            await this.applyAction(
                this.createPlayerAction(ClaimInvestment, {
                    item,
                    ...(fundedCompanyId ? { fundedCompanyId } : {})
                })
            )
        }
    }

    async declineInvestment() {
        if (this.investmentClaimView?.mayDecline) {
            await this.applyAction(this.createPlayerAction(DeclineInvestment, {}))
        }
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

    // Placements apply in order, as the action does, because a disc's cost can
    // depend on the discs staged before it.
    private trackPreview: { state: HydratedRailheadsGameState; effects: PlacementEffect[] } =
        $derived.by(() => {
            const space = this.laySpace
            const playerId = this.myPlayerId
            const loanCompany = this.loanCompany
            const loan = loanCompany && this.loanChange !== 0 ? this.loanChange : 0
            if (!space || !playerId || (this.placements.length === 0 && loan === 0)) {
                return { state: this.gameState, effects: [] }
            }
            const preview = new HydratedRailheadsGameState(
                structuredClone(this.gameState.dehydrate())
            )
            if (loanCompany && loan !== 0) {
                preview.changeLoans(space, loanCompany, loan)
            }
            const effects = this.placements.map((placement) =>
                preview.placeTrack(playerId, space, placement)
            )
            return { state: preview, effects }
        })

    shownState: HydratedRailheadsGameState = $derived(this.trackPreview.state)

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
                    (state.placementTargets(playerId, space, companyId).length > 0 ||
                        state.loanRange(space, companyId).take > 0)
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

    // The company a loan change applies to: the one this single-company action builds for.
    loanCompany: CompanyId | undefined = $derived(
        this.laySpace && this.layRules?.allowsLoans ? this.firstCompany : undefined
    )

    loanRange: { take: number; repay: number } = $derived(
        this.laySpace && this.loanCompany
            ? this.gameState.loanRange(this.laySpace, this.loanCompany)
            : { take: 0, repay: 0 }
    )

    setLoanChange(change: number) {
        const { take, repay } = this.loanRange
        this.loanChange = Math.max(-repay, Math.min(take, change))
    }

    secondCompanyOptions: CompanyId[] = $derived.by(() => {
        const first = this.firstCompany
        if (!first || !this.layRules || this.layRules.maxCompanies < 2 || this.secondCompany) {
            return []
        }
        return this.companiesWithTargets(this.shownState, first)
    })

    // England & Wales allows one more piece while every staged disc stays in the company's region.
    private slotFull(slot: CompanySlot): boolean {
        const space = this.laySpace
        const companyId = slot === 'second' ? this.secondCompany : this.firstCompany
        const pieces = piecesOf(this.trackSelection, slot)
        if (!space || !companyId) {
            return pieces.length >= (this.layRules?.placementsPerCompany ?? 0)
        }
        const limit = this.gameState.placementLimit(
            space,
            companyId,
            pieces.map((piece) => piece.coords)
        )
        return pieces.length >= limit
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
        const tollsLaid = this.trackPreview.effects.filter((effect) => effect.tollId).length
        const staged = this.placements.filter((placement) => placement.companyId === companyId)
        // The bonus piece must stay inside the region, like every piece before it.
        const regionOnly =
            staged.length >= (this.layRules?.placementsPerCompany ?? 0) &&
            (this.layRules?.regionPlacements ?? 0) > 0
        return this.shownState
            .placementTargets(playerId, space, companyId, tollsLaid)
            .filter((target) => !regionOnly || this.gameState.inRegion(companyId, target.coords))
            .map((target) => ({ ...target, companyId }))
    })

    trackTargets: TrackTarget[] = $derived(this.boostHex ? [] : this.buildingTargets)

    boostTarget: TrackTarget | undefined = $derived.by(() => {
        const coords = this.boostHex
        return coords
            ? this.buildingTargets.find((target) => sameCoordinates(target.coords, coords))
            : undefined
    })

    stagedCost: number = $derived(
        this.trackPreview.effects.reduce((sum, effect) => sum + effect.cost, 0)
    )

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
            const loan =
                this.loanCompany && this.loanChange !== 0
                    ? { companyId: this.loanCompany, change: this.loanChange }
                    : undefined
            await this.applyAction(
                this.createPlayerAction(LayTrack, {
                    placements: this.placements,
                    ...(loan ? { loan } : {})
                })
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
        this.loanChange = 0
    }
}
