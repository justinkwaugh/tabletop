import { releasePrivateReservations } from './stations.js'
import { inReceivership } from './receivership.js'
import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    addCompanyStations,
    replaceStation,
    transferCompanyAssets,
    getCompany,
    nextOperatingCompany,
    privateOwner,
    trainsCountingForLimit,
    trainsOwnedBy,
    type CompanyDecisionState,
    type TransferRules,
    type StationTransfer,
    type TrainRunningState,
    type Train
} from '@tabletop/18xx'
import { draftCompany } from './catalog.js'
import { TrainRules1846, finalDepotEmpty } from './trains.js'
import type { SteamboatState } from './steamboat.js'
import { isRevenuePrivate, type RevenueMarkerState } from './revenueMarkers.js'

export const AcquisitionFields = {
    independentAcquisitions: Type.Array(
        Type.Object(
            {
                companyId: Type.String(),
                trainId: Type.String(),
                setNumber: Type.Integer({ minimum: 1 }),
                roundNumber: Type.Integer({ minimum: 1 })
            },
            { additionalProperties: false }
        )
    )
}
export type AcquisitionState = Type.Static<Type.TObject<typeof AcquisitionFields>>
export const AcquisitionSteps = [
    'CorporateFinance',
    'LayingTrack',
    'RunningTrains',
    'DistributingEarnings',
    'BuyingTrains'
] as const

export const TransferRules1846: TransferRules = {
    operatingCompany(state) {
        return AcquisitionSteps.some((step) => step === state.machineState)
            ? nextOperatingCompany(state)
            : undefined
    },
    canPurchase(state: CompanyDecisionState & RevenueMarkerState, companyId, asset) {
        if (state.pendingRevenueMarker) return false
        if (getCompany(state, companyId).kind !== 'major') return false
        if (asset.kind === 'train') {
            const train = state.trainInventory.trains.find((train) => train.id === asset.trainId)
            return (
                state.machineState === 'BuyingTrains' &&
                train?.status === 'owned' &&
                train.owner.kind === 'company' &&
                getCompany(state, train.owner.companyId).kind === 'major' &&
                !inReceivership(state, train.owner.companyId) &&
                (!finalDepotEmpty(state) || trainsOwnedBy(state, train.owner).length > 1)
            )
        }
        if (!['I', 'II'].includes(state.phaseId)) return false
        if (asset.kind === 'private')
            return privateOwner(state, asset.privateCompanyId)?.kind === 'player'
        return (
            asset.kind === 'company' &&
            ['MS', 'BIG4'].includes(asset.companyId) &&
            trainsCountingForLimit(state, TrainRules1846, companyId).length <
                TrainRules1846.trainLimit(state, companyId)
        )
    },
    priceRange(_state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        const id = asset.kind === 'private' ? asset.privateCompanyId : asset.companyId
        if (asset.kind === 'company' && !['MS', 'BIG4'].includes(id)) return undefined
        return { minimum: 1, maximum: draftCompany(id).price }
    },
    afterPurchase(
        state: CompanyDecisionState & AcquisitionState & SteamboatState & RevenueMarkerState,
        offer
    ) {
        if (offer.asset.kind === 'train') return
        if (offer.asset.kind === 'private') {
            releasePrivateReservations(state, [offer.asset.privateCompanyId])
            if (offer.asset.privateCompanyId === 'SC') delete state.steamboat
            if (isRevenuePrivate(offer.asset.privateCompanyId))
                state.pendingRevenueMarker = {
                    privateCompanyId: offer.asset.privateCompanyId,
                    companyId: offer.companyId
                }
            return
        }
        assert(offer.asset.kind === 'company', '1846 purchases private or independent companies')
        const id = offer.asset.companyId
        const set = state.operatingSet
        assertExists(set, 'An independent is acquired during operations')
        const assets = transferCompanyAssets(state, id, offer.companyId, { loans: false })
        assert(assets.trainIds.length === 1, 'An independent brings its single 2-train')
        state.independentAcquisitions.push({
            companyId: id,
            trainId: assets.trainIds[0],
            setNumber: set.number,
            roundNumber: set.roundNumber
        })
        const station = state.stations.find(
            (station) => station.companyId === id && station.status === 'placed'
        )
        assert(station?.status === 'placed', 'An independent has its home station')
        const stations: StationTransfer = { placedIds: [], unplacedIds: [] }
        if (
            !state.stations.some(
                (own) =>
                    own.companyId === offer.companyId &&
                    own.status === 'placed' &&
                    own.position.locationId === station.position.locationId
            )
        ) {
            addCompanyStations(state, offer.companyId, 1)
            const extra = state.stations.at(-1)
            assertExists(extra, 'Absorption provides an extra station')
            replaceStation(state, station.id, extra.id)
            stations.placedIds.push(extra.id)
        } else
            state.stations = state.stations.map((own) =>
                own.id === station.id ? { id: own.id, companyId: id, status: 'removed' } : own
            )
        const company = getCompany(state, id)
        company.closed = true
        delete company.president
        state.certificates = state.certificates.map((certificate) => {
            if (certificate.retired || certificate.companyId !== id) return certificate
            const { owner: _owner, poolId: _poolId, ...interest } = certificate
            return { ...interest, retired: true }
        })
        if (state.steamboat?.companyId === id) delete state.steamboat
        return { assets, stations }
    }
}

export function canRunAcquiredTrain(
    state: TrainRunningState & AcquisitionState & Pick<CompanyDecisionState, 'operatingSet'>,
    train: Train
): boolean {
    return !state.independentAcquisitions.some(
        (acquisition) =>
            acquisition.trainId === train.id &&
            acquisition.setNumber === state.operatingSet?.number &&
            acquisition.roundNumber === state.operatingSet.roundNumber
    )
}
