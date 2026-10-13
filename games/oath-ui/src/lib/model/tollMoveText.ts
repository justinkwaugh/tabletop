import {
    PowerMoveKind,
    PowerMoveTollOutcome,
    type PaidToll,
    type PowerMoveToll
} from '@tabletop/oath'
import { assertExists } from '@tabletop/common'
import { cardName, nameSeats, plural } from '$lib/model/names.js'
import type { HistoryNames } from '$lib/model/actionDescription.js'

/** A relic is "the Whistle"; a denizen is named bare ("Palanquin"). */
function powerName(cardId: string | undefined): string {
    assertExists(cardId, 'A toll on the Whistle or Palanquin names the card')
    return cardId.startsWith('relic.') ? `the ${cardName(cardId)}` : cardName(cardId)
}

function moveClause(record: PowerMoveToll, names: HistoryNames): string {
    switch (record.move) {
        case PowerMoveKind.Banish:
            return `banished ${record.movedPlayerId}`
        case PowerMoveKind.ShroudedWood:
            return `sent ${record.movedPlayerId} from ${names.site(record.fromSiteId)}`
        case PowerMoveKind.Whistle:
        case PowerMoveKind.Palanquin:
            return `used ${powerName(record.powerCardId)} on ${record.movedPlayerId}`
    }
}

function givenFavor(toll: PaidToll): string {
    return toll.payeeId ? `paid ${toll.payeeId} 1 favor` : 'burned 1 favor'
}

function storyClause(record: PowerMoveToll, names: HistoryNames): string {
    const moved = record.movedPlayerId
    const card = cardName(record.toll.cardId)
    const both = record.move === PowerMoveKind.Palanquin
    const notes = record.notes?.length ? ` (${record.notes.join('; ')})` : ''
    switch (record.outcome) {
        case PowerMoveTollOutcome.Paid: {
            const secrets = record.secretsTaken ?? 0
            const taking =
                secrets > 0
                    ? `, taking ${powerName(record.powerCardId)}'s ${plural(secrets, 'secret')}`
                    : ''
            return both
                ? `${moved} ${givenFavor(record.toll)} (${card}), and both went to ${names.site(record.toSiteId)}${notes}`
                : `${moved} ${givenFavor(record.toll)} (${card}) and went to ${names.site(record.toSiteId)}${taking}${notes}`
        }
        case PowerMoveTollOutcome.Refused:
            return both
                ? `${moved} refused ${card}, and neither moved`
                : `${moved} refused ${card} and stayed at ${names.site(record.fromSiteId)}`
        case PowerMoveTollOutcome.NoFavor:
            return both
                ? `${moved} had no favor for ${card}, and neither moved`
                : `${moved} had no favor for ${card} and stayed at ${names.site(record.fromSiteId)}`
        case PowerMoveTollOutcome.Asked:
            return ''
    }
}

/**
 * The move and, once settled, the toll's story; `cost` follows the move while the question is
 * open ("…on Dana, placing a secret on it").
 */
export function tollMoveText(
    record: PowerMoveToll,
    names: HistoryNames,
    viewerId: string | undefined,
    cost = ''
): string {
    const move = moveClause(record, names)
    const burned = record.favorBurned ?? 0
    const text =
        record.outcome === PowerMoveTollOutcome.Asked
            ? `${move}${cost}`
            : `${move}; ${storyClause(record, names)}` +
              (burned > 0 ? `; ${record.moverPlayerId} burned ${burned} favor` : '')
    return nameSeats(text, names, viewerId, record.moverPlayerId)
}

/** The story alone, for a row that already says who did what (the spoils). */
export function tollStoryText(
    record: PowerMoveToll,
    names: HistoryNames,
    viewerId: string | undefined
): string {
    return nameSeats(storyClause(record, names), names, viewerId, record.moverPlayerId)
}

/** A toll inside another row, what happened then the card: "paid Rhys 1 favor (Toll Roads)". */
export function paidTollClause(toll: PaidToll): string {
    return `${givenFavor(toll)} (${cardName(toll.cardId)})`
}

/** Forced Labor on Oracle, after the power's summary: "paid Rhys 1 favor (Forced Labor)". */
export function tollsGivenText(
    tolls: readonly PaidToll[],
    names: HistoryNames,
    viewerId: string | undefined,
    actorId: string | undefined
): string {
    return nameSeats(tolls.map(paidTollClause).join('; '), names, viewerId, actorId)
}
