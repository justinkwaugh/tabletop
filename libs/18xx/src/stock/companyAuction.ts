import * as Type from 'typebox'
import { assert, assertExists, SimpleAuction } from '@tabletop/common'
import { getCompany, presidentCertificate, type Company } from '../finance/finance.js'
import { StationPosition, homeStationId } from '../map/station.js'
import type { MapStateData } from '../map/mapState.js'
import type { HomePosition } from '../stations/stationPlacement.js'
import { applyStationPlacement } from '../stations/stationPlacement.js'
import { startCompanyAtPar } from '../company/companyStart.js'
import type { FormationState } from '../company/companyState.js'
import { PassableBidding, validBidStep } from '../auctions/passableBidding.js'
import { markTurnPurchase } from './sharePurchase.js'
import { recordStockAction } from './stockRoundRules.js'
import { recordTurnPurchase } from './turnPurchases.js'
import type { StockRules } from './stockRules.js'

const Id = Type.String({ minLength: 1 })
export const CompanyAuction = Type.Object(
    { companyId: Id, openerId: Id, home: StationPosition, auction: SimpleAuction },
    { additionalProperties: false }
)
export type CompanyAuction = Type.Static<typeof CompanyAuction>
export const CompanyAuctionFields = { companyAuction: Type.Optional(CompanyAuction) }
export type CompanyAuctionState = FormationState &
    MapStateData &
    Type.Static<Type.TObject<typeof CompanyAuctionFields>>

export type CompanyAuctionOpening = {
    playerId: string
    companyId: string
    amount: number
    home: HomePosition
}
export type CompanyFormationChoice = { shareCount: number; privateIds: string[] }
export type PendingCompanyFormation = {
    companyId: string
    playerId: string
    price: number
    home: StationPosition
}
export type CompanyFormation = CompanyFormationChoice & PendingCompanyFormation

/**
 * Starting a company by auction during a stock turn: the opener names the company, its home and
 * an opening bid, every player may raise in turn, and the winner forms the company.
 */
export interface CompanyAuctionRules {
    openingBid: number
    increment: number
    /** The most a player can bid; a player who cannot reach the minimum leaves the auction. */
    maximumBid(state: CompanyAuctionState, playerId: string): number
    /** Whether the player could pay this exact amount and form a company with it now. */
    formable(state: CompanyAuctionState, playerId: string, amount: number): boolean
    homes(state: CompanyAuctionState, companyId: string): StationPosition[]
    startSpace(state: CompanyAuctionState, price: number): string
    /** The share counts a company may be formed with now. */
    shareCounts(state: CompanyAuctionState): readonly number[]
    /** The privates a winner may contribute toward a winning bid of this price. */
    contributions(state: CompanyAuctionState, playerId: string, price: number): readonly string[]
    formationReason(state: CompanyAuctionState, formation: CompanyFormation): string | undefined
    /** Settles the bid and the title's formation terms once the company has its president. */
    form(state: CompanyAuctionState, formation: CompanyFormation): void
}

export function canBeAuctioned(company: Company): boolean {
    return company.kind !== 'private' && !company.started && !company.closed
}

export class CompanyAuctionModel {
    constructor(
        private readonly state: CompanyAuctionState,
        private readonly rules: StockRules
    ) {}

    get terms(): CompanyAuctionRules {
        assertExists(this.rules.companyAuction, 'This title has no company auctions')
        return this.rules.companyAuction
    }

    get auction(): CompanyAuction | undefined {
        return this.state.companyAuction
    }

    get bidding(): PassableBidding | undefined {
        return this.auction ? new PassableBidding(this.auction.auction) : undefined
    }

    /** The player owed the next decision: the current bidder, or the winner forming the company. */
    get playerId(): string | undefined {
        const bidding = this.bidding
        return bidding?.currentBidderId ?? bidding?.winner?.playerId
    }

    get minimumBid(): number {
        const bidding = this.bidding
        return bidding ? bidding.highBid + this.terms.increment : this.terms.openingBid
    }

    /** The lowest amount the player can bid now, when any is valid. */
    lowestBid(playerId: string): number | undefined {
        const maximum = this.terms.maximumBid(this.state, playerId)
        for (let amount = this.minimumBid; amount <= maximum; amount += this.terms.increment)
            if (this.affords(playerId, amount)) return amount
        return undefined
    }

    /** Whether the player may open an auction this turn for some company. */
    canOpen(playerId: string): boolean {
        if (this.auction || this.state.stockRound.turn.bought) return false
        if (this.lowestBid(playerId) === undefined) return false
        return this.state.companies.some(
            (company) =>
                canBeAuctioned(company) && this.terms.homes(this.state, company.id).length > 0
        )
    }

    openingReason(request: CompanyAuctionOpening): string | undefined {
        if (this.auction) return 'A company is already being auctioned.'
        if (this.state.stockRound.turn.bought)
            return 'A company cannot be auctioned after this turn’s purchase.'
        const company = this.state.companies.find((company) => company.id === request.companyId)
        if (!company || !canBeAuctioned(company)) return 'This company cannot be started.'
        if (!this.affords(request.playerId, request.amount))
            return 'The player cannot make this opening bid.'
        if (!this.home(request.companyId, request.home))
            return 'Choose a city with an open station slot.'
        return undefined
    }

    canBid(playerId: string, amount: number): boolean {
        const bidding = this.bidding
        return (
            !!bidding &&
            !bidding.winner &&
            bidding.currentBidderId === playerId &&
            this.affords(playerId, amount)
        )
    }

    canPass(playerId: string): boolean {
        const bidding = this.bidding
        return !!bidding && !bidding.winner && bidding.currentBidderId === playerId
    }

    pendingFormation(): PendingCompanyFormation | undefined {
        const winner = this.bidding?.winner
        if (!winner || !this.auction) return undefined
        return {
            companyId: this.auction.companyId,
            playerId: winner.playerId,
            price: winner.amount,
            home: this.auction.home
        }
    }

    /** The privates the winner may contribute toward the pending formation. */
    contributions(): readonly string[] {
        const pending = this.pendingFormation()
        return pending ? this.terms.contributions(this.state, pending.playerId, pending.price) : []
    }

    /** The winner's only formation, applied without a decision: one size and nothing to contribute. */
    automaticFormation(): CompanyFormationChoice | undefined {
        if (!this.pendingFormation()) return undefined
        const shareCounts = this.terms.shareCounts(this.state)
        return shareCounts.length === 1 && !this.contributions().length
            ? { shareCount: shareCounts[0], privateIds: [] }
            : undefined
    }

    formationReason(
        playerId: string,
        companyId: string,
        choice: CompanyFormationChoice
    ): string | undefined {
        const pending = this.pendingFormation()
        if (!pending || pending.playerId !== playerId || pending.companyId !== companyId)
            return 'This player has no company to form.'
        return this.terms.formationReason(this.state, {
            ...pending,
            shareCount: choice.shareCount,
            privateIds: choice.privateIds
        })
    }

    open(request: CompanyAuctionOpening, actionId: string): void {
        assert(!this.openingReason(request), 'Invalid company auction')
        const home = this.home(request.companyId, request.home)
        assertExists(home, 'An opened auction has an offered home')
        recordStockAction(this.state, request.playerId, this.rules.round)
        recordTurnPurchase(this.state, this.rules, {
            kind: 'start',
            companyId: request.companyId
        })
        markTurnPurchase(this.state)
        this.state.companyAuction = {
            companyId: request.companyId,
            openerId: request.playerId,
            home,
            auction: PassableBidding.open(
                actionId,
                this.state.turnManager.turnOrder,
                request.playerId,
                request.amount
            )
        }
        this.withdrawUnable()
    }

    bid(playerId: string, amount: number): void {
        assert(this.canBid(playerId, amount), 'Invalid company bid')
        const auction = this.requireAuction()
        auction.auction = new PassableBidding(auction.auction).bid(playerId, amount)
        this.withdrawUnable()
    }

    pass(playerId: string): void {
        assert(this.canPass(playerId), 'Invalid company auction pass')
        const auction = this.requireAuction()
        auction.auction = new PassableBidding(auction.auction).pass(playerId)
    }

    form(
        playerId: string,
        companyId: string,
        choice: CompanyFormationChoice
    ): { marketSpaceId: string; parPrice: number } {
        assert(!this.formationReason(playerId, companyId, choice), 'Invalid company formation')
        const auction = this.requireAuction()
        const pending = this.pendingFormation()
        assertExists(pending, 'A formation follows a won auction')
        const formation = {
            ...pending,
            shareCount: choice.shareCount,
            privateIds: choice.privateIds
        }
        const president = { kind: 'player' as const, playerId }
        const marketSpaceId = this.terms.startSpace(this.state, formation.price)
        startCompanyAtPar(this.state, companyId, marketSpaceId, president)
        const certificate = presidentCertificate(this.state, companyId)
        assertExists(certificate, 'A company auction awards the president’s certificate')
        certificate.owner = president
        delete certificate.poolId
        applyStationPlacement(this.state, {
            companyId,
            stationId: homeStationId(companyId),
            position: formation.home,
            cost: 0
        })
        this.terms.form(this.state, formation)
        delete this.state.companyAuction
        this.state.activePlayerIds = [auction.openerId]
        const parPrice = getCompany(this.state, companyId).parPrice
        assertExists(parPrice, 'A formed company has a starting price')
        return { marketSpaceId, parPrice }
    }

    private requireAuction(): CompanyAuction {
        assertExists(this.auction, 'No company is being auctioned')
        return this.auction
    }

    private home(companyId: string, home: HomePosition): StationPosition | undefined {
        return this.terms
            .homes(this.state, companyId)
            .find(
                (position) =>
                    position.locationId === home.locationId && position.nodeId === home.nodeId
            )
    }

    private affords(playerId: string, amount: number): boolean {
        return (
            validBidStep(amount, this.minimumBid, this.terms.increment) &&
            amount <= this.terms.maximumBid(this.state, playerId) &&
            this.terms.formable(this.state, playerId, amount)
        )
    }

    private withdrawUnable(): void {
        const auction = this.requireAuction()
        auction.auction = new PassableBidding(auction.auction).withdrawBelow(
            this.minimumBid,
            (playerId) => this.terms.maximumBid(this.state, playerId)
        )
    }
}

export function validateCompanyAuction(state: {
    companyAuction?: CompanyAuction
    machineState: string
    companies: readonly { id: string; started?: boolean }[]
    players: readonly { playerId: string }[]
}): void {
    const auction = state.companyAuction
    if (!auction) return
    assert(state.machineState === 'StockRound', 'A company auction belongs to a stock round')
    const company = state.companies.find((company) => company.id === auction.companyId)
    assert(company && !company.started, 'A company auction offers an unstarted company')
    assert(
        state.players.some((player) => player.playerId === auction.openerId),
        'Unknown company auction opener'
    )
}
