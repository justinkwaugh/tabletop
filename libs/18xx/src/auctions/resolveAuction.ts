import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import {
    activeAuction,
    type OpeningAuctionState,
    type OpeningAuctionRules
} from './auctionProcedure.js'
import { OfferAuction } from './offerPileAuction.js'
import { startFirstStockRound } from './startFirstStockRound.js'

const ResolveFields = Type.Object({ type: Type.Literal('ResolveAuction') })
export const ResolveAuction: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof ResolveFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ResolveFields.properties },
    { additionalProperties: false }
)
export type ResolveAuction = Type.Static<typeof ResolveAuction>
const ResolveAuctionValidator = Compile(ResolveAuction)
export function isResolveAuction(action: GameAction): action is ResolveAuction {
    return (
        action instanceof HydratedResolveAuction ||
        (action.type === 'ResolveAuction' && ResolveAuctionValidator.Check(action))
    )
}
export class HydratedResolveAuction
    extends HydratableAction<typeof ResolveAuction>
    implements ResolveAuction
{
    declare type: 'ResolveAuction'

    readonly #rules: OpeningAuctionRules
    constructor(data: ResolveAuction, rules: OpeningAuctionRules) {
        super(
            data instanceof HydratedResolveAuction ? data.dehydrate() : data,
            ResolveAuctionValidator
        )
        this.#rules = rules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return !!model && this.source === ActionSource.System && !!model.resolution()
    }
    apply(state: HydratedGameState & OpeningAuctionState): void {
        assert(this.isValid(state), 'Invalid ResolveAuction action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        if (model instanceof OfferAuction) {
            if (model.resolve().kind === 'complete')
                startFirstStockRound(state, model.rules.firstStockOrder(state))
        } else if (model.resolve(this.id).kind === 'complete') {
            state.turnManager.newFirstPlayer(model.auction.nextPlayerId)
            startFirstStockRound(state, state.turnManager.turnOrder)
        }
    }
}
