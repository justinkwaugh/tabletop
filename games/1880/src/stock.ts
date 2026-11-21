import { assert, assertExists } from '@tabletop/common'
import {
    certificatesInPool,
    chargePlayerLoanInterest,
    HalfAgainInterest,
    companyCharters,
    getCompany,
    playerLoan,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    presidentCertificate,
    presidentOf,
    presides,
    sameOwner,
    settleCashPayments,
    sharesOwned,
    type CompanyRules,
    type FormationState,
    type OpenShare,
    type PlayerLoanRules,
    type StartChoice,
    type StockRoundRules,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { BcrId, ForeignInvestors1880, Majors1880, Privates1880 } from './companies.js'
import { BankPoolId1880, ReservePoolId1880 } from './names.js'
import { requireState1880 } from './state.js'
import { Market1880, ParSlotsPerPrice, ParSpaceIds1880 } from './stockMarket.js'
import { CommunistPhaseId, Phases1880, ReopeningPhaseId } from './trains.js'

const InvestorIds: readonly string[] = ForeignInvestors1880.map((investor) => investor.id)
export const MajorIds1880: readonly string[] = Majors1880.map((company) => company.id)

export function isInvestor(companyId: string): boolean {
    return InvestorIds.includes(companyId)
}

export const Charters1880 = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...Majors1880.map((company) => [company.id, 10]),
        // A foreign investor is held whole, by its one certificate (§VII).
        ...ForeignInvestors1880.map((investor) => [investor.id, 2])
    ]),
    privateRevenues: Object.fromEntries(
        Privates1880.map((company) => [company.id, company.revenue])
    )
}))

/** The Communist Takeover holds from the first 4-train to the first 6-train (§XIV). */
export function communist(state: { phaseId: string }): boolean {
    return (
        Phases1880.isAtLeast(state.phaseId, CommunistPhaseId) &&
        !Phases1880.isAtLeast(state.phaseId, ReopeningPhaseId)
    )
}

/** The second half of every major's shares goes on sale with the first 3-train (§XI). */
export function allSharesOnSale(state: { phaseId: string }): boolean {
    return Phases1880.isAtLeast(state.phaseId, 'B1')
}

/** What the director must hold to float, by phase (§XII Inauguration). */
export function floatPercent(phaseId: string): number {
    if (Phases1880.isAtLeast(phaseId, 'C2')) return 60
    if (Phases1880.isAtLeast(phaseId, 'B3')) return 40
    if (Phases1880.isAtLeast(phaseId, 'B1')) return 30
    return 20
}

/** The broker's fee on each share sold, even under communism (§XII Sale of Shares). */
export const BrokerFee = 5

/** Certificate limits by player count (§XII). */
const CertificateLimits: Readonly<Record<number, number>> = { 3: 20, 4: 16, 5: 14, 6: 12, 7: 11 }

const onSale = (state: Pick<FormationState, 'certificates'>, companyId: string): OpenShare[] =>
    state.certificates.filter(
        (certificate): certificate is OpenShare =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.owner.kind === 'bank' &&
            certificate.poolId === BankPoolId1880
    )

/** The company's shares the bank holds: those on sale and those still reserved (§XII). */
export function bankShares(state: Pick<FormationState, 'certificates'>, companyId: string): number {
    return state.certificates
        .filter(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'bank'
        )
        .reduce(
            (sum, certificate) => sum + (certificate.kind === 'share' ? certificate.shares : 0),
            0
        )
}

export const StockRoundRules1880: StockRoundRules = {
    passing: 'consecutive',
    // Priority passes to the left of the last player to buy or sell (§XII).
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company none of whose shares on sale remain in the bank rises (§XIII); its reserved
    // shares and its investor's share are not on sale.
    soldOut: (state, companyId) =>
        !!getCompany(state, companyId).started &&
        MajorIds1880.includes(companyId) &&
        onSale(state, companyId).length === 0,
    soldOutRises: (state) => (communist(state) ? 0 : 1),
    // Debts grow by half again as each share round ends (§X Forced Train Purchase).
    afterRound: (state) => {
        chargePlayerLoanInterest(requireState1880(state), PlayerLoanRules1880)
    }
}

/** A debt grows by half again as it is taken and as each share round ends (§X). */
export const PlayerLoanRules1880: PlayerLoanRules = {
    interest: HalfAgainInterest,
    repaidTo: 'bank'
}

const owesMoney = (state: StockState, playerId: string) =>
    playerLoan(requireState1880(state), playerId) > 0

export const StockRules1880: StockRules = {
    market: Market1880,
    charters: Charters1880,
    round: StockRoundRules1880,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    // Shares come from the bank at the current price; a player owing money buys none (§X, §XII).
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started.'
        if (certificate.president) return 'Start the company to buy its director’s certificate.'
        if (certificate.owner.kind !== 'bank' || certificate.poolId !== BankPoolId1880)
            return 'This share is not on sale.'
        if (buyer.kind === 'player' && owesMoney(state, buyer.playerId))
            return 'A player owing money must repay it before buying shares.'
        return {
            price:
                Market1880.companySpace(state.stockMarket, company.id).price * certificate.shares,
            recipient: { kind: 'bank' },
            payers: [buyer]
        }
    },
    saleTerms(state, companyId, shares, seller) {
        if (state.stockRound.number === 1) return 'No shares are sold in the first share round.'
        return saleTerms1880(state, companyId, shares, seller)
    },
    certificateLimit(state) {
        const limit = CertificateLimits[state.players.length]
        assertExists(limit, 'Unsupported 1880 player count')
        return limit
    },
    // Privates and foreign investors are free of the limit; a director's certificate counts once.
    certificateWeight: (_state, certificate) =>
        certificate.kind === 'private' || isInvestor(certificate.companyId) ? 0 : 1,
    // A player may own a whole company (§XII).
    ownershipLimit: () => 100,
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy',
    afterSharePurchase(state, details) {
        receiveSecondCapital(requireState1880(state), details.companyId)
    }
}

/**
 * Shares sold go back to the bank at the current price, less ¥5 each; each share sold drops
 * the price a row, but nothing moves under communism, when directors may not sell their own
 * company (§XII, §XIII, §XIV). A company's marker joins the share price chart only as it floats,
 * so until then its price stays at its par (§XII Inauguration).
 */
export function saleTerms1880(
    state: StockState,
    companyId: string,
    shares: number,
    seller: Parameters<StockRules['saleTerms']>[3]
): ReturnType<StockRules['saleTerms']> {
    const company = getCompany(state, companyId)
    if (!MajorIds1880.includes(companyId) || !company.started || company.closed)
        return 'This company has no saleable shares.'
    if (communist(state) && presides(state, companyId, seller))
        return 'Under communism a director may not sell their own company’s shares.'
    const frozen = communist(state) || !company.floated
    return {
        payer: { kind: 'bank' },
        price: Market1880.companySpace(state.stockMarket, companyId).price - BrokerFee,
        direction: 'down',
        destinationPoolId: BankPoolId1880,
        marketLimit: 100,
        maximumShares: 10,
        movement: frozen ? 0 : shares
    }
}

/**
 * Once the first 3-train is bought, a company with no more than five of its shares left in the
 * bank receives the second half of its capital, five times its par (§XII Capitalisation).
 */
export function receiveSecondCapital(
    state: ReturnType<typeof requireState1880>,
    companyId: string
): void {
    const company = getCompany(state, companyId)
    if (
        !MajorIds1880.includes(companyId) ||
        !allSharesOnSale(state) ||
        !company.floated ||
        state.fullyCapitalized.includes(companyId) ||
        bankShares(state, companyId) > 5
    )
        return
    assertExists(company.parPrice, 'A floated company has its par')
    settleCashPayments(state, [
        { from: { kind: 'bank' }, to: { kind: 'company', companyId }, amount: company.parPrice * 5 }
    ])
    state.fullyCapitalized = [...state.fullyCapitalized, companyId]
}

/** The phases a director's certificate's size lets a company choose its permits from (§VIII). */
const PermitChoices: Readonly<Record<number, readonly string[]>> = {
    2: ['ABC', 'BCD'],
    3: ['AB', 'BC', 'CD'],
    4: ['A', 'B', 'C', 'D']
}

const permitChoice = (presidentShares: number): StartChoice => ({
    id: 'permits',
    label: 'Building permits',
    options: (PermitChoices[presidentShares] ?? []).map((permit) => ({
        id: permit,
        label: permit
    }))
})

/** The slots of a par price no company has taken, top first (§XII). */
export function freeParSlots(state: FormationState, marketSpaceId: string): number[] {
    const titleState = requireState1880(state)
    const price = Market1880.space(marketSpaceId).price
    const taken = Object.entries(titleState.parSlots)
        .filter(([companyId]) => getCompany(state, companyId).parPrice === price)
        .map(([, slot]) => slot)
    return Array.from({ length: ParSlotsPerPrice }, (_, slot) => slot).filter(
        (slot) => !taken.includes(slot)
    )
}

const slotChoice = (state: FormationState, marketSpaceId: string): StartChoice => ({
    id: 'slot',
    label: 'Operating order slot',
    options: freeParSlots(state, marketSpaceId).map((slot) => ({
        id: String(slot),
        label: `Slot ${slot + 1}`
    }))
})

/**
 * As a player starts their first company, a share of it goes onto their foreign investor's
 * charter, reserved for them, from the shares on sale (§VII).
 */
export function reserveInvestorShare(state: FormationState, companyId: string): void {
    const president = presidentOf(state, companyId)
    if (president?.kind !== 'player') return
    const investor = ForeignInvestors1880.find((entry) => {
        const certificate = presidentCertificate(state, entry.id)
        return (
            certificate?.owner.kind === 'player' &&
            certificate.owner.playerId === president.playerId &&
            !getCompany(state, entry.id).closed
        )
    })
    if (!investor) return
    if (
        state.certificates.some((certificate) =>
            sameOwner(certificate.owner, investorOwner(investor.id))
        )
    )
        return
    const share = onSale(state, companyId).at(-1)
    assertExists(share, 'A share remains on sale for the investor')
    share.owner = investorOwner(investor.id)
    delete share.poolId
}

const investorOwner = (investorId: string) => ({ kind: 'company' as const, companyId: investorId })

export const CompanyRules1880: CompanyRules = {
    startMarketSpaces: (state, companyId) =>
        companyId === BcrId || !Privates1880.every((item) => privateSold(state, item.id))
            ? []
            : ParSpaceIds1880.filter((spaceId) => freeParSlots(state, spaceId).length > 0),
    startTerms(state, companyId, buyer, marketSpaceId) {
        const certificate = presidentCertificate(state, companyId)
        if (!certificate || certificate.owner.kind !== 'bank')
            return 'The director’s certificate is not on sale.'
        if (buyer.kind === 'player' && owesMoney(state, buyer.playerId))
            return 'A player owing money must repay it before buying shares.'
        return {
            price: Market1880.space(marketSpaceId).price * certificate.shares,
            recipient: { kind: 'bank' },
            payers: [buyer]
        }
    },
    // The director chooses a 20%, 30% or 40% certificate; the BCR's is 20% (§VI, §XII).
    presidentShareSizes: (_state, companyId) => (companyId === BcrId ? [2] : [2, 3, 4]),
    certificatesReplacedByPresident: (state, companyId) =>
        onSale(state, companyId)
            .map((certificate) => certificate.id)
            .reverse(),
    startChoices: (state, companyId, { marketSpaceId, presidentShares }) => [
        slotChoice(state, marketSpaceId),
        permitChoice(presidentShares)
    ],
    applyStartChoices(stateObject, companyId, choices) {
        const state = requireState1880(stateObject)
        const slot = Number(choices.slot)
        assert(Number.isInteger(slot), 'A start chooses its slot')
        state.parSlots = { ...state.parSlots, [companyId]: slot }
        state.permits = { ...state.permits, [companyId]: choices.permits }
        reserveInvestorShare(state, companyId)
    },
    floatsAtRoundEnd: true,
    sharesToFloat(state, companyId) {
        const company = getCompany(state, companyId)
        const president = presidentOf(state, companyId)
        if (!company.started || company.floated || !president) return undefined
        const needed = floatPercent(state.phaseId) / 10 - sharesOwned(state, companyId, president)
        return Math.max(0, Math.min(needed, onSale(state, companyId).length))
    },
    // The director holds the phase's share, or none remain on sale; the company then receives
    // five times its par (§XII).
    flotationPayments(state, companyId) {
        if (!MajorIds1880.includes(companyId)) return undefined
        if (CompanyRules1880.sharesToFloat?.(state, companyId) !== 0) return undefined
        const parPrice = getCompany(state, companyId).parPrice
        assertExists(parPrice, 'A started company has its par')
        return [
            { from: { kind: 'bank' }, to: { kind: 'company', companyId }, amount: parPrice * 5 }
        ]
    },
    onFloat(state, companyId) {
        receiveSecondCapital(requireState1880(state), companyId)
    },
    parAfterAward: true,
    awardParSpaces: () => [ParSpaceIds1880[0]]
}

function privateSold(state: FormationState, privateId: string): boolean {
    const company = getCompany(state, privateId)
    if (company.closed) return true
    return !state.certificates.some(
        (certificate) => certificate.companyId === privateId && certificate.owner.kind === 'bank'
    )
}

/** The reserved shares go on sale as the first 3-train is bought (§XI). */
export function releaseReservedShares(state: FormationState): void {
    for (const certificate of certificatesInPool(state, ReservePoolId1880))
        if (certificate.kind === 'share') certificate.poolId = BankPoolId1880
}
