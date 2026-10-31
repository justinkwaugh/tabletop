import { assertExists } from '@tabletop/common'
import type { CompanyCharters } from '../company/companyCharters.js'
import type { CompanyRules } from '../company/companyRules.js'
import { getCompany, sameOwner, treasuryPoolId, type FinancialState } from '../finance/finance.js'
import type { StationState } from '../map/station.js'
import { allSharesHeld } from './stockRoundRules.js'
import { priorityOrder } from './priorityOrder.js'
import { playersAfterPresident } from './presidency.js'
import type { StockMarketChart } from './stockMarket.js'
import { marketSaleTerms, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

/**
 * A corporation launched by its president's certificate at a chosen price, paying twice that
 * into its treasury, whose other shares are bought from its treasury or the market at the
 * market price, the money going to whoever held them: 1846 and its descendants.
 */
export type TreasuryShareTrading = {
    market: StockMarketChart
    charters: CompanyCharters
    marketPoolId: string
    /** The market zone a launching corporation's price is chosen from. */
    launchColor: string
    certificateLimit(state: StockState): number
    ownershipLimit(state: StockState, companyId: string): number
}

export function treasuryShareStockRules(trading: TreasuryShareTrading): StockRules {
    const { market, charters, marketPoolId } = trading
    const rules: StockRules = {
        market,
        charters,
        round: {
            passing: 'consecutive',
            nextPlayerOrder: (state) => priorityOrder(state, rules.round),
            soldOut: (state, id) =>
                allSharesHeld(state, id, (share) => share.owner.kind === 'player'),
            poolDrop: (state, id) =>
                state.certificates.some(
                    (certificate) =>
                        certificate.companyId === id && certificate.poolId === marketPoolId
                )
                    ? 1
                    : 0
        },
        buyers: (_, playerId) => [{ kind: 'player', playerId }],
        sellers: (_, playerId) => [{ kind: 'player', playerId }],
        purchaseTerms(state, certificate, buyer) {
            const company = getCompany(state, certificate.companyId)
            if (
                company.kind !== 'major' ||
                !company.started ||
                company.closed ||
                certificate.president
            )
                return 'Choose an available ordinary share of a launched corporation.'
            if (
                certificate.poolId !== treasuryPoolId(company.id) &&
                certificate.poolId !== marketPoolId
            )
                return 'This share is not in the treasury or market.'
            return {
                price:
                    market.companySpace(state.stockMarket, company.id).price * certificate.shares,
                recipient: certificate.owner,
                payers: [buyer]
            }
        },
        saleTerms(state, companyId, _shares, seller) {
            const company = getCompany(state, companyId)
            if (
                company.kind !== 'major' ||
                !company.started ||
                company.closed ||
                !company.president
            )
                return 'This corporation has no saleable stock.'
            const president = sameOwner(company.president, seller)
            if (!company.operated && !president)
                return 'Only the president may sell before the corporation operates.'
            return marketSaleTerms(market, state, companyId, {
                destinationPoolId: marketPoolId,
                marketLimit: 50,
                maximumShares: 10,
                movement: president ? 1 : 0
            })
        },
        certificateLimit: trading.certificateLimit,
        certificateWeight: () => 1,
        ownershipLimit: trading.ownershipLimit,
        presidencyCandidates: (state, id) =>
            playersAfterPresident(state, id, state.turnManager.turnOrder),
        turnOrder: 'sell-buy',
        // A president's sales move the price once a turn, however many shares they sell.
        repeatSales: 'extend-block'
    }
    return rules
}

/**
 * Launching: a major's price comes from the launch zone and its president pays twice it to
 * the corporation, whose home station is placed at once in its reserved city.
 */
export function treasuryShareCompanyRules(
    trading: Pick<TreasuryShareTrading, 'market' | 'launchColor'>,
    homeLocationId: (companyId: string) => string
): Pick<CompanyRules, 'startMarketSpaces' | 'startTerms' | 'onFloat'> {
    const { market, launchColor } = trading
    return {
        startMarketSpaces: (state, id) =>
            getCompany(state, id).kind === 'major'
                ? market.spaces
                      .filter((space) => space.color === launchColor)
                      .map((space) => space.id)
                : [],
        startTerms: (_state, companyId, buyer, spaceId) => ({
            price: market.space(spaceId).price * 2,
            recipient: { kind: 'company', companyId },
            payers: [buyer]
        }),
        onFloat(state, id) {
            placeReservedHome(state, id, homeLocationId(id))
            getCompany(state, id).funded = true
        }
    }
}

/** Places a company's first available station in the reserved city of its home, next free slot. */
export function placeReservedHome(
    state: FinancialState & StationState,
    companyId: string,
    locationId: string
): void {
    const station = state.stations.find(
        (station) => station.companyId === companyId && station.status === 'available'
    )
    assertExists(station, 'A corporation requires a home station')
    const nodeId =
        state.stationReservations.find(
            (reservation) =>
                reservation.companyId === companyId && reservation.locationId === locationId
        )?.nodeId ?? 'city'
    let slot = 0
    while (
        state.stations.some(
            (other) =>
                other.status === 'placed' &&
                other.position.locationId === locationId &&
                other.position.nodeId === nodeId &&
                other.position.slot === slot
        )
    )
        slot++
    state.stations[state.stations.indexOf(station)] = {
        id: station.id,
        companyId,
        status: 'placed',
        position: { locationId, nodeId, slot }
    }
    state.stationReservations = state.stationReservations.filter(
        (reservation) =>
            reservation.companyId !== companyId || reservation.locationId !== locationId
    )
}
