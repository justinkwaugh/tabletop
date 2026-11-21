import {
    NoCertificateLimit,
    allSharesHeld,
    companyCharters,
    fullCapitalizationCompanyRules,
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    sameOwner,
    sharesOwned,
    type CompanyRules,
    type StockRoundRules,
    type StockRules,
    type StockState,
    presidentOf
} from '@tabletop/18xx'
import { MajorIds1828, Privates1828 } from './companies.js'
import { CobourgRailwayId } from './ids.js'
import { IpoPoolId1828, MarketPoolId1828 } from './names.js'
import { requireState1828 } from './state.js'
import { Market1828, ParColors1828, stockPrice } from './stockMarket.js'
import { admitMohawkFloat } from './mohawkTiming.js'
import { isSystem } from './systems.js'
import { Phases1828, PurplePhaseId } from './trains.js'

export const Charters1828 = companyCharters(() => ({
    shareCounts: Object.fromEntries(MajorIds1828.map((companyId) => [companyId, 10])),
    privateRevenues: Object.fromEntries(
        Privates1828.map((company) => [company.id, company.revenue])
    ),
    unsharedCompanyIds: [CobourgRailwayId]
}))

const Trading = ipoMarketTrading({
    market: Market1828,
    charters: Charters1828,
    ipoPoolId: IpoPoolId1828,
    marketPoolId: MarketPoolId1828,
    // The bank pool has no limit (designer, BGG thread 2220106).
    marketLimit: 100
})

export const ShareTrading1828: typeof Trading = {
    ...Trading,
    // A system's shares cost its current price from the IPO as from the bank pool (§7.3).
    purchaseTerms(state, certificate, buyer) {
        const terms = Trading.purchaseTerms(state, certificate, buyer)
        if (typeof terms === 'string' || !isSystem(state, certificate.companyId)) return terms
        return { ...terms, price: stockPrice(state, certificate.companyId) * certificate.shares }
    }
}

const GrayZone = 'gray'
const zoneLimits = marketZoneHoldingLimits({
    market: Market1828,
    charters: Charters1828,
    certificateFreeColors: [],
    ownershipFreeColors: [GrayZone],
    ownershipPercent: 60
})

/** Whether the company's price stands in the gray area (§12.1). */
export function inGrayZone(state: StockState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        !!company.started &&
        !company.closed &&
        Market1828.companySpace(state.stockMarket, companyId).color === GrayZone
    )
}

export const StockRoundRules1828: StockRoundRules = {
    // The other colour's number cards record the order in which players passed and kept passing;
    // the next stock round follows them (§7.1).
    passing: 'pass-order',
    nextPlayerOrder: (state) => [...state.stockRound.passedPlayerIds],
    afterRound(state) {
        delete requireState1828(state).floatedThisStockRound
    },
    // No shares left in the IPO or the bank pool: a system's treasury share is in neither (§12.2).
    soldOut: (state, companyId) =>
        allSharesHeld(
            state,
            companyId,
            (certificate) =>
                certificate.owner.kind === 'player' ||
                (certificate.owner.kind === 'company' && certificate.owner.companyId === companyId)
        ),
    // One row, another when the director holds 80%, and another when the price started in the
    // gray area (§12.2).
    soldOutRises(state, companyId) {
        const president = presidentOf(state, companyId)
        const directorShares = president ? sharesOwned(state, companyId, president) : 0
        return 1 + (directorShares >= 8 ? 1 : 0) + (inGrayZone(state, companyId) ? 1 : 0)
    }
}

export const StockRules1828: StockRules = {
    // A standing instruction waits out a merger, which is the turn's action (§7.1).
    instructions: { held: (state) => !!requireState1828(state).merger },
    market: Market1828,
    charters: Charters1828,
    round: StockRoundRules1828,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: ShareTrading1828.purchaseTerms,
    saleTerms: ShareTrading1828.stockSaleTerms,
    // 1828 has no certificate limit (designer, BGG thread 2162382).
    certificateLimit: () => NoCertificateLimit,
    certificateWeight: zoneLimits.certificateWeight,
    // Players stop buying at 60% outside the gray area, and keep what they bought there when the
    // price leaves it (§7.3; designer, BGG thread 2162382).
    ownershipLimit(state, companyId, buyer) {
        const limit = zoneLimits.ownershipLimit(state, companyId, buyer)
        return limit === 100 ? limit : Math.max(limit, sharesOwned(state, companyId, buyer) * 10)
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-sell',
    // Shares of a company sold in one turn go together at the price they started from (§7.2).
    repeatSales: 'extend-block',
    // A gray-area company's director may buy two of its shares in one turn, from the IPO or the
    // bank pool (§7.3, §12.1). A turn spent on a merger or the M&H records no first share (§7.1).
    multipleBuys: {
        allowsAnother(state, certificate, earlier) {
            const president = presidentOf(state, certificate.companyId)
            const buyer = state.activePlayerIds[0]
            return (
                earlier.length === 1 &&
                inGrayZone(state, certificate.companyId) &&
                !!president &&
                !!buyer &&
                sameOwner(president, { kind: 'player', playerId: buyer })
            )
        }
    }
}

/** The par colours open in a phase: yellow, then green, blue and brown as their trains come (§17). */
function parColors(phaseId: string): readonly string[] {
    const opened = { yellow: '2', green: '3', blue: '5', brown: '3+D' } as const
    return ParColors1828.filter((color) => Phases1828.isAtLeast(phaseId, opened[color]))
}

function parSpaceIds(colors: readonly string[]): string[] {
    return Market1828.spaces
        .filter((space) => colors.includes(space.color))
        .sort((a, b) => a.price - b.price)
        .map((space) => space.id)
}

const Capitalization = fullCapitalizationCompanyRules({
    market: Market1828,
    charters: Charters1828,
    ipoPoolId: IpoPoolId1828,
    parSpaceColor: 'yellow',
    floatPercent: 60
})

export const CompanyRules1828: CompanyRules = {
    ...Capitalization,
    // The phase's pars; no director's certificate is bought in purple phase (§7.4, §17.7).
    startMarketSpaces: (state) =>
        Phases1828.isAtLeast(state.phaseId, PurplePhaseId)
            ? []
            : parSpaceIds(parColors(state.phaseId)),
    // A $250 private's buyer sets a yellow par (§6.3).
    awardParSpaces: () => parSpaceIds(['yellow']),
    // A system floating after its merger receives ten times its price at that moment (§7.5.2).
    flotationPayments(state, companyId) {
        const payments = Capitalization.flotationPayments(state, companyId)
        if (!payments?.length || !isSystem(state, companyId)) return payments
        const amount = stockPrice(state, companyId) * 10
        return payments.map((payment) => ({ ...payment, amount }))
    },
    onFloat(state, companyId) {
        const title = requireState1828(state)
        admitMohawkFloat(title)
        if (state.stockRound.completed) return
        title.floatedThisStockRound = [
            ...new Set([...(title.floatedThisStockRound ?? []), companyId])
        ]
    },
    parAfterAward: true
}
