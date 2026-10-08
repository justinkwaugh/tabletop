import { assertExists } from '@tabletop/common'
import {
    TrackNetwork,
    applyShareSale,
    companyMarketSpace,
    controllingOwner,
    copyStockState,
    evaluateShareDisposal,
    finiteCashOwnedBy,
    getCompany,
    sameOwner,
    sharesOwned,
    stockMarketSpace,
    type CashPayment,
    type PlacedStation,
    type ShareSaleDetails,
    type StockState
} from '@tabletop/18xx'
import { coalFieldsOpen } from './coalAccess.js'
import type { EighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoShareTrading, EighteenThirtyTwoStockRules } from './stockRules.js'
import { isClosingSpace } from './stockMarket.js'
import { isSystem, nextSystemId, shellsOf, systemMarketSpace, systemPresident } from './systems.js'
import { eighteenThirtyTwoMapState } from './tileState.js'
import type { MergerKind, MergerProposal, TakeoverFunding } from './titleState.js'
import { EighteenThirtyTwoPhases } from './trains.js'

/** Mergers begin with the first 4-train and end after the phase following the first 6-train. */
export function mergersAllowed(state: EighteenThirtyTwoState): boolean {
    return EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '4') && !state.mergersEnded
}

export function presidentId(state: EighteenThirtyTwoState, companyId: string) {
    return controllingOwner(state, companyId)?.playerId
}

// A System begins with its components' takeover (§11.5).
function involvedIn(state: EighteenThirtyTwoState, companyId: string, kind: MergerKind) {
    const ids = [companyId, ...shellsOf(state, companyId)]
    return state.mergers.some(
        (merger) => merger.kind === kind && merger.companyIds.some((id) => ids.includes(id))
    )
}

function placedStations(state: EighteenThirtyTwoState, companyId: string): PlacedStation[] {
    return state.stations.flatMap((station) =>
        station.status === 'placed' && station.companyId === companyId ? [station] : []
    )
}

/**
 * Whether two companies can reach each other: a legal run of unlimited length from one to the
 * other's station, or stations sharing a city (§11.5). A run ends at an off-board area (§8.1b).
 */
export function companiesConnect(state: EighteenThirtyTwoState, first: string, second: string) {
    const firstStations = placedStations(state, first)
    const secondStations = placedStations(state, second)
    const sameCity = (a: PlacedStation, b: PlacedStation) =>
        a.position.locationId === b.position.locationId && a.position.nodeId === b.position.nodeId
    if (firstStations.some((a) => secondStations.some((b) => sameCity(a, b)))) return true
    const mapState = eighteenThirtyTwoMapState(state)
    const offBoard = (locationId: string, nodeId: string) =>
        mapState
            .tile(locationId)
            .face.nodes.some((node) => node.id === nodeId && node.kind === 'offboard')
    const reaches = (from: string, targets: readonly PlacedStation[]) => {
        const network = new TrackNetwork(
            mapState,
            state,
            from,
            undefined,
            undefined,
            (locationId, nodeId) =>
                !coalFieldsOpen(state, from, { locationId, nodeId }) || offBoard(locationId, nodeId)
        )
        return targets.some((target) =>
            network.reaches(target.position.locationId, {
                kind: 'node',
                nodeId: target.position.nodeId
            })
        )
    }
    return reaches(first, secondStations) || reaches(second, firstStations)
}

export type MergerOption = Omit<MergerProposal, 'proposerPlayerId'>

export function takeoverSides(option: MergerOption) {
    return option.yielded
        ? { buyerId: option.partnerId, targetId: option.companyId }
        : { buyerId: option.companyId, targetId: option.partnerId }
}

/**
 * What the buyer pays for the other company's shares: players' and open-market shares at the
 * market price, unsold shares at par to the bank; its own redeemed shares are its assets
 * (§11.7).
 */
export function takeoverPayments(
    state: StockState,
    buyerId: string,
    targetId: string
): CashPayment[] {
    const target = getCompany(state, targetId)
    assertExists(target.parPrice, 'A started company has a par price')
    const price = companyMarketSpace(state.stockMarket, targetId).price
    const payments: CashPayment[] = []
    for (const certificate of state.certificates) {
        if (
            certificate.retired ||
            certificate.kind !== 'share' ||
            certificate.companyId !== targetId ||
            certificate.owner.kind === 'company'
        )
            continue
        const unsold = certificate.poolId === 'initial-offering'
        const amount = (unsold ? target.parPrice : price) * certificate.shares
        const to =
            certificate.owner.kind === 'player' ? certificate.owner : { kind: 'bank' as const }
        const previous = payments.find((payment) => sameOwner(payment.to, to))
        if (previous) previous.amount += amount
        else payments.push({ from: { kind: 'company', companyId: buyerId }, to, amount })
    }
    return payments
}

const total = (payments: readonly CashPayment[]) =>
    payments.reduce((sum, payment) => sum + payment.amount, 0)

function paidTo(payments: readonly CashPayment[], playerId: string) {
    return total(payments.filter((payment) => sameOwner(payment.to, { kind: 'player', playerId })))
}

/**
 * What the buyer's treasury, its president's cash and their own shares' price leave to raise
 * by selling shares. **Ruling:** the president is paid for their own shares as they contribute.
 */
export function takeoverShortfall(
    state: StockState,
    buyerId: string,
    targetId: string,
    playerId: string
): number {
    const payments = takeoverPayments(state, buyerId, targetId)
    return Math.max(
        0,
        total(payments) -
            finiteCashOwnedBy(state, { kind: 'company', companyId: buyerId }) -
            finiteCashOwnedBy(state, { kind: 'player', playerId }) -
            paidTo(payments, playerId)
    )
}

// Sales a president might make for a takeover: any company's shares but the one bought, within
// the open market's limit, never changing the buyer's presidency nor closing it (§11.7).
function candidateSales(state: StockState, funding: TakeoverFunding) {
    const seller = { kind: 'player' as const, playerId: funding.playerId }
    return state.companies.flatMap((company) => {
        if (company.id === funding.targetId || company.kind === 'private') return []
        const results: ShareSaleDetails[] = []
        for (let shares = 1; shares <= sharesOwned(state, company.id, seller); shares++) {
            const { details } = evaluateShareDisposal(
                state,
                seller,
                [{ companyId: company.id, shares }],
                {
                    ...EighteenThirtyTwoStockRules,
                    saleTerms: EighteenThirtyTwoShareTrading.emergencySaleTerms
                }
            )
            const [sale] = details?.sales ?? []
            if (
                details &&
                !(
                    company.id === funding.buyerId &&
                    (sale.presidency ||
                        isClosingSpace(stockMarketSpace(state.stockMarket, sale.toMarketSpaceId)))
                )
            )
                results.push(details)
        }
        return results
    })
}

function raisable(state: StockState, funding: TakeoverFunding) {
    const best = new Map<string, number>()
    for (const sale of candidateSales(state, funding)) {
        const companyId = sale.sales[0].companyId
        best.set(companyId, Math.max(best.get(companyId) ?? 0, sale.proceeds))
    }
    return [...best.values()].reduce((sum, proceeds) => sum + proceeds, 0)
}

function fundable(state: StockState, funding: TakeoverFunding) {
    const shortfall = takeoverShortfall(state, funding.buyerId, funding.targetId, funding.playerId)
    return !shortfall || raisable(state, funding) >= shortfall
}

/**
 * The sales the president may make toward the takeover: no more shares of a company than the
 * shortfall needs, and none leaving it beyond raising (§10.6.2, §11.7).
 */
export function takeoverSales(
    state: EighteenThirtyTwoState,
    funding: TakeoverFunding
): ShareSaleDetails[] {
    const shortfall = takeoverShortfall(state, funding.buyerId, funding.targetId, funding.playerId)
    if (!shortfall) return []
    const candidates = candidateSales(state, funding)
    return candidates.filter((sale) => {
        const [{ companyId, shares }] = sale.sales
        const smaller = candidates.find(
            (other) =>
                other.sales[0].companyId === companyId && other.sales[0].shares === shares - 1
        )
        if (smaller && smaller.proceeds >= shortfall) return false
        const projected = { ...state, ...copyStockState(state) }
        applyShareSale(projected, sale)
        return fundable(projected, funding)
    })
}

function mergeable(state: EighteenThirtyTwoState, companyId: string) {
    const company = getCompany(state, companyId)
    return company.kind === 'major' && !company.closed && !!company.operated
}

function refused(state: EighteenThirtyTwoState, option: MergerOption) {
    return !!state.mergerPhase?.refused.some(
        (entry) =>
            entry.companyId === option.companyId &&
            entry.partnerId === option.partnerId &&
            entry.kind === option.kind &&
            entry.yielded === option.yielded
    )
}

/**
 * The mergers a player may propose between a company they preside and a partner that has
 * operated and that one of them can reach; in the last phase both must be theirs (§11.1,
 * §11.5). Cheap conditions come before tracing track.
 */
function* optionsOf(state: EighteenThirtyTwoState, playerId: string): Generator<MergerOption> {
    const phase = state.mergerPhase
    if (!phase || !mergersAllowed(state)) return
    const connected = new Map<string, boolean>()
    const connects = (first: string, second: string) => {
        const key = [first, second].sort().join('|')
        const known = connected.get(key)
        if (known !== undefined) return known
        const result = companiesConnect(state, first, second)
        connected.set(key, result)
        return result
    }
    for (const company of state.companies) {
        if (!mergeable(state, company.id) || presidentId(state, company.id) !== playerId) continue
        for (const partner of state.companies) {
            if (partner.id === company.id || !mergeable(state, partner.id)) continue
            const partnerPresident = presidentId(state, partner.id)
            if (!partnerPresident || (phase.final && partnerPresident !== playerId)) continue
            for (const yielded of partnerPresident === playerId ? [false] : [false, true]) {
                const initiator = yielded ? partnerPresident : playerId
                const system: MergerOption = {
                    companyId: company.id,
                    partnerId: partner.id,
                    kind: 'system',
                    yielded
                }
                if (
                    !isSystem(state, company.id) &&
                    !isSystem(state, partner.id) &&
                    nextSystemId(state) &&
                    !refused(state, system) &&
                    systemPresident(state, [company.id, partner.id], initiator) &&
                    connects(company.id, partner.id)
                )
                    yield system
                const takeover: MergerOption = { ...system, kind: 'takeover' }
                const { buyerId, targetId } = takeoverSides(takeover)
                const buyerPresident = presidentId(state, buyerId)
                if (
                    buyerPresident &&
                    !refused(state, takeover) &&
                    !involvedIn(state, buyerId, 'takeover') &&
                    !involvedIn(state, targetId, 'takeover') &&
                    fundable(state, { buyerId, targetId, playerId: buyerPresident }) &&
                    connects(company.id, partner.id)
                )
                    yield takeover
            }
        }
    }
}

export function mergerOptions(state: EighteenThirtyTwoState, playerId: string): MergerOption[] {
    return [...optionsOf(state, playerId)]
}

export function hasMergerOptions(state: EighteenThirtyTwoState, playerId: string): boolean {
    return !optionsOf(state, playerId).next().done
}

export type MergerTerms =
    | { kind: 'system'; initiator: string; president: string; price: number }
    | {
          kind: 'takeover'
          initiator: string
          buyerId: string
          targetId: string
          payments: CashPayment[]
          price: number
      }

/** What a proposed merger would make: a System's president and price, or a takeover's cost. */
export function mergerTerms(
    state: EighteenThirtyTwoState,
    option: MergerOption,
    proposerPlayerId: string
): MergerTerms {
    const partnerPresident = presidentId(state, option.partnerId)
    assertExists(partnerPresident, 'A merger partner has a president')
    const initiator = option.yielded ? partnerPresident : proposerPlayerId
    if (option.kind === 'system') {
        const companyIds = [option.companyId, option.partnerId]
        const president = systemPresident(state, companyIds, initiator)
        assertExists(president, 'A System has a president')
        return {
            kind: 'system',
            initiator,
            president,
            price: systemMarketSpace(state.stockMarket, companyIds).price
        }
    }
    const { buyerId, targetId } = takeoverSides(option)
    const payments = takeoverPayments(state, buyerId, targetId)
    return { kind: 'takeover', initiator, buyerId, targetId, payments, price: total(payments) }
}
