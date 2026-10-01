import {
    ConsentRequestKind,
    WarbandMoveKind,
    type HydratedOathGameState,
    type PendingConsent
} from '@tabletop/oath'
import { warbandsOf } from './names.js'

type NameOf = (playerId: string) => string

/** R-6.5.a, R-6.5.b */
function warbandMoveQuestion(asker: string, warbands: string, kind: WarbandMoveKind): string {
    switch (kind) {
        case WarbandMoveKind.SiteToBoard:
            return `${asker} asks your permission, as Chancellor, to move ${warbands} off their site to their board.`
        case WarbandMoveKind.BoardToSite:
            return `${asker} asks your permission to move ${warbands} from their board onto their site.`
        case WarbandMoveKind.GiveToImperial:
            return `${asker} asks your permission to give you ${warbands}.`
        case WarbandMoveKind.TakeFromImperial:
            return `${asker} asks your permission to take ${warbands} from your board.`
    }
}

/** R-6.5.a, R-6.5.b, R-5.5.2.a, R-6.6.1 — what the asked player is being asked. */
export function consentQuestion(
    state: HydratedOathGameState,
    pending: PendingConsent,
    nameOf: NameOf
): string {
    const asker = nameOf(pending.askingPlayerId)
    const request = pending.request
    switch (request.kind) {
        case ConsentRequestKind.WarbandMove:
            return warbandMoveQuestion(
                asker,
                warbandsOf(request.count, request.owner, nameOf, pending.askingPlayerId),
                request.move.kind
            )
        case ConsentRequestKind.JoinDefence: {
            const defenderId = state.pendingCampaign?.declaration.defenderPlayerId
            const against = defenderId ? ` against ${nameOf(defenderId)}` : ''
            return `${asker} is campaigning${against}. Your pawn is in the battle: join the defence as an Ally?`
        }
        case ConsentRequestKind.AdmitAlly:
            return `${asker} asks to join your defence as an Ally.`
        case ConsentRequestKind.CitizenshipOffer:
            return `${asker} offers you Citizenship.`
    }
}
