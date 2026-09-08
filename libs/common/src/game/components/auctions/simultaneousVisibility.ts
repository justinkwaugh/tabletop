import { assert } from '../../../util/assertions.js'
import type { PolicyContext } from '../../visibility/valueProjector.js'
import { AuctionParticipantValidator } from './auction.js'
import { isSimultaneousAuctionResolved, SimultaneousAuction } from './simultaneous.js'

export function canViewSimultaneousAuctionBid(context: PolicyContext<unknown>): boolean {
    assert(
        AuctionParticipantValidator.Check(context.parent),
        'A simultaneous auction bid must belong to an Auction Participant'
    )
    if (
        context.perspective.kind === 'player' &&
        context.perspective.playerId === context.parent.playerId
    ) {
        return true
    }
    return isSimultaneousAuctionResolved(context.requireScope(SimultaneousAuction))
}
