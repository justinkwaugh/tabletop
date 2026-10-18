import type { EndAuction } from '@tabletop/fresh-fish'

export function losingBids(action: EndAuction) {
    return (action.metadata?.participants ?? [])
        .filter((participant) => participant.playerId !== action.winnerId)
        .toSorted((a, b) => (b.bid ?? 0) - (a.bid ?? 0))
}
