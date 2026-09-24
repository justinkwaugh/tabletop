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

export const OfferAuctionLot = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('OfferAuctionLot'), lotId: Type.String() },
    { additionalProperties: false }
)
export type OfferAuctionLot = Type.Static<typeof OfferAuctionLot>
const OfferAuctionLotValidator = Compile(OfferAuctionLot)
export function isOfferAuctionLot(action: GameAction): action is OfferAuctionLot {
    return (
        action instanceof HydratedOfferAuctionLot ||
        (action.type === 'OfferAuctionLot' && OfferAuctionLotValidator.Check(action))
    )
}
export class HydratedOfferAuctionLot
    extends HydratableAction<typeof OfferAuctionLot>
    implements OfferAuctionLot
{
    declare type: 'OfferAuctionLot'
    declare playerId: string
    declare lotId: string
    readonly #rules: OfferPileAuctionRules
    constructor(data: OfferAuctionLot, rules: OfferPileAuctionRules) {
        super(
            data instanceof HydratedOfferAuctionLot ? data.dehydrate() : data,
            OfferAuctionLotValidator
        )
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return (
            !!model &&
            (this.source === ActionSource.User ||
                (this.source === ActionSource.System && model.autoOfferLotId === this.lotId)) &&
            canActInAuction(state, model, this.playerId) &&
            model.canOffer(this.playerId, this.lotId)
        )
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid OfferAuctionLot action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        model.offer(this.playerId, this.lotId, this.id)
    }
}
