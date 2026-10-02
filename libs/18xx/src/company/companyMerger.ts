import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    finiteCashOwnedBy,
    getCompany,
    sameOwner,
    type FinancialState
} from '../finance/finance.js'
import {
    addCompanyStations,
    replaceStation,
    type PlacedStation,
    type Station,
    type StationState
} from '../map/station.js'
import type { TrainState } from '../trains/train.js'

export const AssetTransfer = Type.Object(
    {
        payment: Type.Optional(CashPayment),
        trainIds: Type.Array(Type.String()),
        privateIds: Type.Array(Type.String()),
        loans: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type AssetTransfer = Type.Static<typeof AssetTransfer>

/** Moves one company's cash, trains, privates and loans to another. */
export function transferCompanyAssets(
    state: FinancialState & TrainState,
    fromId: string,
    toId: string
): AssetTransfer {
    const from = { kind: 'company' as const, companyId: fromId }
    const to = { kind: 'company' as const, companyId: toId }
    const cash = finiteCashOwnedBy(state, from)
    const payment = cash ? { from, to, amount: cash } : undefined
    if (payment) settleCashPayments(state, [payment])
    const trainIds: string[] = []
    for (const train of state.trainInventory.trains)
        if (train.status === 'owned' && sameOwner(train.owner, from)) {
            train.owner = { ...to }
            trainIds.push(train.id)
        }
    const privateIds: string[] = []
    for (const certificate of state.certificates)
        if (
            !certificate.retired &&
            certificate.kind === 'private' &&
            sameOwner(certificate.owner, from)
        ) {
            certificate.owner = { ...to }
            privateIds.push(certificate.companyId)
        }
    const source = getCompany(state, fromId)
    const loans = source.loans ?? 0
    if (loans) {
        const target = getCompany(state, toId)
        target.loans = (target.loans ?? 0) + loans
        delete source.loans
    }
    return { ...(payment ? { payment } : {}), trainIds, privateIds, loans }
}

export const StationTransfer = Type.Object(
    { placedIds: Type.Array(Type.String()), unplacedIds: Type.Array(Type.String()) },
    { additionalProperties: false }
)
export type StationTransfer = Type.Static<typeof StationTransfer>

/**
 * Gives the survivor a station piece for each of the absorbed company's. Placed stations keep
 * their places, except that where both have a station in the same city, the second piece
 * returns to the survivor's charter unplaced.
 */
export function moveCompanyStations(
    state: StationState,
    fromId: string,
    toId: string
): StationTransfer {
    const placedIds: string[] = []
    const unplacedIds: string[] = []
    const absorbed = state.stations.filter(
        (station) => station.companyId === fromId && station.status !== 'removed'
    )
    for (const station of absorbed) {
        addCompanyStations(state, toId, 1)
        const added = state.stations.at(-1)
        assertExists(added, 'The survivor gains a station for each one absorbed')
        if (station.status === 'placed' && !sharesCity(state, toId, station)) {
            replaceStation(state, station.id, added.id)
            placedIds.push(added.id)
        } else unplacedIds.push(added.id)
    }
    state.stations = state.stations.map(
        (station): Station =>
            station.companyId === fromId && station.status !== 'removed'
                ? { id: station.id, companyId: fromId, status: 'removed' }
                : station
    )
    return { placedIds, unplacedIds }
}

function sharesCity(state: StationState, companyId: string, station: PlacedStation): boolean {
    return state.stations.some(
        (own) =>
            own.companyId === companyId &&
            own.status === 'placed' &&
            own.position.locationId === station.position.locationId &&
            own.position.nodeId === station.position.nodeId
    )
}
