import { assert } from '@tabletop/common'
import {
    AuctionCompany,
    BidForCompany,
    CompanyAuctionModel,
    FormCompany,
    canBeAuctioned,
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
export type CompanyAuctionOpeningStages = { companyId: string; home: HomePosition }
export const CompanyAuctionOpeningStageOrder = ['companyId', 'home'] as const

export class CompanyAuctionModule {
    readonly opening = new StagedSelection<CompanyAuctionOpeningStages>(
        CompanyAuctionOpeningStageOrder,
        'pop-stage'
    )
    readonly openingBid = singleChoice<number>()
    readonly raise = singleChoice<number>()
    readonly size = singleChoice<number>()
    readonly contribution = singleChoice<string[]>()
    constructor(private readonly session: CompanyAuctionSession) {}

    model = $derived.by(() =>
        this.session.rules.stockRules.companyAuction
            ? new CompanyAuctionModel(this.session.state, this.session.rules.stockRules)
            : undefined
    )
    auction = $derived.by(() => this.model?.auction)
    /** The player whose bid, pass or formation the auction awaits. */
    playerId = $derived.by(() => this.model?.playerId)
    pending = $derived.by(() => this.model?.pendingFormation())
    canOpen = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('AuctionCompany')
    )
    canRespond = $derived.by(
        () =>
            this.session.interactive && this.session.validActionTypes.includes('PassCompanyAuction')
    )
    canForm = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('FormCompany')
    )
    companies = $derived.by(() =>
        this.canOpen ? this.session.state.companies.filter(canBeAuctioned) : []
    )
    selectedCompanyId = $derived.by(() =>
        this.session.selectionsVisible ? this.opening.value('companyId') : undefined
    )
    selectedHome = $derived.by(() =>
        this.session.selectionsVisible ? this.opening.value('home') : undefined
    )
    openingAmount = $derived.by(() => {
        const model = this.model
        const playerId = this.session.state.activePlayerIds[0]
        if (!model || !this.selectedHome || !playerId) return undefined
        const staged = this.session.selectionsVisible ? this.openingBid.value('choice') : undefined
        return staged ?? model.lowestBid(playerId)
    })
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
    contributions = $derived.by(() => this.model?.contributions() ?? [])
    // A size is chosen by the winner unless the phase allows only one.
    shareCount = $derived.by(
        () =>
            (this.session.selectionsVisible ? this.size.value('choice') : undefined) ??
            (this.shareCounts.length === 1 ? this.shareCounts[0] : undefined)
    )
    contributedPrivateIds = $derived.by(
        () => (this.session.selectionsVisible ? this.contribution.value('choice') : undefined) ?? []
    )
    formationChoice = $derived.by((): CompanyFormationChoice | undefined =>
        this.shareCount === undefined
            ? undefined
            : { shareCount: this.shareCount, privateIds: this.contributedPrivateIds }
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
        const playerId = this.playerId
        if (!model?.auction || !playerId) return undefined
        const staged = this.session.selectionsVisible ? this.raise.value('choice') : undefined
        return staged !== undefined && staged >= model.minimumBid
            ? staged
            : (model.lowestBid(playerId) ?? model.minimumBid)
    })
    setBid(amount: number) {
        assert(this.canRespond, 'No company is being auctioned')
        this.raise.choose('choice', amount)
    }
    bidAllowed(amount: number): boolean {
        const playerId = this.playerId
        return this.canRespond && !!playerId && !!this.model?.canBid(playerId, amount)
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
    }
    clearOpening() {
        this.opening.clear()
        this.openingBid.clear()
    }
    backFromOpeningBid() {
        this.openingBid.clear()
        this.opening.back()
    }
    setOpeningBid(amount: number) {
        assert(this.canOpen && this.selectedHome, 'Choose a home first')
        this.openingBid.choose('choice', amount)
    }
    async open() {
        const companyId = this.selectedCompanyId
        const home = this.selectedHome
        const amount = this.openingAmount
        assert(this.canOpen && companyId && home && amount !== undefined, 'Complete the auction')
        this.clearOpening()
        await this.session.applyAction(
            this.session.createPlayerAction(AuctionCompany, { companyId, home, amount })
        )
    }
    async bid(amount: number) {
        const auction = this.auction
        assert(this.canRespond && auction, 'No company is being auctioned')
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
        assert(this.canRespond && auction, 'No company is being auctioned')
        this.raise.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(PassCompanyAuction, { companyId: auction.companyId })
        )
    }
    setShareCount(shareCount: number) {
        assert(this.shareCounts.includes(shareCount), 'Choose an available size')
        this.size.choose('choice', shareCount)
    }
    toggleContribution(privateId: string) {
        assert(this.contributions.includes(privateId), 'Choose a private that can be contributed')
        const privateIds = this.contributedPrivateIds
        this.contribution.choose(
            'choice',
            privateIds.includes(privateId)
                ? privateIds.filter((id) => id !== privateId)
                : [...privateIds, privateId]
        )
    }
    async form() {
        const pending = this.pending
        const choice = this.formationChoice
        assert(this.canForm && pending && choice, 'No company is being formed')
        this.size.clear()
        this.contribution.clear()
        await this.session.applyAction(
            this.session.createPlayerAction(FormCompany, {
                companyId: pending.companyId,
                shareCount: choice.shareCount,
                privateIds: choice.privateIds
            })
        )
    }
    private get selections() {
        return [this.raise, this.contribution, this.size, this.openingBid, this.opening]
    }
    hasManual() {
        return this.selections.some((selection) => selection.hasManual())
    }
    undo() {
        return this.selections.some((selection) => selection.undo())
    }
    clear() {
        for (const selection of this.selections) selection.clear()
    }
}
