import * as Type from 'typebox'
import { Color } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { CitizenshipTerms } from './citizenship.js'
import { WarbandMove } from './warbandMove.js'

export enum ConsentRequestKind {
    /** R-6.6.1 */
    CitizenshipOffer = 'citizenshipOffer',
    /** R-6.5.a, R-6.5.b */
    WarbandMove = 'warbandMove',
    /** R-5.5.2.a — a Citizen deciding whether to join the defence. */
    JoinDefence = 'joinDefence',
    /** R-5.5.2.a — the defender's permission for that Citizen to join. */
    AdmitAlly = 'admitAlly'
}

/** R-X.1 — holds enough of the asking action to re-read it, so what is consented to is what happens. */
export type ConsentRequest = Type.Static<typeof ConsentRequest>
export const ConsentRequest = Type.Union([
    Type.Object({
        kind: Type.Literal(ConsentRequestKind.CitizenshipOffer),
        /** R-6.6.1 */
        exilePlayerId: Type.String(),
        /** R-6.6.1 */
        reliquarySlotId: Type.String(),
        /** R-6.6.1 — the binding exchange, exactly as offered. */
        terms: Type.Optional(CitizenshipTerms)
    }),
    Type.Object({
        kind: Type.Literal(ConsentRequestKind.WarbandMove),
        move: WarbandMove,
        color: Type.Enum(Color),
        count: Type.Integer({ minimum: 1, maximum: 999 })
    }),
    Type.Object({
        kind: Type.Literal(ConsentRequestKind.JoinDefence),
        citizenPlayerId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(ConsentRequestKind.AdmitAlly),
        citizenPlayerId: Type.String()
    })
])

/** R-X.1 */
export type PendingConsent = Type.Static<typeof PendingConsent>
export const PendingConsent = Type.Object({
    request: ConsentRequest,
    askingPlayerId: Type.String(),
    askedPlayerId: Type.String(),
    /** Absent for R-5.5.2.a's asks, which go on into the Campaign they hold. */
    resumeMachineState: Type.Optional(Type.Enum(MachineState))
})
