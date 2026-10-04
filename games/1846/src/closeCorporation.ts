import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, assert } from '@tabletop/common'
import {
    CashPayment,
    President,
    StationReservation,
    companyMarketSpace,
    finiteCashOwnedBy,
    getCompany,
    removeStockMarker,
    settleCashPayments
} from '@tabletop/18xx'
import type { HydratedEighteenFortySixState } from './state.js'

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

const ClosureFields = Type.Object(
    {
        type: Type.Literal('CloseCorporation'),
        source: Type.Literal(ActionSource.System),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    president: Type.Optional(President),
                    payments: Type.Array(CashPayment),
                    retiredCertificateIds: Type.Array(Type.String()),
                    removedReservations: Type.Array(StationReservation),
                    removedStationIds: Type.Array(Type.String()),
                    removedMarketSpaceId: Type.String()
                },
                { additionalProperties: false }
            )
        )
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
        const company = getCompany(state, this.companyId)
        const owner = { kind: 'company' as const, companyId: company.id }
        const amount = finiteCashOwnedBy(state, owner)
        const payments: Type.Static<typeof CashPayment>[] = amount
            ? [{ from: owner, to: { kind: 'bank' }, amount }]
            : []
        const retiredCertificateIds = state.certificates
            .filter((certificate) => !certificate.retired && certificate.companyId === company.id)
            .map((certificate) => certificate.id)
        const removedStationIds = state.stations
            .filter((station) => station.companyId === company.id && station.status !== 'removed')
            .map((station) => station.id)
        this.metadata = {
            ...(company.president ? { president: structuredClone(company.president) } : {}),
            payments,
            retiredCertificateIds,
            removedStationIds,
            removedReservations: structuredClone(
                state.stationReservations.filter(
                    (reservation) => reservation.companyId === company.id
                )
            ),
            removedMarketSpaceId: companyMarketSpace(state.stockMarket, company.id).id
        }
        settleCashPayments(state, payments)
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
        removeStockMarker(state.stockMarket, company.id)
    }
}
