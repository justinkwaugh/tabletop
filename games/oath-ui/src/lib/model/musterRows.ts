import {
    HydratedMuster,
    suitOf,
    type HydratedOathGameState,
    type ModifierUse,
    type Suit
} from '@tabletop/oath'

export type MusterRow = {
    cardId: string
    suit: Suit
    /** Initiation Rite places a secret instead of favor. */
    paysSecret: boolean
    gain: number
}

/** Every Muster the player can make now, read from the engine's own plan (R-5.2, R-7.4). */
export function musterRows(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[]
): MusterRow[] {
    const available = HydratedMuster.available(state, playerId)
    return HydratedMuster.legalCards(state, playerId, modifiers).flatMap((cardId) => {
        const suit = suitOf(cardId)
        if (!suit) return []
        const { active } = HydratedMuster.plan(state, playerId, cardId, modifiers)
        const wanted = HydratedMuster.wanted(state, playerId, cardId, active)
        return [
            {
                cardId,
                suit,
                paysSecret: HydratedMuster.placesSecret(active),
                gain: Math.min(wanted, available)
            }
        ]
    })
}
