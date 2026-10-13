import {
    ActionType,
    HydratedMuster,
    suitOf,
    type HydratedOathGameState,
    type ModifierUse,
    type Suit
} from '@tabletop/oath'
import { fittingModifiers } from './modifierFit.js'

export type MusterRow = {
    cardId: string
    suit: Suit
    /** Initiation Rite places a secret instead of favor. */
    paysSecret: boolean
    gain: number
    /** The cards in use that fit this card: the row is counted and sent with them. */
    modifiers: ModifierUse[]
}

/** R-7.4 — the cards in use a Muster on this card is judged and sent with. */
export function musterModifiers(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    return fittingModifiers(state, playerId, ActionType.Muster, declared, { cardId })
}

/** Every Muster the player can make now, read from the engine's own plan (R-5.2, R-7.4). */
export function musterRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[]
): MusterRow[] {
    const siteId = state.getPlayerState(playerId).siteId
    if (siteId === undefined) return []
    const available = HydratedMuster.available(state, playerId)
    return state.denizensAt(siteId).flatMap((cardId): MusterRow[] => {
        const suit = suitOf(cardId)
        if (!suit) return []
        const modifiers = musterModifiers(state, playerId, cardId, declared)
        const plan = HydratedMuster.plan(state, playerId, cardId, modifiers)
        if (plan.reason) return []
        const wanted = HydratedMuster.wanted(state, playerId, cardId, plan.active)
        return [
            {
                cardId,
                suit,
                paysSecret: HydratedMuster.placesSecret(plan.active),
                gain: Math.min(wanted, available),
                modifiers
            }
        ]
    })
}
