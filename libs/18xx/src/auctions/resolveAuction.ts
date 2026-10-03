import { AuctionAwardDetails, AuctionAwardRecorder } from './auctionAwardDetails.js'
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

const Resolution = Type.Union([
    Type.Object(
        { kind: Type.Literal('award'), award: AuctionAwardDetails },
        { additionalProperties: false }
    ),
    Type.Object(
        { kind: Type.Literal('open-bidding'), lotId: Type.String() },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Union([
                Type.Literal('discount'),
                Type.Literal('income'),
                Type.Literal('complete')
            ])
        },
        { additionalProperties: false }
    )
])
const ResolveFields = Type.Object({
    type: Type.Literal('ResolveAuction'),
    metadata: Type.Optional(Resolution)
})
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
    declare metadata?: ResolveAuction['metadata']

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
        const recorder = new AuctionAwardRecorder(state)
        const resolution = model instanceof OfferAuction ? model.resolve() : model.resolve(this.id)
        this.metadata =
            resolution.kind === 'award'
                ? { kind: 'award', award: recorder.award(state, resolution.award) }
                : resolution
        if (resolution.kind === 'complete') {
            if (model instanceof OfferAuction)
                startFirstStockRound(state, model.rules.firstStockOrder(state))
            else {
                state.turnManager.newFirstPlayer(model.auction.nextPlayerId)
                startFirstStockRound(state, state.turnManager.turnOrder)
            }
        }
    }
}
