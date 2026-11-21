import { ActionSource, assert } from '@tabletop/common'
import {
    CashPayment,
    SystemActionFirstHandler,
    exchangeCertificate,
    finiteCashOwnedBy,
    getCompany,
    presidentOf,
    releaseTrains,
    removeCompanyStations,
    settleCashPayments,
    systemAction,
    trainsOwnedBy,
    type FinancialState,
    PresidencyChange,
    type StationState,
    type TrainState
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { MinorsMex } from './companies.js'
import { requireStateMex, type HydratedStateMex, type StateHandlerMex } from './state.js'
import { reassessPresidencyMex } from './stock.js'
import { PhasesMex, ThreeHalfPhaseId } from './trains.js'

const Id = Type.String({ minLength: 1 })

/** What a minor's closing did: its owner's trade-in certificate and the cash its major took. */
export const MinorClosure = Type.Object(
    {
        minorId: Id,
        playerId: Id,
        certificateId: Id,
        majorId: Id,
        payment: Type.Optional(CashPayment),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
export type MinorClosure = Type.Static<typeof MinorClosure>

type ClosingState = FinancialState &
    StationState &
    TrainState & { turnManager: { turnOrder: string[] } }

/**
 * The minors close: each owner receives the minor's trade-in certificate, the minor's money goes
 * to that major whether or not it has floated, and its station and built-in 2-train leave play
 * (5.2). A trade-in may change the major's presidency (3.5).
 */
export function closeMinorsMex(state: ClosingState): MinorClosure[] {
    return MinorsMex.flatMap((minor): MinorClosure[] => {
        const company = getCompany(state, minor.id)
        if (company.closed) return []
        const owner = presidentOf(state, minor.id)
        company.closed = true
        delete company.president
        releaseTrains(
            state.trainInventory,
            trainsOwnedBy(state, { kind: 'company', companyId: minor.id }).map((train) => train.id),
            'removed'
        )
        removeCompanyStations(state, minor.id)
        const cash = finiteCashOwnedBy(state, { kind: 'company', companyId: minor.id })
        const payment: CashPayment | undefined = cash
            ? {
                  from: { kind: 'company', companyId: minor.id },
                  to: { kind: 'company', companyId: minor.majorId },
                  amount: cash
              }
            : undefined
        if (payment) settleCashPayments(state, [payment])
        if (!owner || owner.kind !== 'player') {
            state.certificates = state.certificates.filter(
                (certificate) => certificate.id !== `${minor.id}:charter`
            )
            return []
        }
        exchangeCertificate(state, `${minor.id}:charter`, minor.tradeInCertificateId)
        const presidency = presidentOf(state, minor.majorId)
            ? reassessPresidencyMex(state, minor.majorId)
            : undefined
        return [
            {
                minorId: minor.id,
                playerId: owner.playerId,
                certificateId: minor.tradeInCertificateId,
                majorId: minor.majorId,
                ...(payment ? { payment } : {}),
                ...(presidency ? { presidency } : {})
            }
        ]
    })
}

const CloseMinorsAction = systemAction('CloseMinors', {
    metadata: Type.Optional(
        Type.Object({ closures: Type.Array(MinorClosure) }, { additionalProperties: false })
    )
})
export const CloseMinors = CloseMinorsAction.schema
export type CloseMinors = Type.Static<typeof CloseMinors>
export const isCloseMinors = CloseMinorsAction.is

/** Whether the minors' delayed closing is due: phase 3½ has begun and they are open (8(c)). */
function minorsClosingDue(state: HydratedStateMex): boolean {
    return (
        !!state.options.delayedMinorClose &&
        PhasesMex.isAtLeast(state.phaseId, ThreeHalfPhaseId) &&
        MinorsMex.some((minor) => !getCompany(state, minor.id).closed)
    )
}

/** Under optional rule 8(c) the minors close as the stock round after phase 3½ begins (8(c)). */
export class HydratedCloseMinors extends CloseMinorsAction.Base {
    declare metadata?: CloseMinors['metadata']
    apply(state: HydratedStateMex): void {
        assert(
            this.source === ActionSource.System && minorsClosingDue(state),
            'The minors close only when their delayed closing is due'
        )
        this.metadata = { closures: closeMinorsMex(state) }
    }
}

export const MinorActions = [CloseMinorsAction.define((action) => new HydratedCloseMinors(action))]

/** The stock round closes the minors first, when their delayed closing is due (8(c)). */
export function closesMinorsFirst(handler: StateHandlerMex): StateHandlerMex {
    return new SystemActionFirstHandler(handler, CloseMinors, (state) =>
        minorsClosingDue(requireStateMex(state)) ? {} : undefined
    )
}
