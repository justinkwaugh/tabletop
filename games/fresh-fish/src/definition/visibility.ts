import { assert, Visibility } from '@tabletop/common'
import type { FreshFishGameState } from '../model/gameState.js'
import { MachineState } from './states.js'

export const FreshFishVisibilityPolicy = {
    CurrentAuctionBid: 'fresh-fish.current-auction-bid'
} as const

function canViewCurrentAuctionBid({
    perspective,
    root,
    parent
}: Visibility.PolicyContext<FreshFishGameState>): boolean {
    if (root.machineState === MachineState.AuctionEnded) {
        return true
    }
    if (perspective.kind === 'spectator') {
        return false
    }
    assert(
        typeof parent === 'object' &&
            parent !== null &&
            'playerId' in parent &&
            typeof parent.playerId === 'string',
        'A Fresh Fish current auction bid must belong to an object with a playerId'
    )
    return parent.playerId === perspective.playerId
}

export const FreshFishVisibilityPolicies: Visibility.PolicyRegistry<FreshFishGameState> = {
    [FreshFishVisibilityPolicy.CurrentAuctionBid]: canViewCurrentAuctionBid
}
