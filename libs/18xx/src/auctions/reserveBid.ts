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

export const ReserveBid = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ReserveBid'),
        lotId: Type.String(),
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type ReserveBid = Type.Static<typeof ReserveBid>
const ReserveBidValidator = Compile(ReserveBid)
export function isReserveBid(action: GameAction): action is ReserveBid {
    return (
        action instanceof HydratedReserveBid ||
        (action.type === 'ReserveBid' && ReserveBidValidator.Check(action))
    )
}
export class HydratedReserveBid extends HydratableAction<typeof ReserveBid> implements ReserveBid {
    declare type: 'ReserveBid'
    declare playerId: string
    declare lotId: string
    declare amount: number
    readonly #rules: WaterfallAuctionRules
    constructor(data: ReserveBid, rules: WaterfallAuctionRules) {
        super(data instanceof HydratedReserveBid ? data.dehydrate() : data, ReserveBidValidator)
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            canActInAuction(state, model, this.playerId) &&
            !model.auction.bidding &&
            model.canBid(this.playerId, this.lotId, this.amount)
        )
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid ReserveBid action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        model.bid(this.playerId, this.lotId, this.amount)
    }
}
