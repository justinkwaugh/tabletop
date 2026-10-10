import * as Type from 'typebox'
import {
    AssetTransfer,
    StationTransfer,
    closeShareCompany,
    homeStationId,
    moveCompanyStations,
    reorderPendingOperatingCompanies,
    transferCompanyAssets
} from '@tabletop/18xx'
import type { EighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoOperatingRules } from './roundRules.js'

export const Absorption = Type.Object(
    {
        assets: AssetTransfer,
        stations: StationTransfer,
        returnedCoalRight: Type.Boolean()
    },
    { additionalProperties: false }
)
export type Absorption = Type.Static<typeof Absorption>

/** Whether a station is a home: the company's own, or one it holds for a merged company's. */
export function isHomeStation(state: EighteenThirtyTwoState, stationId: string, companyId: string) {
    return (
        stationId === homeStationId(companyId) ||
        !!state.inheritedHomeStationIds?.includes(stationId)
    )
}

function placedHomes(state: EighteenThirtyTwoState, companyId: string) {
    return state.stations.flatMap((station) =>
        station.status === 'placed' &&
        station.companyId === companyId &&
        isHomeStation(state, station.id, companyId)
            ? [station]
            : []
    )
}

/**
 * Where two home stations come to share one city, as A&WP's and GRR's can in Atlanta, one is
 * discarded rather than returned to the charter (§7.3.3).
 */
export function discardSharedHome(
    state: EighteenThirtyTwoState,
    keptHomeOf: string,
    discardedHomeOf: string
): string | undefined {
    const kept = placedHomes(state, keptHomeOf)
    const discarded = placedHomes(state, discardedHomeOf).find((station) =>
        kept.some(
            (home) =>
                home.position.locationId === station.position.locationId &&
                home.position.nodeId === station.position.nodeId
        )
    )
    if (!discarded) return undefined
    state.stations = state.stations.map((station) =>
        station.id === discarded.id
            ? { id: station.id, companyId: station.companyId, status: 'removed' }
            : station
    )
    return discarded.id
}

/**
 * A company merging into its survivor, a System or a takeover's buyer: the survivor takes its
 * money, trains, privates, stations, WVCF right and revenue tokens, and it closes. A bought
 * company's unplaced stations are discarded (§11.6.5–11.6.6, §11.7.1).
 */
export function absorbCompany(
    state: EighteenThirtyTwoState,
    fromId: string,
    survivorId: string,
    kind: 'system' | 'takeover'
): Absorption {
    if (kind === 'takeover')
        state.stations = state.stations.map((station) =>
            station.companyId === fromId && station.status === 'available'
                ? { id: station.id, companyId: fromId, status: 'removed' }
                : station
        )
    const homes = placedHomes(state, fromId).map((station) => station.position)
    const assets = transferCompanyAssets(state, fromId, survivorId, { loans: false })
    const stations = moveCompanyStations(state, fromId, survivorId)
    const inherited = state.stations.flatMap((station) =>
        station.status === 'placed' &&
        stations.placedIds.includes(station.id) &&
        homes.some(
            (home) =>
                home.locationId === station.position.locationId &&
                home.nodeId === station.position.nodeId
        )
            ? [station.id]
            : []
    )
    if (inherited.length)
        state.inheritedHomeStationIds = [...(state.inheritedHomeStationIds ?? []), ...inherited]
    closeShareCompany(state, fromId, 'removed')
    // A survivor with two WVCF tokens returns one to the bank (§7.6, §16.2 P5).
    const returnedCoalRight =
        state.coalRights.includes(fromId) && state.coalRights.includes(survivorId)
    state.coalRights = [
        ...new Set(
            state.coalRights.map((companyId) => (companyId === fromId ? survivorId : companyId))
        )
    ]
    state.revenueTokens = state.revenueTokens.map((token) =>
        token.companyId === fromId ? { ...token, companyId: survivorId } : token
    )
    if (state.londonCompanyId === fromId) state.londonCompanyId = survivorId
    state.ownershipLimitExemptions = state.ownershipLimitExemptions.filter(
        (exemption) => exemption.companyId !== fromId
    )
    const set = state.operatingSet
    if (set && !set.completed) {
        if (!set.companyOrder.includes(survivorId))
            set.companyOrder = [...set.companyOrder, survivorId]
        // A merged company that had already operated this round does not operate again (§11.8).
        if (
            set.completedCompanyIds.includes(fromId) &&
            !set.completedCompanyIds.includes(survivorId)
        )
            set.completedCompanyIds = [...set.completedCompanyIds, survivorId]
        reorderPendingOperatingCompanies(
            state,
            EighteenThirtyTwoOperatingRules.companyOrder(state),
            {
                betweenCompanies: true
            }
        )
    }
    return { assets, stations, returnedCoalRight }
}
