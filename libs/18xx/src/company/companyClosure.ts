import * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    President,
    finiteCashOwnedBy,
    getCompany,
    type FinancialState
} from '../finance/finance.js'
import { StationReservation, type StationState } from '../map/station.js'
import { closePrivate, privateOwningCompany } from '../privates/privateCompany.js'
import { companyMarketSpaceId, removeStockMarker, type StockMarket } from '../stock/stockMarket.js'
import { trainsOwnedBy, unownedTrain, type TrainState } from '../trains/train.js'

export const CompanyClosure = Type.Object(
    {
        companyId: Type.String(),
        president: Type.Optional(President),
        payments: Type.Array(CashPayment),
        retiredCertificateIds: Type.Array(Type.String()),
        closedPrivateIds: Type.Array(Type.String()),
        removedReservations: Type.Array(StationReservation),
        removedStationIds: Type.Array(Type.String()),
        removedTrainIds: Type.Array(Type.String()),
        removedMarketSpaceId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type CompanyClosure = Type.Static<typeof CompanyClosure>

type ClosureState = FinancialState & StationState & TrainState & { stockMarket: StockMarket }

/**
 * Removes a company from play: its cash goes to the bank, its certificates and the privates it
 * owns are retired, its stations and reservations leave the map, its trains go to the market
 * or out of the game, and its market marker is removed.
 */
export function closeShareCompany(
    state: ClosureState,
    companyId: string,
    trainDestination: 'market' | 'removed'
): CompanyClosure {
    const company = getCompany(state, companyId)
    const owner = { kind: 'company' as const, companyId }
    const amount = finiteCashOwnedBy(state, owner)
    const closedPrivateIds = state.companies
        .filter(
            (other) =>
                other.kind === 'private' && privateOwningCompany(state, other.id) === companyId
        )
        .map((other) => other.id)
    const payments: CashPayment[] = amount ? [{ from: owner, to: { kind: 'bank' }, amount }] : []
    const retiredCertificateIds = state.certificates
        .filter(
            (certificate) =>
                !certificate.retired &&
                (certificate.companyId === companyId ||
                    closedPrivateIds.includes(certificate.companyId))
        )
        .map((certificate) => certificate.id)
    const removedStationIds = state.stations
        .filter((station) => station.companyId === companyId && station.status !== 'removed')
        .map((station) => station.id)
    const removedTrainIds = trainsOwnedBy(state, owner).map((train) => train.id)
    const details: CompanyClosure = {
        companyId,
        ...(company.president ? { president: structuredClone(company.president) } : {}),
        payments,
        closedPrivateIds,
        retiredCertificateIds,
        removedStationIds,
        removedTrainIds,
        removedReservations: structuredClone(
            state.stationReservations.filter((reservation) => reservation.companyId === companyId)
        ),
        ...(company.kind === 'major'
            ? { removedMarketSpaceId: companyMarketSpaceId(state.stockMarket, companyId) }
            : {})
    }
    settleCashPayments(state, payments)
    for (const id of closedPrivateIds) closePrivate(state, id)
    company.closed = true
    delete company.president
    state.certificates = state.certificates.map((certificate) => {
        if (certificate.retired || certificate.companyId !== companyId) return certificate
        const { owner: _owner, poolId: _poolId, ...retired } = certificate
        return { ...retired, retired: true }
    })
    state.stations = state.stations.map((station) =>
        station.companyId === companyId ? { id: station.id, companyId, status: 'removed' } : station
    )
    state.stationReservations = state.stationReservations.filter(
        (reservation) => reservation.companyId !== companyId
    )
    state.trainInventory.trains = state.trainInventory.trains.map((train) =>
        removedTrainIds.includes(train.id) ? unownedTrain(train, trainDestination) : train
    )
    if (company.kind === 'major') removeStockMarker(state.stockMarket, companyId)
    return details
}
