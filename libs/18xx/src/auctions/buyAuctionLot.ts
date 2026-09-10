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
import { type WaterfallAuctionRules, AuctionAward } from './waterfallAuction.js'

export const BuyAuctionLot = Type.Object(
    {
        ...PlayerAction.properties,
        lotId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 0 }),
        type: Type.Literal('BuyAuctionLot'),
        metadata: Type.Optional(AuctionAward)
    },
    { additionalProperties: false }
)
export type BuyAuctionLot = Type.Static<typeof BuyAuctionLot>
const BuyAuctionLotValidator = Compile(BuyAuctionLot)
export function isBuyAuctionLot(action: GameAction): action is BuyAuctionLot {
    return (
        action instanceof HydratedBuyAuctionLot ||
        (action.type === 'BuyAuctionLot' && BuyAuctionLotValidator.Check(action))
    )
}
export class HydratedBuyAuctionLot
    extends HydratableAction<typeof BuyAuctionLot>
    implements BuyAuctionLot
{
    declare type: 'BuyAuctionLot'
    declare playerId: string
    declare lotId: string
    declare expectedPrice: number
    declare metadata?: AuctionAward
    readonly #rules: WaterfallAuctionRules
    constructor(data: BuyAuctionLot, rules: WaterfallAuctionRules) {
        super(
            data instanceof HydratedBuyAuctionLot ? data.dehydrate() : data,
            BuyAuctionLotValidator
        )
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            canActInAuction(state, model, this.playerId) &&
            model.canPurchase(this.playerId, this.lotId) &&
            this.expectedPrice === model.price(this.lotId)
        )
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid BuyAuctionLot action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        this.metadata = model.purchase(this.playerId, this.lotId)
    }
}
