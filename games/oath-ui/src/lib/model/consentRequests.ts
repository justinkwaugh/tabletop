import {
    ConsentRequestKind,
    WarbandMoveKind,
    type HydratedOathGameState,
    type PendingConsent
} from '@tabletop/oath'
import { warbandsOf } from './names.js'

type NameOf = (playerId: string) => string

/** A run of the question: words (warband counts drawn as their pieces), or a seat drawn as its chip. */
export type ConsentPart = { kind: 'text'; text: string } | { kind: 'seat'; playerId: string }

/** The step the request belongs to, and the one line that Allow (or Join) answers. */
export type ConsentQuestion = { heading: string; parts: ConsentPart[] }

const text = (words: string): ConsentPart => ({ kind: 'text', text: words })
const seat = (playerId: string): ConsentPart => ({ kind: 'seat', playerId })

/** R-6.5.a, R-6.5.b — the History's "asked … permission" row keeps who asks whom and why. */
function warbandMoveParts(askerId: string, warbands: string, kind: WarbandMoveKind): ConsentPart[] {
    switch (kind) {
        case WarbandMoveKind.SiteToBoard:
            return [text('Let '), seat(askerId), text(` move ${warbands} off their site?`)]
        case WarbandMoveKind.BoardToSite:
            return [text('Let '), seat(askerId), text(` move ${warbands} onto their site?`)]
        case WarbandMoveKind.GiveToImperial:
            return [text('Let '), seat(askerId), text(` give you ${warbands}?`)]
        case WarbandMoveKind.TakeFromImperial:
            return [text('Let '), seat(askerId), text(` take ${warbands} from your board?`)]
    }
}

/**
 * R-6.5.a, R-6.5.b, R-5.5.2.a — what the asked player is being asked. A Citizenship offer is
 * answered on its own panel, so it has no line here.
 */
export function consentQuestion(
    state: HydratedOathGameState,
    pending: PendingConsent,
    nameOf: NameOf
): ConsentQuestion | undefined {
    const askerId = pending.askingPlayerId
    const request = pending.request
    switch (request.kind) {
        case ConsentRequestKind.WarbandMove:
            return {
                heading: 'Move warbands',
                parts: warbandMoveParts(
                    askerId,
                    warbandsOf(request.count, request.owner, nameOf, askerId),
                    request.move.kind
                )
            }
        case ConsentRequestKind.JoinDefence: {
            // The defender is whom the Citizen would fight for; the turn bar names the attacker.
            const defenderId = state.pendingCampaign?.declaration.defenderPlayerId
            return {
                heading: 'Campaign',
                parts: defenderId
                    ? [text('Join '), seat(defenderId), text('’s defence?')]
                    : [text('Join the defence?')]
            }
        }
        case ConsentRequestKind.AdmitAlly:
            return {
                heading: 'Campaign',
                parts: [text('Let '), seat(askerId), text(' join your defence?')]
            }
        case ConsentRequestKind.CitizenshipOffer:
            return undefined
    }
}
