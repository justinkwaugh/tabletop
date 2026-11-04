import {
    OathRevision,
    PowerChoiceKind,
    PowerTiming,
    isAtLeastOathRevision,
    offeredChoices,
    playShowsCard,
    powersWithTiming,
    type HydratedOathGameState,
    type LegalChoice,
    type PlayMapChanges,
    type SearchPlay,
    type Suit
} from '@tabletop/oath'

/**
 * R-7.3.3 — the choices a card's When Played text opens, asked only when the play shows the card.
 * A "may" the seat cannot take now leaves nothing to ask (a Citizen's Long-Lost Heir), so the
 * play goes straight on and sends no choices. `mapChanges` is what the play does to the map first, and
 * what it gains before the power (R-7.3.3), which a "may" can depend on (Bewitch).
 */
export function whenPlayedChoices(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    faceUp: boolean | undefined,
    mapChanges?: PlayMapChanges
): LegalChoice[] {
    if (!playShowsCard(play, faceUp)) return []
    const power = powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
    if (!power) return []
    const offered = offeredChoices(state, playerId, power, mapChanges).map((legal) =>
        withoutLeaving(legal, mapChanges?.leaving ?? [])
    )
    return offered.some((legal) => legal.spec.min > 0 || legal.options.length > 0) ? offered : []
}

/**
 * R-7.3.3, R-7.1.3 — the favor banks a When Played power's picks are judged on, as the engine judges them: from
 * revision 16, each bank as the play leaves it (its site favor and Homeland taken, the favor on a card it discards
 * given back), from the engine's plan of the play; before, the banks on the table.
 */
export function whenPlayedBanks(
    state: HydratedOathGameState,
    mapChanges: PlayMapChanges | undefined
): Readonly<Record<Suit, number>> {
    return (
        (isAtLeastOathRevision(state, OathRevision.EngineFixes12)
            ? mapChanges?.gains?.favorBank
            : undefined) ?? state.favorBank
    )
}

/**
 * R-5.1.4.I, R-11.10 — a card the play discards first is no longer at a site, so the engine refuses
 * it as a target (Great Herd), and it is not offered.
 */
function withoutLeaving(legal: LegalChoice, leaving: readonly string[]): LegalChoice {
    if (leaving.length === 0) return legal
    return {
        ...legal,
        options: legal.options.filter(
            (option) => option.kind !== PowerChoiceKind.Card || !leaving.includes(option.cardId)
        )
    }
}
