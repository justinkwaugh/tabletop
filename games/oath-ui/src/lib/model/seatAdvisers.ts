import type { OathProjectedPlayerState } from '@tabletop/oath'

/** One adviser as a seat draws it: named when faceup, to its holder, or to a player it was shown to; a back otherwise. */
export interface SeatAdviser {
    key: string
    cardId?: string
    faceUp: boolean
    /** R-9.4 — this viewer was let peek at it; it is still facedown to the table. */
    shownToMe: boolean
}

// R-2.2.2, R-9.4 — a facedown adviser is named to its holder, and to a player its holder let peek,
// by who the viewer is rather than by what data this client happens to hold.
export function seatAdvisers(
    playerState: Pick<OathProjectedPlayerState, 'playerId' | 'advisers' | 'adviserIds'>,
    viewerId: string | undefined
): SeatAdviser[] {
    const isHolder = viewerId !== undefined && viewerId === playerState.playerId
    return playerState.advisers.map((row, index) => {
        const shownToViewer =
            !row.faceUp && !isHolder && viewerId !== undefined && row.shownTo?.includes(viewerId)
        const shown = shownToViewer ? row.shownCardId : undefined
        const cardId = row.faceUp ? row.cardId : isHolder ? playerState.adviserIds?.[index] : shown
        return {
            key: cardId ?? `facedown-${index}`,
            cardId,
            faceUp: row.faceUp,
            shownToMe: shown !== undefined
        }
    })
}
