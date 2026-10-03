import type { EighteenSeventeenState } from './state.js'
import { assert, assertExists } from '@tabletop/common'
import {
    addShort,
    applyPresidencyChange,
    cancelShorts,
    companyMarketSpace,
    controllingOwner,
    evaluatePresidency,
    finiteCashOwnedBy,
    getCompany,
    issueShareCertificates,
    moveCompanyStations,
    openShorts,
    ordinaryShares,
    placeStockMarker,
    resetCompany,
    playersAfterPresident,
    sameOwner,
    settleCashPayments,
    sharesOwned,
    stockMarketOrder,
    transferCompanyAssets,
    trainsOwnedBy,
    type AssetTransfer,
    type CashPayment,
    type Owner,
    type PlacedStation,
    type Station,
    type StationTransfer,
    type StockMarketSpace,
    type Train
} from '@tabletop/18xx'
import { corporationShareCount } from './corporations.js'
import { closingZone, inClosingZone } from './marketZones.js'
import type { ClosingZone } from './state.js'
import { isLiquidated } from './liquidation.js'
import { MarketPoolId, treasuryPoolId } from './roundRules.js'
import { StationPrice } from './stockRules.js'
import { EighteenSeventeenTrainRules } from './trains.js'
import { StationSubsidyId, companyHolding } from './privateHolders.js'

export const StationLimit = 8
export const CharterShareCount = 2
const SizeAfter: Readonly<Record<number, number>> = { 2: 5, 5: 10 }

/** The companies that take part in a merger round, in operating order. */
export function mergerRoundCompanyIds(state: EighteenSeventeenState): string[] {
    return stockMarketOrder(state.stockMarket).filter((companyId) => {
        const company = getCompany(state, companyId)
        return company.floated && !inClosingZone(state.stockMarket, companyId)
    })
}

export function presidentOf(state: EighteenSeventeenState, companyId: string): string {
    const president = controllingOwner(state, companyId)
    assertExists(president, 'The company has a president')
    return president.playerId
}

export function closingZones(
    state: EighteenSeventeenState
): { companyId: string; zone: ClosingZone }[] {
    return state.companies.flatMap((company) => {
        const zone = company.floated ? closingZone(state.stockMarket, company.id) : undefined
        return zone ? [{ companyId: company.id, zone }] : []
    })
}

export function canConvert(state: EighteenSeventeenState, companyId: string): boolean {
    return SizeAfter[corporationShareCount(state, companyId)] !== undefined
}

export function sizeAfterConversion(state: EighteenSeventeenState, companyId: string): number {
    const size = SizeAfter[corporationShareCount(state, companyId)]
    assertExists(size, 'Only a 2- or 5-share company converts')
    return size
}

/** The stations a company holds, placed or not. */
export function heldStations(state: EighteenSeventeenState, companyId: string): number {
    return state.stations.filter(
        (station) => station.companyId === companyId && station.status !== 'removed'
    ).length
}

/** Stations a company converted to this size must buy: one more at 5 shares, up to two at 10. */
function stationsForSize(state: EighteenSeventeenState, companyId: string, size: number): number {
    const held = heldStations(state, companyId)
    return size === 5
        ? held < StationLimit
            ? 1
            : 0
        : Math.min(Math.max(StationLimit - held, 0), 2)
}

/** Stations a converted company must buy. */
export function stationsForConversion(state: EighteenSeventeenState, companyId: string): number {
    return stationsForSize(state, companyId, corporationShareCount(state, companyId))
}

export type ConversionPreview = {
    shareCount: number
    /** Shares the conversion adds to the treasury. */
    newShares: number
    stations: StationPurchase
}

/** What converting would make of the company, for its president to weigh. */
export function conversionPreview(
    state: EighteenSeventeenState,
    companyId: string
): ConversionPreview {
    const shareCount = sizeAfterConversion(state, companyId)
    return {
        shareCount,
        newShares: shareCount - corporationShareCount(state, companyId),
        stations: stationPurchase(state, companyId, stationsForSize(state, companyId, shareCount))
    }
}

/** Grows the company to its next size, adding the new shares to its treasury. */
export function convertCompany(state: EighteenSeventeenState, companyId: string): string[] {
    const before = corporationShareCount(state, companyId)
    const after = sizeAfterConversion(state, companyId)
    getCompany(state, companyId).shareCount = after
    return issueShareCertificates(state, companyId, after - before, {
        owner: { kind: 'company', companyId },
        poolId: treasuryPoolId(companyId)
    })
}

function largestCombinedPercent(
    state: EighteenSeventeenState,
    companyId: string,
    targetId: string
): number {
    const percentPerShare = 100 / corporationShareCount(state, companyId)
    return Math.max(
        0,
        ...state.players.map(({ playerId }) => {
            const player = { kind: 'player' as const, playerId }
            return (
                (sharesOwned(state, companyId, player) + sharesOwned(state, targetId, player)) *
                percentPerShare
            )
        })
    )
}

/** The merged company's price: the sum of two 2-share prices or the average of two 5-share. */
export function mergerPrice(
    state: EighteenSeventeenState,
    companyId: string,
    targetId: string
): number {
    const a = companyMarketSpace(state.stockMarket, companyId).price
    const b = companyMarketSpace(state.stockMarket, targetId).price
    const value = getCompany(state, companyId).shareCount === 2 ? a + b : Math.floor((a + b) / 2)
    return mergerSpace(state, value).price
}

export type MergerPreview = {
    price: number
    shareCount: number
    /** Shares the merged company holds in its treasury. */
    treasuryShares: number
    /** Stations the merged company holds, before any over the limit are removed. */
    stations: number
}

/**
 * What merging the target in would make of the company, for its president to weigh. Two
 * 2-share companies' new shares stay in the treasury but for one the president sells to the
 * target's president; two 5-share companies' holders swap share for share, so the treasury
 * gains only the target's treasury shares.
 */
export function mergerPreview(
    state: EighteenSeventeenState,
    companyId: string,
    targetId: string
): MergerPreview {
    const shareCount = sizeAfterConversion(state, companyId)
    const president = controllingOwner(state, companyId)
    const targetPresident = controllingOwner(state, targetId)
    assertExists(president, 'A merging company has a president')
    assertExists(targetPresident, 'A merged company has a president')
    const size = corporationShareCount(state, companyId)
    const added =
        size === CharterShareCount
            ? shareCount - size - (sameOwner(president, targetPresident) ? 0 : 1)
            : treasuryShareIds(state, targetId).length
    return {
        price: mergerPrice(state, companyId, targetId),
        shareCount,
        treasuryShares: treasuryShareIds(state, companyId).length + added,
        stations: heldStations(state, companyId) + heldStations(state, targetId)
    }
}

function mergerSpace(state: EighteenSeventeenState, value: number): StockMarketSpace {
    const space = state.stockMarket.spaces
        .filter((space) => space.price > 0 && space.price <= value)
        .reduce<StockMarketSpace | undefined>(
            (best, space) => (!best || space.price > best.price ? space : best),
            undefined
        )
    assertExists(space, 'A merged company has a market space')
    return space
}

export function mergeReason(
    state: EighteenSeventeenState,
    companyId: string,
    targetId: string,
    convertedIds: readonly string[]
): string | undefined {
    const company = getCompany(state, companyId)
    const target = getCompany(state, targetId)
    if (targetId === companyId || !target.floated || target.kind === 'private')
        return 'Choose another floated company.'
    if (convertedIds.includes(targetId)) return 'This company has already converted this round.'
    if (inClosingZone(state.stockMarket, targetId) || isLiquidated(state.stockMarket, targetId))
        return 'Companies in the acquisition or liquidation zone cannot merge.'
    if (target.shareCount !== company.shareCount || !canConvert(state, companyId))
        return 'Only two 2-share or two 5-share companies can merge.'
    // Enough for the merged company's president's certificate.
    if (company.shareCount === 5 && largestCombinedPercent(state, companyId, targetId) < 40)
        return 'Some player must hold 40% of the two companies together.'
    const president = controllingOwner(state, companyId)
    const targetPresident = controllingOwner(state, targetId)
    assertExists(president, 'A merging company has a president')
    if (
        company.shareCount === 2 &&
        !sameOwner(president, targetPresident ?? president) &&
        finiteCashOwnedBy(state, president) < mergerPrice(state, companyId, targetId)
    )
        return 'The president cannot pay for the merged company’s new share.'
    return undefined
}

export function mergeTargetIds(
    state: EighteenSeventeenState,
    companyId: string,
    convertedIds: readonly string[]
): string[] {
    return state.companies
        .filter((company) => !mergeReason(state, companyId, company.id, convertedIds))
        .map((company) => company.id)
}

export type MergerRecord = {
    price: number
    assets: AssetTransfer
    stations: StationTransfer
    payments: CashPayment[]
}

/**
 * Merges the target into the company: its assets and stations move over, the company grows
 * to its next size, the target's holders receive its shares, and the target's charter resets.
 */
export function mergeCompanies(
    state: EighteenSeventeenState,
    companyId: string,
    targetId: string
): MergerRecord {
    const price = mergerPrice(state, companyId, targetId)
    const size = getCompany(state, companyId).shareCount
    const president = controllingOwner(state, companyId)
    const targetPresident = controllingOwner(state, targetId)
    assertExists(president, 'A merging company has a president')
    assertExists(targetPresident, 'A merged company has a president')
    const assets = transferCompanyAssets(state, targetId, companyId, { loans: true })
    const stations = moveCompanyStations(state, targetId, companyId)
    placeStockMarker(state.stockMarket, companyId, mergerSpace(state, price).id)
    const newShareIds = convertCompany(state, companyId)
    const payments: CashPayment[] = []
    if (size === 2) {
        if (!sameOwner(president, targetPresident)) {
            const payment = {
                from: { ...president },
                to: { kind: 'company' as const, companyId },
                amount: price
            }
            settleCashPayments(state, [payment])
            payments.push(payment)
            giveShare(state, newShareIds[0], targetPresident)
        }
    } else migrateHoldings(state, companyId, targetId, newShareIds)
    resetCompany(state, targetId, CharterShareCount)
    return { price, assets, stations, payments }
}

function giveShare(
    state: EighteenSeventeenState,
    certificateId: string | undefined,
    owner: Owner
): void {
    const certificate = state.certificates.find((certificate) => certificate.id === certificateId)
    assert(certificate && !certificate.retired, 'A merger gives an issued share')
    certificate.owner = { ...owner }
    delete certificate.poolId
}

// Each share and short of the target becomes one of the company's for the same holder: the
// target's treasury shares stay in the company's treasury, the market's go to the market.
function migrateHoldings(
    state: EighteenSeventeenState,
    companyId: string,
    targetId: string,
    newShareIds: string[]
): void {
    const unused = [...newShareIds]
    for (const certificate of state.certificates) {
        if (certificate.retired || certificate.companyId !== targetId) continue
        if (certificate.kind === 'short') {
            addShort(state, companyId, certificate.owner, certificate.poolId)
            continue
        }
        if (certificate.kind !== 'share') continue
        for (let share = 0; share < certificate.shares; share++) {
            const id =
                unused.shift() ??
                issueShareCertificates(state, companyId, 1, {
                    owner: { kind: 'company', companyId },
                    poolId: treasuryPoolId(companyId)
                })[0]
            if (certificate.poolId === treasuryPoolId(targetId)) continue
            const share = state.certificates.find((item) => item.id === id)
            assert(share && !share.retired, 'A migrated share is issued')
            share.owner = { ...certificate.owner }
            if (certificate.poolId === MarketPoolId) share.poolId = MarketPoolId
            else delete share.poolId
        }
    }
    const presidency = evaluatePresidency(
        state,
        companyId,
        playersAfterPresident(state, companyId, state.turnManager.turnOrder)
    )
    assert(!presidency.reason, presidency.reason ?? 'The merged company has a president')
    if (presidency.change) applyPresidencyChange(state, presidency.change)
    const holders = openShorts(state, companyId).map((short) => short.owner)
    for (const owner of holders) cancelShorts(state, companyId, owner)
}

export function trainsOverLimit(state: EighteenSeventeenState, companyId: string): number {
    return Math.max(
        0,
        trainsOwnedBy(state, { kind: 'company', companyId }).length -
            EighteenSeventeenTrainRules.trainLimit(state, companyId)
    )
}

/** Unplaced stations past the limit leave first; placed ones past it await the president. */
export function trimStations(state: EighteenSeventeenState, companyId: string): void {
    let excess = heldStations(state, companyId) - StationLimit
    state.stations = state.stations.map((station): Station => {
        if (excess <= 0 || station.companyId !== companyId || station.status !== 'available')
            return station
        excess--
        return { id: station.id, companyId, status: 'removed' }
    })
}

export function stationsOverLimit(state: EighteenSeventeenState, companyId: string): number {
    return Math.max(0, heldStations(state, companyId) - StationLimit)
}

export type StationPurchase = { stations: number; cost: number; affordable: boolean }

// The Station Subsidy's company pays $50 less for the stations it buys when it converts.
const StationSubsidy = 50

export function stationPurchase(
    state: EighteenSeventeenState,
    companyId: string,
    stations: number
): StationPurchase {
    const subsidy =
        stations && companyHolding(state, StationSubsidyId) === companyId ? StationSubsidy : 0
    const cost = stations * StationPrice - subsidy
    return {
        stations,
        cost,
        affordable: finiteCashOwnedBy(state, { kind: 'company', companyId }) >= cost
    }
}

export function removableStations(
    state: EighteenSeventeenState,
    companyId: string
): PlacedStation[] {
    if (!stationsOverLimit(state, companyId)) return []
    return state.stations.filter(
        (station): station is PlacedStation =>
            station.companyId === companyId && station.status === 'placed'
    )
}

export function discardableTrains(state: EighteenSeventeenState, companyId: string): Train[] {
    return trainsOverLimit(state, companyId)
        ? trainsOwnedBy(state, { kind: 'company', companyId })
        : []
}

export function treasuryShareIds(state: EighteenSeventeenState, companyId: string): string[] {
    return ordinaryShares(state, companyId)
        .filter((share) => share.poolId === treasuryPoolId(companyId))
        .map((share) => share.id)
}
