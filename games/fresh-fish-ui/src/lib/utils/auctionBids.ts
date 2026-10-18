import { isEndAuction, MachineState, type EndAuction } from '@tabletop/fresh-fish'
import type { GameAction } from '@tabletop/common'

export function losingBids(action: EndAuction) {
    return (action.metadata?.participants ?? [])
        .filter((participant) => participant.playerId !== action.winnerId)
        .toSorted((a, b) => (b.bid ?? 0) - (a.bid ?? 0))
}

export function wonStallPrice(machineState: MachineState, actions: GameAction[]) {
    if (machineState !== MachineState.AuctionEnded) {
        return undefined
    }
    return actions.findLast((action) => isEndAuction(action))?.highBid
}
