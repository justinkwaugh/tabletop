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
import type { OfferPileAuctionRules } from './offerPileAuction.js'

export const BidOnAuctionLot = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BidOnAuctionLot'),
        lotId: Type.String(),
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type BidOnAuctionLot = Type.Static<typeof BidOnAuctionLot>
const BidOnAuctionLotValidator = Compile(BidOnAuctionLot)
export function isBidOnAuctionLot(action: GameAction): action is BidOnAuctionLot {
    return (
        action instanceof HydratedBidOnAuctionLot ||
        (action.type === 'BidOnAuctionLot' && BidOnAuctionLotValidator.Check(action))
    )
}
export class HydratedBidOnAuctionLot
    extends HydratableAction<typeof BidOnAuctionLot>
    implements BidOnAuctionLot
{
    declare type: 'BidOnAuctionLot'
    declare playerId: string
    declare lotId: string
    declare amount: number
    readonly #rules: OfferPileAuctionRules
    constructor(data: BidOnAuctionLot, rules: OfferPileAuctionRules) {
        super(
            data instanceof HydratedBidOnAuctionLot ? data.dehydrate() : data,
            BidOnAuctionLotValidator
        )
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            canActInAuction(state, model, this.playerId) &&
            model.canBid(this.playerId, this.lotId, this.amount)
        )
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid BidOnAuctionLot action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        model.bid(this.playerId, this.lotId, this.amount)
    }
}
