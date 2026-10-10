import { cardName } from './names.js'
import type { TravelChoice, TravelRow } from './travelRows.js'

/** R-9.4 — a facedown destination is never named. */
export const destinationName = (row: TravelRow): string =>
    row.cardId ? cardName(row.cardId) : 'A facedown site'

const payee = (playerId: string | undefined, nameOf: (playerId: string) => string) =>
    playerId ? nameOf(playerId) : 'the fire'

/** A way's button in words, for its tooltip and its accessible name (R-5.6, R-7.1.4, R-11.12). */
export function travelSpoken(
    row: TravelRow,
    way: TravelChoice,
    nameOf: (playerId: string) => string
): string {
    const parts = [way.cost > 0 ? `spend ${way.cost} Supply` : 'spend no Supply']
    way.tolls.forEach((cardId, index) => {
        parts.push(`give 1 favor to ${payee(way.favorTo[index], nameOf)} (${cardName(cardId)})`)
    })
    if (way.flipSecret) parts.push('flip a secret facedown')
    return `Travel to ${destinationName(row)}: ${parts.join(', ')}`
}

/**
 * R-7.1.4 — a way's tolls as its button reads them: the favor given and to whom (each payee
 * once, in the tolls' order), and the favor burned where the bandits rule the card.
 */
export type TollFavor = { given: number; payeeIds: string[]; burned: number }

export function tollFavor(way: TravelChoice): TollFavor {
    const payeeIds = way.favorTo.filter((playerId): playerId is string => playerId !== undefined)
    return {
        given: payeeIds.length,
        payeeIds: [...new Set(payeeIds)],
        burned: way.favorTo.length - payeeIds.length
    }
}
