import {
    PowerTiming,
    legalChoices,
    playShowsCard,
    powersWithTiming,
    type HydratedOathGameState,
    type LegalChoice,
    type SearchPlay
} from '@tabletop/oath'

/** R-7.3.3 — the choices a card's When Played text opens, asked only when the play shows the card. */
export function whenPlayedChoices(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    faceUp: boolean | undefined
): LegalChoice[] {
    if (!playShowsCard(play, faceUp)) return []
    const power = powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
    return power ? legalChoices(state, playerId, power) : []
}
