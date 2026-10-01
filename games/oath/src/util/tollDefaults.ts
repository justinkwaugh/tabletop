import { HydratedOathGameState } from '../model/gameState.js'
import { tollsFor, type TollOccasion } from './tolls.js'

/** R-7.1.4 — the demanded tolls; an optional discount is the player's choice (`HydratedTravel.legalTerms`). */
export function defaultTolls(
    state: HydratedOathGameState,
    actorId: string,
    occasion: TollOccasion
): string[] {
    return tollsFor(state, actorId, occasion)
        .filter((t) => !t.discount)
        .map((t) => t.cardId)
}
