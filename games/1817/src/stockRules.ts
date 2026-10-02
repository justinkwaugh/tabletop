import { assert, assertExists } from '@tabletop/common'
import {
    StationPlacement,
    addCompanyStations,
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    issueShareCertificates,
    marketSaleTerms,
    playersAfterPresident,
    privateOwner,
    settleCashPayments,
    stockCertificateCount,
    type CashPayment,
    type CompanyAuctionRules,
    type CompanyAuctionState,
    type CompanyFormation,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { EighteenSeventeenStockRoundRules, MarketPoolId, treasuryPoolId } from './roundRules.js'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenStationRules } from './stationRules.js'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
import { EighteenSeventeenCompanySizes } from './trains.js'
import { inClosingZone } from './marketZones.js'

export const EighteenSeventeenCertificateLimits: Readonly<Record<number, number>> = {
    3: 21,
    4: 16,
    5: 13,
    6: 11,
    7: 9,
    8: 8,
    9: 7,
    10: 6,
    11: 6,
    12: 5
}
export const StationsBySize: Readonly<Record<number, number>> = { 2: 1, 5: 2, 10: 4 }
export const StationPrice = 50
const MaximumCompanyBid = 400

export function playerPrivateIds(state: StockState, playerId: string): string[] {
    return state.companies
        .filter((company) => {
            if (company.kind !== 'private' || company.closed) return false
            const owner = privateOwner(state, company.id)
            return owner?.kind === 'player' && owner.playerId === playerId
        })
        .map((company) => company.id)
}

function playerCash(state: StockState, playerId: string): number {
    const cash = cashOwnedBy(state, { kind: 'player', playerId })
    assert(typeof cash === 'number', 'A player holds finite cash')
    return cash
}

function privateValue(privateIds: readonly string[]): number {
    return privateIds.reduce((sum, id) => sum + EighteenSeventeenPrivateCatalog.faceValue(id), 0)
}

// A bid may be paid with any of the bidder's privates at face value, the rest in cash.
function privateValueSubsets(privateIds: readonly string[]): number[] {
    return privateIds.reduce<number[]>(
        (sums, id) => [...sums, ...sums.map((sum) => sum + privateValue([id]))],
        [0]
    )
}

function formationReason(state: CompanyAuctionState, formation: CompanyFormation) {
    const sizes = EighteenSeventeenCompanySizes[state.phaseId] ?? []
    if (!sizes.includes(formation.shareCount)) return 'This size is not available in this phase.'
    const owned = playerPrivateIds(state, formation.playerId)
    if (!formation.privateIds.every((id) => owned.includes(id)))
        return 'Only the winner’s own privates can be contributed.'
    const contributed = privateValue(formation.privateIds)
    if (contributed > formation.price)
        return 'The company cannot pay more for privates than the winning bid.'
    if (playerCash(state, formation.playerId) + contributed < formation.price)
        return 'Contribute enough privates to pay the winning bid.'
    const stations = StationsBySize[formation.shareCount] - 1
    if (formation.price - contributed < stations * StationPrice)
        return 'The company could not pay for its stations.'
    return undefined
}

function form(state: CompanyAuctionState, formation: CompanyFormation): void {
    const company = { kind: 'company' as const, companyId: formation.companyId }
    const player = { kind: 'player' as const, playerId: formation.playerId }
    const contributed = privateValue(formation.privateIds)
    const stations = StationsBySize[formation.shareCount] - 1
    const payments: CashPayment[] = [
        { from: player, to: company, amount: formation.price },
        { from: company, to: player, amount: contributed },
        { from: company, to: { kind: 'bank' }, amount: stations * StationPrice }
    ]
    settleCashPayments(
        state,
        payments.filter((payment) => payment.amount > 0)
    )
    for (const certificate of state.certificates)
        if (
            !certificate.retired &&
            certificate.kind === 'private' &&
            formation.privateIds.includes(certificate.companyId)
        ) {
            certificate.owner = company
            delete certificate.poolId
        }
    getCompany(state, formation.companyId).shareCount = formation.shareCount
    issueShareCertificates(state, formation.companyId, formation.shareCount - 2, {
        owner: company,
        poolId: treasuryPoolId(formation.companyId)
    })
    addCompanyStations(state, formation.companyId, stations)
}

export const EighteenSeventeenCompanyAuction: CompanyAuctionRules = {
    openingBid: 100,
    increment: 5,
    maximumBid(state, playerId) {
        const player = { kind: 'player' as const, playerId }
        if (
            stockCertificateCount(state, player, EighteenSeventeenStockRules) >=
            EighteenSeventeenStockRules.certificateLimit(state, player)
        )
            return 0
        return Math.min(
            MaximumCompanyBid,
            playerCash(state, playerId) + privateValue(playerPrivateIds(state, playerId))
        )
    },
    payable(state, playerId, amount) {
        const cash = playerCash(state, playerId)
        return privateValueSubsets(playerPrivateIds(state, playerId)).some(
            (value) => value <= amount && amount <= value + cash
        )
    },
    homes(state, companyId) {
        const placement = new StationPlacement(state, EighteenSeventeenStationRules)
        return EighteenSeventeenMap.definition.locations.flatMap((location) =>
            placement.mapState.tile(location.id).face.nodes.flatMap((node) => {
                const slot = placement.openSlots(companyId, location.id, node.id)[0]
                return slot === undefined
                    ? []
                    : [{ locationId: location.id, nodeId: node.id, slot }]
            })
        )
    },
    // The company starts on the highest space at or below half the winning bid.
    startSpace(state, price) {
        const half = Math.floor(price / 2)
        const space = state.stockMarket.spaces
            .filter((space) => space.price > 0 && space.price <= half)
            .reduce((best, space) => (space.price > best.price ? space : best))
        return space.id
    },
    formationReason,
    automaticFormation(state, pending) {
        const sizes = EighteenSeventeenCompanySizes[state.phaseId] ?? []
        if (sizes.length !== 1 || playerPrivateIds(state, pending.playerId).length) return undefined
        return { shareCount: sizes[0], privateIds: [] }
    },
    form
}

export const EighteenSeventeenStockRules: StockRules = {
    round: EighteenSeventeenStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started or is closed.'
        if (certificate.president) return 'The president’s certificate is won by auction.'
        if (inClosingZone(state.stockMarket, company.id))
            return 'Shares in the acquisition or liquidation zone cannot be bought.'
        const market = certificate.owner.kind === 'bank' && certificate.poolId === MarketPoolId
        const treasury =
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === company.id &&
            certificate.poolId === treasuryPoolId(company.id)
        if (!market && !treasury) return 'This certificate is not available for purchase.'
        return {
            price: companyMarketSpace(state.stockMarket, company.id).price * certificate.shares,
            recipient: certificate.owner,
            payers: [buyer]
        }
    },
    saleTerms(state, companyId, shares) {
        const company = getCompany(state, companyId)
        if (!company.shareCount || !company.president || company.closed)
            return 'This company has no saleable shares.'
        if (!company.operated) return 'Shares cannot be sold until the company has operated.'
        if (inClosingZone(state.stockMarket, companyId))
            return 'Shares in the acquisition or liquidation zone cannot be sold.'
        return marketSaleTerms(state, companyId, {
            destinationPoolId: MarketPoolId,
            marketLimit: 1000,
            maximumShares: shares,
            movement: 0
        })
    },
    certificateLimit(state) {
        const limit = EighteenSeventeenCertificateLimits[state.players.length]
        assertExists(limit, 'Unsupported 1817 player count')
        return limit
    },
    certificateWeight: (_state, certificate) =>
        certificate.kind === 'private' ? 0 : certificate.certificateLimitCount,
    ownershipLimit(state, companyId) {
        return getCompany(state, companyId).shareCount === 2 ? 100 : 60
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy',
    repeatSales: 'separate',
    companyAuction: EighteenSeventeenCompanyAuction
}
