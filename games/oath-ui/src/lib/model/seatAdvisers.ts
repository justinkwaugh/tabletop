import type { OathProjectedPlayerState } from '@tabletop/oath'

/** One adviser as a seat draws it: named when faceup, to its holder, or to a player it was shown to; a back otherwise. */
export interface SeatAdviser {
    key: string
    cardId?: string
    faceUp: boolean
    /** R-9.4 — this viewer was let peek at it; it is still facedown to the table. */
    shownToMe: boolean
}

// R-2.2.2, R-9.4 — a facedown adviser is named to its holder from the holder's own list, and to a
// player its holder let peek from the row's own shown field, whatever data this client happens to hold.
export function seatAdvisers(
    playerState: Pick<OathProjectedPlayerState, 'advisers' | 'adviserIds'>,
    isHolder: boolean
): SeatAdviser[] {
    return playerState.advisers.map((row, index) => {
        const shown = !row.faceUp && !isHolder ? row.shownCardId : undefined
        const cardId = row.faceUp ? row.cardId : isHolder ? playerState.adviserIds?.[index] : shown
        return {
            key: cardId ?? `facedown-${index}`,
            cardId,
            faceUp: row.faceUp,
            shownToMe: shown !== undefined
        }
    })
}
