import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import { AuctionKind } from '../model/auction.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { ShareSale, openShareAuction, settleShareAuction } from '../model/shareAuctionRules.js'

export type OfferShareMetadata = Type.Static<typeof OfferShareMetadata>
export const OfferShareMetadata = Type.Object({
    minimum: Type.Number(),
    withdrawnPlayerIds: Type.Array(Type.String()),
    sale: Type.Optional(ShareSale)
})

export type OfferShare = Type.Static<typeof OfferShare>
export const OfferShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.OfferShare),
            playerId: Type.String(),
            metadata: Type.Optional(OfferShareMetadata),
            railroadId: Type.Enum(RailroadId),
            ownShare: Type.Boolean()
        })
    ])
)

export const OfferShareValidator = Compile(OfferShare)

export function isOfferShare(action?: GameAction): action is OfferShare {
    return action?.type === ActionType.OfferShare
}

export class HydratedOfferShare extends HydratableAction<typeof OfferShare> implements OfferShare {
    declare type: ActionType.OfferShare
    declare playerId: string
    declare metadata?: OfferShareMetadata
    declare railroadId: RailroadId
    declare ownShare: boolean

    constructor(data: OfferShare) {
        super(data, OfferShareValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        if (this.ownShare) {
            assert(
                state.sharesHeld(this.railroadId, this.playerId) > 0,
                'You hold no share of that railroad'
            )
        } else {
            assert(
                state.unsoldOffers().includes(this.railroadId),
                'That railroad has no share to offer'
            )
        }
        const minimum = state.minimumBid(this.railroadId)
        const withdrawnPlayerIds = openShareAuction(state, {
            kind: AuctionKind.OfferStock,
            railroadId: this.railroadId,
            openerId: this.playerId,
            sellerId: this.ownShare ? this.playerId : undefined,
            minimum
        })
        const sale = settleShareAuction(state)
        this.metadata = { minimum, withdrawnPlayerIds, ...(sale ? { sale } : {}) }
    }

    static canOffer(state: HydratedSarGameState, playerId: string): boolean {
        return state.unsoldOffers().length > 0 || state.holdings(playerId).length > 0
    }
}
