import {
    RailwayMapState,
    StationPlacement,
    finiteCashOwnedBy,
    getCompany,
    marketSaleTerms,
    stockCertificateCount,
    settleCashPayments,
    treasuryShareStockRules,
    type CompanyAuctionRules,
    type CompanyRules,
    type FormationState,
    type MapStateData,
    type StationPosition,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import {
    BidIncrement1867,
    Charters1867,
    MinorOpeningBid,
    certificateLimit1867,
    minor1867,
    ownershipLimitPercent1867
} from './companies.js'
import { Map1867 } from './map.js'
import { MarketPoolId1867 } from './names.js'
import { requireState1867 } from './state.js'
import { StartHomes1867, StationRules1867 } from './stations.js'
import { Market1867, MajorStartSpaceIds1867, minorStartSpace } from './stockMarket.js'
import { TileSet1867 } from './tiles.js'
import {
    LaterMinorsPhaseId,
    MajorStartPhaseId,
    MinorAuctionEndPhaseId,
    Phases1867
} from './trains.js'

const certificateLimit = (state: StockState) => certificateLimit1867(state.players.length)

const Trading = treasuryShareStockRules({
    market: Market1867,
    charters: Charters1867,
    marketPoolId: MarketPoolId1867,
    launchColor: 'pink',
    certificateLimit,
    ownershipLimit: (state) => ownershipLimitPercent1867(state.players.length)
})

function atCertificateLimit(state: StockState, playerId: string): boolean {
    return (
        stockCertificateCount(state, { kind: 'player', playerId }, StockRules1867) >=
        certificateLimit(state)
    )
}

/**
 * Whether a company no one has started is on offer in this phase: the ten yellow minors before
 * phase 5, the six green ones from phase 3, and majors from phase 4 (GTG §3.2, §7.2, §7.4).
 */
export function companyOnOffer1867(state: FormationState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    if (company.started || company.closed) return false
    const minor = minor1867(companyId)
    if (!minor)
        return company.kind === 'major' && Phases1867.isAtLeast(state.phaseId, MajorStartPhaseId)
    if (Phases1867.isAtLeast(state.phaseId, MinorAuctionEndPhaseId)) return false
    return minor.available !== 'phase-3' || Phases1867.isAtLeast(state.phaseId, LaterMinorsPhaseId)
}

/**
 * A minor's station goes in any city with no station in it: each of a hex's separate cities on
 * its own, the spaces printed green only from phase 3 (GTG §7.2.1).
 */
export function minorHomes1867(state: FormationState & MapStateData, companyId: string) {
    const mapState = new RailwayMapState(Map1867, TileSet1867, state.tileInventory)
    const placement = new StationPlacement(state, StationRules1867)
    return Map1867.definition.locations.flatMap((location) =>
        mapState.tile(location.id).face.nodes.flatMap((node): StationPosition[] => {
            if (node.kind !== 'city') return []
            const occupied = state.stations.some(
                (station) =>
                    station.status === 'placed' &&
                    station.position.locationId === location.id &&
                    station.position.nodeId === node.id
            )
            if (occupied) return []
            const [slot] = placement.openSlots(companyId, location.id, node.id)
            return slot === undefined ? [] : [{ locationId: location.id, nodeId: node.id, slot }]
        })
    )
}

const MinorAuction1867: CompanyAuctionRules = {
    openingBid: MinorOpeningBid,
    increment: BidIncrement1867,
    // A player at the certificate limit takes no further certificate (GTG §7.5).
    maximumBid: (state, playerId) =>
        atCertificateLimit(state, playerId)
            ? 0
            : finiteCashOwnedBy(state, { kind: 'player', playerId }),
    formable: (state, playerId, amount) =>
        amount <= finiteCashOwnedBy(state, { kind: 'player', playerId }),
    homes: (state, companyId) =>
        minor1867(companyId) && companyOnOffer1867(state, companyId)
            ? minorHomes1867(requireState1867(state), companyId)
            : [],
    startSpace: (_state, price) => minorStartSpace(price).id,
    shareCounts: () => [2],
    contributions: () => [],
    contributionValue: () => 0,
    formationReason: () => undefined,
    // The winner pays the minor's treasury (GTG §7.2.1).
    form(state, formation) {
        settleCashPayments(state, [
            {
                from: { kind: 'player', playerId: formation.playerId },
                to: { kind: 'company', companyId: formation.companyId },
                amount: formation.price
            }
        ])
        const company = getCompany(state, formation.companyId)
        company.floated = true
        company.funded = true
    },
    nextTurnFollowsWinner: (state) => !requireState1867(state).variants.proposerOrder
}

export const StockRules1867: StockRules = {
    ...Trading,
    // Only a major wholly in players' hands rises as the round ends (GTG §7.6).
    round: {
        ...Trading.round,
        poolDrop: undefined,
        soldOut: (state, companyId) =>
            getCompany(state, companyId).kind === 'major' && Trading.round.soldOut(state, companyId)
    },
    // Nothing is sold before its company has operated; only the President's sales move the price,
    // a space a turn however many are sold (GTG §7.3).
    saleTerms(state, companyId, shares, seller) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || !company.operated)
            return 'Shares are sold only once their company has operated.'
        const terms = Trading.saleTerms(state, companyId, shares, seller)
        if (typeof terms === 'string') return terms
        return marketSaleTerms(Market1867, state, companyId, {
            destinationPoolId: MarketPoolId1867,
            marketLimit: 50,
            maximumShares: 10,
            movement: terms.movement
        })
    },
    companyAuction: MinorAuction1867
}

/** A major is started from phase 4 by buying its President's certificate at $70 to $200 (GTG §7.4). */
export const CompanyRules1867: CompanyRules = {
    startMarketSpaces(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || company.started || company.closed) return []
        if (!Phases1867.isAtLeast(state.phaseId, MajorStartPhaseId)) return []
        return [...MajorStartSpaceIds1867]
    },
    startTerms: (_state, companyId, buyer, marketSpaceId) => ({
        price: Market1867.space(marketSpaceId).price * 2,
        recipient: { kind: 'company', companyId },
        payers: [buyer]
    }),
    flotationPayments: () => [],
    startHomes: (state: FormationState & MapStateData, companyId) =>
        StartHomes1867.homes(state, companyId)
}
