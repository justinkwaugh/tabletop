import { assertExists } from '@tabletop/common'
import {
    allSharesHeld,
    companyCharters,
    getCompany,
    marketSaleTerms,
    placeReservedHome,
    playersAfterPresident,
    presides,
    priorityOrder,
    sameOwner,
    sharesOwned,
    standardCertificateWeight,
    treasuryPoolId,
    type CompanyRules,
    type FinancialState,
    type Owner,
    type StockRoundRules,
    type StockRules
} from '@tabletop/18xx'
import {
    MetalCompanyKind,
    MetalIdsRoyalGorge,
    PrivateCardsRoyalGorge,
    RailroadIdsRoyalGorge,
    MetalsInvestorId,
    railroad
} from './companies.js'
import { homeLocationRoyalGorge } from './map.js'
import { BankPoolIdRoyalGorge, MetalBoardPoolIdRoyalGorge } from './names.js'
import { requireStateRoyalGorge } from './state.js'
import { MarketRoyalGorge, MarketZoneColorsRoyalGorge } from './stockMarket.js'
import { colorPhase, type ColorPhase } from './trains.js'

export const ChartersRoyalGorge = companyCharters(() => ({
    shareCounts: Object.fromEntries(
        [...RailroadIdsRoyalGorge, ...MetalIdsRoyalGorge].map((id) => [id, 10])
    ),
    privateRevenues: Object.fromEntries(
        PrivateCardsRoyalGorge.map((card) => [card.id, card.revenue])
    )
}))

export function isMetalCompany(state: Pick<FinancialState, 'companies'>, companyId: string) {
    return getCompany(state, companyId).kind === MetalCompanyKind
}

/** Certificate limits by player count; the rulebook's 12 for four is a typo (SR-10). */
const CertificateLimits: Readonly<Record<number, number>> = { 2: 20, 3: 14, 4: 10 }

const ColorOrder: readonly ColorPhase[] = ['Yellow', 'Green', 'Brown', 'Silver']
const TrancheColors: readonly ColorPhase[] = ['Yellow', 'Yellow', 'Green', 'Green', 'Brown']

/** The five railroads in the game, by establishment year: two yellow, two green, one brown. */
export function gameRailroadIds(state: object): string[] {
    return requireStateRoyalGorge(state)
        .companies.filter((company) => company.kind === 'major')
        .map((company) => company.id)
        .sort((a, b) => railroad(a).established - railroad(b).established)
}

/** The colour phase a railroad's shares become available in, by its establishment year (SC-1). */
export function trancheColor(state: object, companyId: string): ColorPhase | undefined {
    const index = gameRailroadIds(state).indexOf(companyId)
    return index < 0 ? undefined : TrancheColors[index]
}

/** Whether a railroad of the game may be started in the current phase (Fig. 1). */
export function railroadAvailable(state: object & { phaseId: string }, companyId: string): boolean {
    const tranche = trancheColor(state, companyId)
    return !!tranche && ColorOrder.indexOf(tranche) <= ColorOrder.indexOf(colorPhase(state.phaseId))
}

/** The market regions a railroad's par may be chosen from in this phase (Fig. 2). */
function parColors(phaseId: string): readonly string[] {
    const { yellow, green, brown } = MarketZoneColorsRoyalGorge
    switch (colorPhase(phaseId)) {
        case 'Yellow':
            return [yellow]
        case 'Green':
            return [yellow, green]
        default:
            return [yellow, green, brown]
    }
}

export const StockRoundRulesRoyalGorge: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: (state) => priorityOrder(state, StockRoundRulesRoyalGorge),
    // A company wholly held by players rises a space as the round ends, steel and gold too (SR-9).
    soldOut: (state, companyId) =>
        allSharesHeld(state, companyId, (certificate) => certificate.owner.kind === 'player')
}

export const StockRulesRoyalGorge: StockRules = {
    market: MarketRoyalGorge,
    charters: ChartersRoyalGorge,
    round: StockRoundRulesRoyalGorge,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    // A railroad's shares come from its treasury, paying the railroad, or the bank pool; steel
    // and gold shares from their board spaces, paying the bank (Buying, SR-5).
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed || certificate.president)
            return 'Choose an available share of a started company.'
        const pools = isMetalCompany(state, company.id)
            ? [MetalBoardPoolIdRoyalGorge]
            : [treasuryPoolId(company.id), BankPoolIdRoyalGorge]
        if (!certificate.poolId || !pools.includes(certificate.poolId))
            return 'This share is not for sale.'
        return {
            price: MarketRoyalGorge.companySpace(state.stockMarket, company.id).price,
            recipient: certificate.owner,
            payers: [buyer]
        }
    },
    // No sales in the first stock round (SR-1). A president's sale moves the price a space left
    // for each share (SR-4); steel and gold go back to the board, unmoved, without a limit
    // (SR-5, OQ-3). Shares bought with the Metals Investor wait for the next round (SR-14).
    saleTerms(state, companyId, shares, seller) {
        const company = getCompany(state, companyId)
        if (!company.started || company.closed) return 'This company has no shares to sell.'
        if (state.stockRound.number === 1 && !state.stockRound.completed)
            return 'No shares may be sold in the first stock round.'
        if (isMetalCompany(state, companyId)) {
            const held = investorHeld(state, companyId, seller)
            if (held && shares > sharesOwned(state, companyId, seller) - held)
                return 'Shares bought with the Metals Investor are held until the next stock round.'
            return marketSaleTerms(MarketRoyalGorge, state, companyId, {
                destinationPoolId: MetalBoardPoolIdRoyalGorge,
                marketLimit: 100,
                maximumShares: 10,
                movement: 0
            })
        }
        const president = presides(state, companyId, seller)
        return marketSaleTerms(MarketRoyalGorge, state, companyId, {
            destinationPoolId: BankPoolIdRoyalGorge,
            marketLimit: 50,
            maximumShares: 10,
            movement: president ? shares : 0
        })
    },
    certificateLimit(state) {
        const limit = CertificateLimits[state.players.length]
        assertExists(limit, 'Unsupported 18RoyalGorge player count')
        return limit
    },
    // Every certificate counts, every private included (SR-11).
    certificateWeight: (_state, certificate) => standardCertificateWeight(certificate),
    // No one holds more than 60% of any company, steel and gold included; 70% with two (SR-3).
    ownershipLimit: (state) => (state.players.length === 2 ? 70 : 60),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    presidentless: (state, companyId) => isMetalCompany(state, companyId),
    turnOrder: 'sell-buy',
    repeatSales: 'separate'
}

/** The shares of a metal company its seller bought with the Metals Investor this round. */
function investorHeld(state: object, companyId: string, seller: Owner): number {
    const title = requireStateRoyalGorge(state)
    if (seller.kind !== 'player' || !title.investorPurchases.includes(companyId)) return 0
    const investor = title.certificates.find(
        (certificate) => certificate.companyId === MetalsInvestorId
    )
    return investor && sameOwner(investor.owner, seller) ? 1 : 0
}

export const CompanyRulesRoyalGorge: CompanyRules = {
    // The game's railroads start once their tranche's phase has come, at a par from the
    // phase's regions; the president pays twice it to the treasury (SC-1, SC-2).
    startMarketSpaces(state, companyId) {
        if (!railroadAvailable(state, companyId)) return []
        const colors = parColors(state.phaseId)
        return MarketRoyalGorge.spaces
            .filter((space) => colors.includes(space.color))
            .map((space) => space.id)
    },
    startTerms: (_state, companyId, buyer, spaceId) => ({
        price: MarketRoyalGorge.space(spaceId).price * 2,
        recipient: { kind: 'company', companyId },
        payers: [buyer]
    }),
    flotationPayments: () => [],
    // The home station is placed at once (SC-4).
    onFloat(state, companyId) {
        placeReservedHome(state, companyId, homeLocationRoyalGorge(companyId))
        getCompany(state, companyId).funded = true
    }
}
