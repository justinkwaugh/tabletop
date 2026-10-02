import { assert, assertExists } from '@tabletop/common'
import {
    AuctionCompany,
    BidForCompany,
    CompanyAuctionModel,
    FormCompany,
    PassCompanyAuction,
    type CompanyAuctionState,
    type CompanyFormationChoice,
    type EighteenXXTitleRules,
    type HomePosition
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection, singleChoice } from './stagedSelection.svelte.js'

export type CompanyAuctionSession = ModuleSession<
    CompanyAuctionState,
    Pick<EighteenXXTitleRules, 'stockRules'>
>
export type CompanyAuctionOpeningStages = { companyId: string; home: HomePosition; amount: number }
export const CompanyAuctionOpeningStageOrder = ['companyId', 'home', 'amount'] as const

export class CompanyAuctionModule {
    readonly opening = new StagedSelection<CompanyAuctionOpeningStages>(
        CompanyAuctionOpeningStageOrder,
        'pop-stage'
    )
    readonly formation = singleChoice<CompanyFormationChoice>()
    readonly raise = singleChoice<number>()
    constructor(private readonly session: CompanyAuctionSession) {}

    model = $derived.by(() =>
        this.session.rules.stockRules.companyAuction
            ? new CompanyAuctionModel(this.session.state, this.session.rules.stockRules)
            : undefined
    )
    /** The auction in progress, if any. */
    auction = $derived.by(() => this.model?.auction)
    /** The player whose bid, pass or formation the auction awaits. */
    playerId = $derived.by(() => this.model?.playerId)
    pending = $derived.by(() => this.model?.pendingFormation())
    canOpen = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('AuctionCompany')
    )
    canBid = $derived.by(
        () =>
            this.session.interactive && this.session.validActionTypes.includes('PassCompanyAuction')
    )
    canForm = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('FormCompany')
    )
    companies = $derived.by(() =>
        this.canOpen
            ? this.session.state.companies.filter(
                  (company) => company.kind !== 'private' && !company.started && !company.closed
              )
            : []
    )
    selectedCompanyId = $derived.by(() =>
        this.session.selectionsVisible ? this.opening.value('companyId') : undefined
    )
    selectedHome = $derived.by(() =>
        this.session.selectionsVisible ? this.opening.value('home') : undefined
    )
    openingAmount = $derived.by(() =>
        this.session.selectionsVisible ? this.opening.value('amount') : undefined
    )
    homePositions = $derived.by(() => {
        const model = this.model
        const companyId = this.selectedCompanyId
        return model && companyId && !this.selectedHome && this.canOpen
            ? model.terms.homes(this.session.state, companyId)
            : []
    })
    homeLocationIds = $derived.by(() => [
        ...new Set(this.homePositions.map((position) => position.locationId))
    ])
    shareCounts = $derived.by(() =>
        this.model && this.pending ? this.model.terms.shareCounts(this.session.state) : []
    )
    contributions = $derived.by(() =>
        this.model && this.pending
            ? this.model.terms.contributions(this.session.state, this.pending.playerId)
            : []
    )
    formationChoice = $derived.by(
        (): CompanyFormationChoice | undefined =>
            (this.session.selectionsVisible ? this.formation.value('choice') : undefined) ??
            (this.shareCounts.length
                ? { shareCount: this.shareCounts[0], privateIds: [] }
                : undefined)
    )

    openingReason(amount: number): string | undefined {
        const model = this.model
        const companyId = this.selectedCompanyId
        const home = this.selectedHome
        const playerId = this.session.state.activePlayerIds[0]
        if (!model || !companyId || !home || !playerId) return 'Choose a company and its home.'
        return model.openingReason({ playerId, companyId, amount, home })
    }
    bidAmount = $derived.by(() => {
        const model = this.model
        if (!model?.auction) return undefined
        const staged = this.session.selectionsVisible ? this.raise.value('choice') : undefined
        return staged !== undefined && staged >= model.minimumBid ? staged : model.minimumBid
    })
    setBid(amount: number) {
        assert(this.canBid, 'No company is being auctioned')
        this.raise.choose('choice', amount)
    }
    bidAllowed(amount: number): boolean {
        const playerId = this.playerId
        return this.canBid && !!playerId && !!this.model?.canBid(playerId, amount)
    }
    formationReason(choice: CompanyFormationChoice): string | undefined {
        const model = this.model
        const pending = this.pending
        if (!model || !pending) return 'No company is being formed.'
        return model.formationReason(pending.playerId, pending.companyId, choice)
    }

    selectCompany(companyId: string) {
        assert(this.canOpen, 'Company auctions are unavailable')
        this.opening.choose('companyId', companyId)
    }
    chooseHome(home: HomePosition) {
        const model = this.model
        assert(this.canOpen && model && this.selectedCompanyId, 'Choose a company first')
        assert(
            this.homePositions.some(
                (position) =>
                    position.locationId === home.locationId && position.nodeId === home.nodeId
            ),
            'Choose an offered city'
        )
        this.opening.choose('home', { locationId: home.locationId, nodeId: home.nodeId })
        this.opening.choose('amount', model.terms.openingBid, 'auto')
    }
    setOpeningBid(amount: number) {
        assert(this.canOpen && this.selectedHome, 'Choose a home first')
        this.opening.choose('amount', amount)
    }
    async open() {
        const companyId = this.selectedCompanyId
        const home = this.selectedHome
        const amount = this.openingAmount
        assert(this.canOpen && companyId && home && amount !== undefined, 'Complete the auction')
        this.opening.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(AuctionCompany, { companyId, home, amount })
        )
    }
    async bid(amount: number) {
        const auction = this.auction
        assert(this.canBid && auction, 'No company is being auctioned')
        this.raise.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(BidForCompany, {
                companyId: auction.companyId,
                amount
            })
        )
    }
    async pass() {
        const auction = this.auction
        assert(this.canBid && auction, 'No company is being auctioned')
        this.raise.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(PassCompanyAuction, { companyId: auction.companyId })
        )
    }
    setShareCount(shareCount: number) {
        const choice = this.formationChoice
        assertExists(choice, 'Formation requires a pending company')
        this.formation.choose('choice', { ...choice, shareCount })
    }
    toggleContribution(privateId: string) {
        const choice = this.formationChoice
        assertExists(choice, 'Formation requires a pending company')
        this.formation.choose('choice', {
            ...choice,
            privateIds: choice.privateIds.includes(privateId)
                ? choice.privateIds.filter((id) => id !== privateId)
                : [...choice.privateIds, privateId]
        })
    }
    async form() {
        const pending = this.pending
        const choice = this.formationChoice
        assert(this.canForm && pending && choice, 'No company is being formed')
        this.formation.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(FormCompany, {
                companyId: pending.companyId,
                shareCount: choice.shareCount,
                privateIds: choice.privateIds
            })
        )
    }
    hasManual() {
        return this.opening.hasManual() || this.formation.hasManual() || this.raise.hasManual()
    }
    undo() {
        return this.raise.undo() || this.formation.undo() || this.opening.undo()
    }
    clear() {
        this.opening.clear()
        this.formation.clear()
        this.raise.clear()
    }
}
