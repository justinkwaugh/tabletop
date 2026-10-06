import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { AuctionResult, HydratedMarracashGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type ResolveAuction = Type.Static<typeof ResolveAuction>
export const ResolveAuction = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveAuction),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(AuctionResult)
        })
    ])
)

export const ResolveAuctionValidator = Compile(ResolveAuction)

export function isResolveAuction(action?: GameAction): action is ResolveAuction {
    return action?.type === ActionType.ResolveAuction
}

export class HydratedResolveAuction
    extends HydratableAction<typeof ResolveAuction>
    implements ResolveAuction
{
    declare type: ActionType.ResolveAuction
    declare revealsInfo: true
    declare metadata?: AuctionResult

    constructor(data: ResolveAuction) {
        super(data, ResolveAuctionValidator)
    }

    apply(state: HydratedMarracashGameState) {
        this.metadata = state.resolveAuction()
    }
}
