import { OfferAuction } from './offerPileAuction.js'
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
import {
    activeAuction,
    canActInAuction,
    type OpeningAuctionState,
    type OpeningAuctionRules
} from './auctionProcedure.js'

export const PassAuction = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('PassAuction') },
    { additionalProperties: false }
)
export type PassAuction = Type.Static<typeof PassAuction>
const PassAuctionValidator = Compile(PassAuction)
export function isPassAuction(action: GameAction): action is PassAuction {
    return (
        action instanceof HydratedPassAuction ||
        (action.type === 'PassAuction' && PassAuctionValidator.Check(action))
    )
}
export class HydratedPassAuction
    extends HydratableAction<typeof PassAuction>
    implements PassAuction
{
    declare type: 'PassAuction'
    declare playerId: string
    readonly #rules: OpeningAuctionRules
    constructor(data: PassAuction, rules: OpeningAuctionRules) {
        super(data instanceof HydratedPassAuction ? data.dehydrate() : data, PassAuctionValidator)
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return (
            !!model &&
            (this.source === ActionSource.User ||
                (this.source === ActionSource.System &&
                    model instanceof OfferAuction &&
                    model.mustPass)) &&
            canActInAuction(state, model, this.playerId) &&
            (!(model instanceof OfferAuction) || !!model.auction.bidding)
        )
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid PassAuction action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        model.pass()
    }
}
