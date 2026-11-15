import type { HydratedOathGameState } from '@tabletop/oath'

/**
 * R-2.8.1, R-2.9 — the cards in a site's row as the board draws them: an edifice first, next to the
 * site card, whatever the stored order, so it never moves as denizens come and go.
 */
export function siteRowCards(
    gameState: Pick<HydratedOathGameState, 'denizensBySite' | 'isEdifice'>,
    slotId: string
): string[] {
    const cards = gameState.denizensBySite[slotId] ?? []
    return [
        ...cards.filter((cardId) => gameState.isEdifice(cardId)),
        ...cards.filter((cardId) => !gameState.isEdifice(cardId))
    ]
}
