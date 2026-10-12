import {
    PowerTiming,
    offeredChoices,
    playShowsCard,
    powersWithTiming,
    type HydratedOathGameState,
    type LegalChoice,
    type SearchPlay
} from '@tabletop/oath'

/**
 * R-7.3.3 — the choices a card's When Played text opens, asked only when the play shows the card.
 * A "may" the seat cannot take now leaves nothing to ask (a Citizen's Long-Lost Heir), so the
 * play goes straight on and sends no choices.
 */
export function whenPlayedChoices(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    faceUp: boolean | undefined
): LegalChoice[] {
    if (!playShowsCard(play, faceUp)) return []
    const power = powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
    if (!power) return []
    const offered = offeredChoices(state, playerId, power)
    return offered.some((legal) => legal.spec.min > 0 || legal.options.length > 0) ? offered : []
}
