import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { ShareSale, passShareBid, settleShareAuction } from '../model/shareAuctionRules.js'

export type PassBidMetadata = Type.Static<typeof PassBidMetadata>
export const PassBidMetadata = Type.Object({
    sale: Type.Optional(ShareSale)
})

export type PassBid = Type.Static<typeof PassBid>
export const PassBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassBid),
            playerId: Type.String(),
            metadata: Type.Optional(PassBidMetadata)
        })
    ])
)

export const PassBidValidator = Compile(PassBid)

export function isPassBid(action?: GameAction): action is PassBid {
    return action?.type === ActionType.PassBid
}

export class HydratedPassBid extends HydratableAction<typeof PassBid> implements PassBid {
    declare type: ActionType.PassBid
    declare playerId: string
    declare metadata?: PassBidMetadata

    constructor(data: PassBid) {
        super(data, PassBidValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(HydratedPassBid.canPass(state, this.playerId), 'You cannot pass now')
        passShareBid(state, this.playerId)
        const sale = settleShareAuction(state)
        this.metadata = sale ? { sale } : {}
    }

    // Whoever starts an auction opens it with a bid, so there is always a buyer.
    static canPass(state: HydratedHcgGameState, playerId: string): boolean {
        return (
            state.auction !== undefined &&
            state.bidding().hasBid &&
            state.bidding().currentBidderId === playerId
        )
    }
}
