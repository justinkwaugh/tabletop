import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type MachineStateHandler
} from '@tabletop/common'
import {
    CashPayment,
    closePrivate,
    privateOwningCompany,
    President,
    StationReservation,
    companyMarketSpace,
    finiteCashOwnedBy,
    getCompany,
    removeStockMarker,
    trainsOwnedBy,
    unownedTrain,
    settleCashPayments
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'
import { RevenueMarker } from './revenueMarkers.js'

export function corporationAwaitingClosure(
    state: HydratedEighteenFortySixState
): string | undefined {
    return state.companies.find(
        (company) =>
            company.kind === 'major' &&
            company.started &&
            !company.closed &&
            companyMarketSpace(state.stockMarket, company.id).price === 0
    )?.id
}

export const RailroadClosure = Type.Object(
    {
        companyId: Type.String(),
        president: Type.Optional(President),
        payments: Type.Array(CashPayment),
        retiredCertificateIds: Type.Array(Type.String()),
        closedPrivateIds: Type.Array(Type.String()),
        removedRevenueMarkers: Type.Array(RevenueMarker),
        removedReservations: Type.Array(StationReservation),
        removedStationIds: Type.Array(Type.String()),
        removedTrainIds: Type.Array(Type.String()),
        removedMarketSpaceId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type RailroadClosure = Type.Static<typeof RailroadClosure>

const ClosureFields = Type.Object(
    {
        type: Type.Literal('CloseCorporation'),
        source: Type.Literal(ActionSource.System),
        companyId: Type.String(),
        metadata: Type.Optional(RailroadClosure)
    },
    { additionalProperties: false }
)
export const CloseCorporation: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof ClosureFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ClosureFields.properties },
    { additionalProperties: false }
)
export const CloseCorporationValidator: ReturnType<typeof Compile<typeof CloseCorporation>> =
    Compile(CloseCorporation)
export class CloseCorporationAction extends HydratableAction<typeof CloseCorporation> {
    declare companyId: string
    declare metadata?: Type.Static<typeof CloseCorporation>['metadata']
    constructor(data: Type.Static<typeof CloseCorporation>) {
        super(data, CloseCorporationValidator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                corporationAwaitingClosure(state) === this.companyId,
            'Only the next zero-price corporation can close'
        )
        this.metadata = closeRailroad(state, this.companyId)
    }
}

export const corporationClosureHandler: Omit<
    MachineStateHandler<CloseCorporationAction, HydratedEighteenFortySixState>,
    'onAction'
> = {
    enter(context) {
        const companyId = corporationAwaitingClosure(context.gameState)
        assertExists(companyId, 'Closure requires a zero-price corporation')
        context.addSystemAction(CloseCorporation, { companyId })
    },
    validActionsForPlayer() {
        return []
    },
    isValidAction(action, { gameState }) {
        return (
            action instanceof CloseCorporationAction &&
            action.source === ActionSource.System &&
            action.companyId === corporationAwaitingClosure(gameState)
        )
    }
}

export function closeRailroad(
    state: HydratedEighteenFortySixState,
    companyId: string
): RailroadClosure {
    const company = getCompany(state, companyId)
    const owner = { kind: 'company' as const, companyId: company.id }
    const amount = finiteCashOwnedBy(state, owner)
    const closedPrivateIds = state.companies
        .filter(
            (company) =>
                company.kind === 'private' && privateOwningCompany(state, company.id) === companyId
        )
        .map((company) => company.id)
    const payments: Type.Static<typeof CashPayment>[] = amount
        ? [{ from: owner, to: { kind: 'bank' }, amount }]
        : []
    const retiredCertificateIds = state.certificates
        .filter(
            (certificate) =>
                !certificate.retired &&
                (certificate.companyId === company.id ||
                    closedPrivateIds.includes(certificate.companyId))
        )
        .map((certificate) => certificate.id)
    const removedStationIds = state.stations
        .filter((station) => station.companyId === company.id && station.status !== 'removed')
        .map((station) => station.id)
    const removedTrainIds = trainsOwnedBy(state, owner).map((train) => train.id)
    const details: RailroadClosure = {
        companyId,
        ...(company.president ? { president: structuredClone(company.president) } : {}),
        payments,
        closedPrivateIds,
        removedRevenueMarkers: state.revenueMarkers.filter(
            (marker) => marker.companyId === company.id
        ),
        retiredCertificateIds,
        removedStationIds,
        removedTrainIds,
        removedReservations: structuredClone(
            state.stationReservations.filter((reservation) => reservation.companyId === company.id)
        ),
        ...(company.kind === 'major'
            ? { removedMarketSpaceId: companyMarketSpace(state.stockMarket, company.id).id }
            : {})
    }
    settleCashPayments(state, payments)
    for (const id of closedPrivateIds) closePrivate(state, id)
    if (state.steamboat?.companyId === company.id) delete state.steamboat
    state.revenueMarkers = state.revenueMarkers.filter((marker) => marker.companyId !== company.id)
    company.closed = true
    delete company.president
    state.certificates = state.certificates.map((certificate) => {
        if (certificate.retired || certificate.companyId !== company.id) return certificate
        const { owner: _owner, poolId: _poolId, ...retired } = certificate
        return { ...retired, retired: true }
    })
    state.stations = state.stations.map((station) =>
        station.companyId === company.id
            ? { id: station.id, companyId: company.id, status: 'removed' }
            : station
    )
    state.stationReservations = state.stationReservations.filter(
        (reservation) => reservation.companyId !== company.id
    )
    state.trainInventory.trains = state.trainInventory.trains.map((train) =>
        removedTrainIds.includes(train.id) ? unownedTrain(train, 'removed') : train
    )
    if (company.kind === 'major') removeStockMarker(state.stockMarket, company.id)
    return details
}
