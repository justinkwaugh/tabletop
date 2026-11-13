import type { HydratedOathGameState, OathProjectedPlayerState } from '@tabletop/oath'
import { mapSlotsFor } from '@tabletop/oath'
import { REGIONS } from '$lib/definitions/boardGeometry.js'
import type { PreviewGroupCard } from './cardPreview.svelte.js'
import { cardName, cardNameInPlay } from './names.js'
import { adviserLabel, seatAdvisers } from './seatAdvisers.js'
import { siteRowCards } from './siteRow.js'

// Rule 4 — the groups an enlarged card pages through. Each holds only cards its viewer can already
// enlarge where they lie, so paging shows nothing new.

/**
 * The map's faceup denizens and edifices: the Cradle, the Provinces, then the Hinterland, each
 * region's sites top to bottom and each row left to right, an edifice first as the board draws it.
 * A site card, a relic at a site and a facedown site's row are not in it.
 */
export function mapPreviewGroup(
    gameState: Pick<
        HydratedOathGameState,
        'denizensBySite' | 'isEdifice' | 'isRuined' | 'isSiteFaceup'
    >
): PreviewGroupCard[] {
    return REGIONS.flatMap((region) => mapSlotsFor(region))
        .filter((slotId) => gameState.isSiteFaceup(slotId))
        .flatMap((slotId) => siteRowCards(gameState, slotId))
        .map((cardId) => ({ cardId, label: cardNameInPlay(gameState, cardId) }))
}

/**
 * One seat's advisers, then its relics. R-2.2.2, R-9.4 — a facedown adviser is in it only for its
 * holder, or for a player it was shown to, named as the seat names it.
 */
export function seatPreviewGroup(
    playerState: Pick<
        OathProjectedPlayerState,
        'playerId' | 'advisers' | 'adviserIds' | 'relicIds'
    >,
    viewerId: string | undefined
): PreviewGroupCard[] {
    const advisers = seatAdvisers(playerState, viewerId).flatMap((adviser) =>
        adviser.cardId
            ? [{ cardId: adviser.cardId, label: adviserLabel(adviser, cardName(adviser.cardId)) }]
            : []
    )
    const relics = playerState.relicIds.map((cardId) => ({ cardId, label: cardName(cardId) }))
    return [...advisers, ...relics]
}

/** The cards a panel shows from a draw or a deal, in the order they came, a Vision included. */
export function drawnPreviewGroup(cardIds: readonly string[]): PreviewGroupCard[] {
    return cardIds.map((cardId) => ({ cardId, label: cardName(cardId) }))
}
