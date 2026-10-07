import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { ShareSale, placeShareBid, settleShareAuction } from '../model/shareAuctionRules.js'

export type PlaceBidMetadata = Type.Static<typeof PlaceBidMetadata>
export const PlaceBidMetadata = Type.Object({
    withdrawnPlayerIds: Type.Array(Type.String()),
    sale: Type.Optional(ShareSale)
})

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceBidMetadata),
            amount: Type.Number()
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare metadata?: PlaceBidMetadata
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(Number.isSafeInteger(this.amount), 'Bids are whole dollars')
        assert(this.amount >= state.smallestBid(), 'The bid is too low')
        assert(
            this.amount <= state.getPlayerState(this.playerId).cash,
            'A bid cannot exceed your cash'
        )
        const withdrawnPlayerIds = placeShareBid(state, this.playerId, this.amount)
        const sale = settleShareAuction(state)
        this.metadata = { withdrawnPlayerIds, ...(sale ? { sale } : {}) }
    }

    static canBid(state: HydratedHcgGameState, playerId: string): boolean {
        return (
            state.auction !== undefined &&
            state.bidding().currentBidderId === playerId &&
            state.getPlayerState(playerId).cash >= state.smallestBid()
        )
    }
}
