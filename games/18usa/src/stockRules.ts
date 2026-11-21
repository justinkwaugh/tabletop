import { assertExists } from '@tabletop/common'
import {
    SizedCompanyAuction,
    StationPlacement,
    closePrivate,
    companyShareCount,
    controllingOwner,
    getCompany,
    sameOwner,
    sharesOwned,
    playersAfterPresident,
    solventPlayerCount,
    standardCertificateWeight,
    stockCertificateCount,
    type CompanyAuctionState,
    type CompanyFormation,
    type Owner,
    type ShareCertificate,
    type SharePurchaseTerms,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { EighteenUSACharters } from './charters.js'
import { EighteenUSAMarket, ParPriceRange } from './stockMarket.js'
import { EighteenUSAStockRoundRules } from './roundRules.js'
import { EighteenUSAMap } from './map.js'
import { EighteenUSAStationRules } from './stationRules.js'
import { EighteenUSAPrivateCatalog } from './privates.js'
import { EighteenUSACompanySizes, EighteenUSAPhases } from './trains.js'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { EighteenUSAStations } from './owedStations.js'
import { CarnegieSteelId, PyramidSchemeId } from './privateHolders.js'
import { certificateLimit } from './setup.js'
import { claimSubsidy, subsidyEquity } from './subsidyRules.js'
import { eighteenUSAOptions, type EighteenUSAState } from './state.js'
import { layMetropolisTile } from './metropolisRules.js'
import { grantBankruptRailroadTrain } from './bankruptRailroad.js'

type FormationState = CompanyAuctionState & EighteenUSAState

const HighStartPrice = 300
const HighStartPhaseId = '5'
const PresidentLimit = 60

/** Whether the variant lifts the president's limit now: in a stock round, never in M&A (§17). */
function presidentLimitLifted(state: StockState & Partial<EighteenUSAState>): boolean {
    return (
        eighteenUSAOptions(state).noPresidentLimit &&
        'machineState' in state &&
        state.machineState === 'StockRound'
    )
}

function isPresident(state: StockState, companyId: string, owner: Owner): boolean {
    const president = controllingOwner(state, companyId)
    return !!president && sameOwner(president, owner)
}

/**
 * With no 60% limit, a president holding more than 60% sells shares to other players while none
 * is for sale elsewhere (§17; BGG ruling VA-2).
 */
function sellsFromPresident(state: StockState, companyId: string): boolean {
    if (!presidentLimitLifted(state)) return false
    const president = controllingOwner(state, companyId)
    const shareCount = companyShareCount(state, EighteenUSACharters, companyId)
    if (!president || !shareCount) return false
    if (sharesOwned(state, companyId, president) * 100 <= PresidentLimit * shareCount) return false
    return !state.certificates.some(
        (other) =>
            other.kind === 'share' &&
            other.companyId === companyId &&
            typeof EighteenUSACompanyMarket.purchaseTerms(state, other, president) !== 'string'
    )
}

/** A president's share sold under the variant, at 10% above the price, rounded up (§17). */
function presidentSaleTerms(
    state: StockState,
    certificate: ShareCertificate,
    buyer: Owner
): SharePurchaseTerms | undefined {
    const { companyId } = certificate
    if (certificate.president || !sellsFromPresident(state, companyId)) return undefined
    if (!isPresident(state, companyId, certificate.owner) || sameOwner(certificate.owner, buyer))
        return undefined
    const price = EighteenUSACompanyMarket.price(state, companyId) * certificate.shares
    return {
        price: Math.ceil((price * 11) / 10),
        recipient: certificate.owner,
        payers: [buyer]
    }
}

// P10 makes a still empty candidate city a metropolis when it starts a company there; it closes
// with its contribution, as P14 does (P10, P14).
function contributePrivates(state: FormationState, formation: CompanyFormation): void {
    const home = formation.home.locationId
    if (formation.privateIds.includes(CarnegieSteelId)) {
        if (state.carnegieIds.includes(home) && !state.tileInventory.placements[home]) {
            layMetropolisTile(state, home)
            state.carnegieIds = state.carnegieIds.filter((id) => id !== home)
        }
        closePrivate(state, CarnegieSteelId)
    }
    if (formation.privateIds.includes(PyramidSchemeId)) closePrivate(state, PyramidSchemeId)
}

/**
 * Bids open at $100 and rise by at least $1, to the bidder's cash, privates and the city's cash
 * subsidy; the company starts at half the bid, between $50 and $200, and its treasury receives
 * twice that less the privates contributed (§11.6).
 */
export const EighteenUSACompanyAuction = new SizedCompanyAuction({
    market: EighteenUSACompanyMarket,
    stations: EighteenUSAStations,
    openingBid: 100,
    increment: 1,
    startPrices: (state: CompanyAuctionState & Pick<EighteenUSAState, 'highStartPrices'>) => ({
        minimum: ParPriceRange.minimum,
        maximum:
            eighteenUSAOptions(state).highStartPrices &&
            EighteenUSAPhases.isAtLeast(state.phaseId, HighStartPhaseId)
                ? HighStartPrice
                : ParPriceRange.maximum
    }),
    capital: (_price, startPrice) => 2 * startPrice,
    homeEquity: (state: FormationState, home) => subsidyEquity(state, home),
    privateFaceValue: (privateId) => EighteenUSAPrivateCatalog.faceValue(privateId),
    shareCounts(state) {
        const shareCounts = EighteenUSACompanySizes[state.phaseId]
        assertExists(shareCounts, 'Every 18USA phase names its company sizes')
        return shareCounts
    },
    homes(state, companyId) {
        const placement = new StationPlacement(state, EighteenUSAStationRules)
        return EighteenUSAMap.definition.locations.flatMap((location) =>
            placement.mapState.tile(location.id).face.nodes.flatMap((node) => {
                const slot = placement.openSlots(companyId, location.id, node.id)[0]
                return slot === undefined
                    ? []
                    : [{ locationId: location.id, nodeId: node.id, slot }]
            })
        )
    },
    atCertificateLimit(state, playerId) {
        const player = { kind: 'player' as const, playerId }
        return (
            stockCertificateCount(state, player, EighteenUSAStockRules) >=
            EighteenUSAStockRules.certificateLimit(state, player)
        )
    },
    formed(state: FormationState, formation) {
        claimSubsidy(state, formation)
        contributePrivates(state, formation)
        grantBankruptRailroadTrain(state, formation)
    }
})

export const EighteenUSAStockRules: StockRules = {
    market: EighteenUSAMarket,
    charters: EighteenUSACharters,
    round: EighteenUSAStockRoundRules,
    instructions: {
        securePresidency: (state, companyId, owner) =>
            EighteenUSACompanyMarket.securePresidency(state, companyId, owner)
    },
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const terms = EighteenUSACompanyMarket.purchaseTerms(state, certificate, buyer)
        return typeof terms === 'string'
            ? (presidentSaleTerms(state, certificate, buyer) ?? terms)
            : terms
    },
    // Shares may not be sold in the stock round the company started in (§11.1).
    saleTerms(state, companyId, shares) {
        if (!getCompany(state, companyId).operated)
            return 'Shares cannot be sold until the company has operated.'
        return EighteenUSACompanyMarket.marketSale(state, companyId, shares)
    },
    // Bankruptcies raise the limit to that of the players left (§15).
    certificateLimit: (state: StockState) =>
        certificateLimit(Math.max(2, solventPlayerCount(state))),
    certificateWeight: (_state, certificate) =>
        certificate.kind === 'private' ? 0 : standardCertificateWeight(certificate),
    sellsFromPlayers: sellsFromPresident,
    // A president may pass 60% in stock rounds under the variant (§17).
    ownershipLimit(state, companyId, buyer) {
        if (companyShareCount(state, EighteenUSACharters, companyId) === 2) return 100
        return presidentLimitLifted(state) && isPresident(state, companyId, buyer)
            ? 100
            : PresidentLimit
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    afterSale: (state) => EighteenUSACompanyMarket.closeMarketShortsAgainstPool(state),
    turnOrder: 'sell-buy',
    repeatSales: 'separate',
    companyAuction: EighteenUSACompanyAuction
}
