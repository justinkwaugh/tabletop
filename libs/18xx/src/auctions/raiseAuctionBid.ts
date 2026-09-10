import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    type GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { activeAuction, canActInAuction, type OpeningAuctionState } from './auctionProcedure.js'
import { type WaterfallAuctionRules } from './waterfallAuction.js'

export const RaiseAuctionBid = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('RaiseAuctionBid'),
        lotId: Type.String(),
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type RaiseAuctionBid = Type.Static<typeof RaiseAuctionBid>
const RaiseAuctionBidValidator = Compile(RaiseAuctionBid)
export function isRaiseAuctionBid(action: GameAction): action is RaiseAuctionBid {
    return (
        action instanceof HydratedRaiseAuctionBid ||
        (action.type === 'RaiseAuctionBid' && RaiseAuctionBidValidator.Check(action))
    )
}
export class HydratedRaiseAuctionBid
    extends HydratableAction<typeof RaiseAuctionBid>
    implements RaiseAuctionBid
{
    declare type: 'RaiseAuctionBid'
    declare playerId: string
    declare lotId: string
    declare amount: number
    readonly #rules: WaterfallAuctionRules
    constructor(data: RaiseAuctionBid, rules: WaterfallAuctionRules) {
        super(
            data instanceof HydratedRaiseAuctionBid ? data.dehydrate() : data,
            RaiseAuctionBidValidator
        )
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            canActInAuction(state, model, this.playerId) &&
            !!model.auction.bidding &&
            model.canBid(this.playerId, this.lotId, this.amount)
        )
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid RaiseAuctionBid action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        model.bid(this.playerId, this.lotId, this.amount)
    }
}
