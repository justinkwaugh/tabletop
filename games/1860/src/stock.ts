import {
    NoCertificateLimit,
    certificatesInPool,
    fullCapitalizationPayments,
    getCompany,
    marketSaleTerms,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    presidentCertificate,
    sharesStillToFloat,
    type CompanyRules,
    type FormationState,
    type Owner,
    type PrivateRules,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    Charters1860,
    Companies1860,
    DirectorShares,
    LayerParRanges,
    PrivateCatalog1860,
    RefloatMinimumPar,
    company1860,
    exchangeCompanyId,
    isCompany1860,
    type Layer
} from './companies.js'
import { shareValue } from './ending.js'
import { IpoPoolId, MarketPoolId } from './names.js'
import { requireState1860 } from './state.js'
import { homeHexBare, placeHomeBase } from './stations.js'
import {
    Market1860,
    ParPrices1860,
    RefloatPrices1860,
    ignoresFirstSale,
    marketSpaceIdAt
} from './stockMarket.js'
import { NoCertificateLimitPhaseId, Phases1860 } from './trains.js'

/** The certificate limit by player count (Certificate Limit). */
export const CertificateLimits1860: Readonly<Record<number, number>> = { 2: 32, 3: 21, 4: 16 }

/** From the first 8+4 train: no certificate limit, and sales no longer move prices (Phase 8). */
export function stockRestrictionsLifted(state: { phaseId: string }): boolean {
    return Phases1860.isAtLeast(state.phaseId, NoCertificateLimitPhaseId)
}

export function certificateLimit1860(state: StockState): number {
    if (stockRestrictionsLifted(requireState1860(state))) return NoCertificateLimit
    const limit = CertificateLimits1860[state.players.length]
    assertExists(limit, '1860 supports two to four players')
    return limit
}

/**
 * The share of a company kept for its private's exchange: at the bottom of the IPO pile, and
 * not for sale until that private closes (Exchanging Private Companies).
 */
export function reservedShareId(companyId: string): string | undefined {
    return company1860(companyId).exchangePrivateId ? `${companyId}:share:8` : undefined
}

function reservedShareLocked(state: StockState, certificateId: string): boolean {
    const company = Companies1860.find((entry) => reservedShareId(entry.id) === certificateId)
    if (!company?.exchangePrivateId) return false
    return !getCompany(state, company.exchangePrivateId).closed
}

/**
 * Whether the company has left the IPO's offer: every share it may sell there bought, the
 * reserved share counting as unsold until its private closes.
 */
function soldOutOfIpo(state: StockState, companyId: string): boolean {
    return !certificatesInPool(state, IpoPoolId).some(
        (certificate) => certificate.kind === 'share' && certificate.companyId === companyId
    )
}

/**
 * The highest layer open to start: the first, and each one after a company of the layer before
 * has operated or sold out of the IPO (Major Companies). A bankrupt company has operated, so the
 * layers stay open.
 */
export function openLayer(state: StockState): Layer {
    let layer: Layer = 1
    for (const next of [2, 3, 4] as const) {
        const opened = Companies1860.filter((company) => company.layer === next - 1).some(
            (company) => getCompany(state, company.id).operated || soldOutOfIpo(state, company.id)
        )
        if (!opened) break
        layer = next
    }
    return layer
}

export function isBankrupt(state: object, companyId: string): boolean {
    return requireState1860(state).bankruptIds.includes(companyId)
}

/**
 * The prices a company may start at: its layer's par prices, or, starting again after
 * bankruptcy, any market price from 40 to its layer's highest par (Major Companies; Bankrupt
 * Companies).
 */
export function startPrices(state: StockState, companyId: string): readonly number[] {
    const { layer } = company1860(companyId)
    const { minimum, maximum } = LayerParRanges[layer]
    if (isBankrupt(state, companyId))
        return RefloatPrices1860.filter((price) => price >= RefloatMinimumPar && price <= maximum)
    return ParPrices1860.filter((price) => price >= minimum && price <= maximum)
}

/** Whether a company may be started now: of an open layer, not started, and not under way. */
export function canStart(state: FormationState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        isCompany1860(companyId) &&
        !company.started &&
        !company.closed &&
        company1860(companyId).layer <= openLayer(state) &&
        !requireState1860(state).nationalisation
    )
}

/**
 * The places a sale moves the price down: one for each share once the company has operated, the
 * first share of the sale unmoving in the red-letter zones, and none from phase 8 (Share Price
 * Movement).
 */
export function saleMovement(state: StockState, companyId: string, shares: number): number {
    const company = getCompany(state, companyId)
    if (!company.operated || stockRestrictionsLifted(requireState1860(state))) return 0
    const price = Market1860.companySpace(state.stockMarket, companyId).price
    return Math.max(0, shares - (ignoresFirstSale(price) ? 1 : 0))
}

export const StockRules1860: StockRules = {
    market: Market1860,
    charters: Charters1860,
    round: {
        passing: 'consecutive',
        // The first to deal is the player after the last who bought or sold (Stock Rounds).
        nextPlayerOrder: playerOrderAfterLastTurn,
        soldOut: () => false
    },
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    // From the IPO at par, or from the bank pool at the market price; the director's share is
    // never bought from the pool, but claimed by a second share (Companies In Receivership).
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started.'
        if (certificate.president) return 'The director’s share is not for sale.'
        if (reservedShareLocked(state, certificate.id))
            return 'This share waits for its private company’s exchange.'
        const price =
            certificate.poolId === IpoPoolId
                ? company.parPrice
                : certificate.poolId === MarketPoolId
                  ? Market1860.companySpace(state.stockMarket, company.id).price
                  : undefined
        if (price === undefined) return 'This certificate is not for sale.'
        return { price: price * certificate.shares, recipient: { kind: 'bank' }, payers: [buyer] }
    },
    // Shares sell to the bank pool at the market price, half for a company without a train.
    saleTerms(state, companyId, shares) {
        const company = getCompany(state, companyId)
        if (!company.started || company.closed) return 'This company has no saleable shares.'
        return {
            ...marketSaleTerms(Market1860, state, companyId, {
                destinationPoolId: MarketPoolId,
                marketLimit: 100,
                maximumShares: 10,
                movement: saleMovement(state, companyId, shares)
            }),
            price: shareValue(state, companyId)
        }
    },
    certificateLimit: certificateLimit1860,
    // Director's certificates and privates count as one certificate each (Certificate Limit).
    certificateWeight: () => 1,
    ownershipLimit: () => 100,
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    presidencyLapses: true,
    turnOrder: 'sell-buy'
}

/**
 * A company floats once players hold half its shares bought from the IPO, shares in the bank
 * pool not counting; it receives ten times its par (Flotation & Capitalisation).
 */
function flotationPayments(state: FormationState, companyId: string) {
    const remaining = sharesStillToFloat(
        state,
        Charters1860,
        companyId,
        50,
        (certificate) => certificate.poolId === IpoPoolId || certificate.poolId === MarketPoolId
    )
    return fullCapitalizationPayments(state, Charters1860, companyId, remaining)
}

export const CompanyRules1860: CompanyRules = {
    startMarketSpaces: (state, companyId) =>
        canStart(state, companyId) ? startPrices(state, companyId).map(marketSpaceIdAt) : [],
    // The director's share costs twice the par (Buying and Selling Shares).
    startTerms(state, companyId, buyer: Owner, marketSpaceId) {
        const certificate = presidentCertificate(state, companyId)
        if (!certificate || certificate.poolId !== IpoPoolId)
            return 'The director’s share must be in the IPO.'
        return {
            price: Market1860.space(marketSpaceId).price * DirectorShares,
            recipient: { kind: 'bank' },
            payers: [buyer]
        }
    },
    flotationPayments,
    onFloat: (state, companyId) => floatCompany1860(state, companyId)
}

/**
 * Floating places the home base on its home hex, or turns the bases of a company starting again
 * face up; a bare home hex then takes a tile from the director (Flotation; Bankrupt Companies).
 */
export function floatCompany1860(state: FormationState, companyId: string): void {
    const title = requireState1860(state)
    // A company starting again after bankruptcy is insolvent only from the end of its first
    // turn, as any company is (Bankrupt Companies; BK-7).
    if (title.bankruptIds.includes(companyId))
        title.insolventIds = title.insolventIds.filter((id) => id !== companyId)
    title.bankruptIds = title.bankruptIds.filter((id) => id !== companyId)
    placeHomeBase(title, companyId)
    if (homeHexBare(title, companyId) && !title.southernStockRound)
        title.homeTileCompanyId = companyId
}

export const PrivateRules1860: PrivateRules = {
    // A ferry company is exchanged, in its owner's stock turn and as no action, for its
    // company's reserved share once that company has a par (Exchanging Private Companies).
    exchangeTerms(state, privateCompanyId) {
        const companyId = exchangeCompanyId(privateCompanyId)
        if (!companyId) return undefined
        const company = getCompany(state, companyId)
        const certificateId = reservedShareId(companyId)
        const reserved = state.certificates.find((entry) => entry.id === certificateId)
        if (!company.started || company.closed || !reserved || reserved.poolId !== IpoPoolId)
            return undefined
        return {
            certificateIds: [reserved.id],
            timing: 'own-stock-turn',
            stockAction: 'none',
            ownershipLimit: 'ordinary'
        }
    },
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, privateCompanyId) =>
        PrivateCatalog1860.definition(privateCompanyId).description ?? ''
}
