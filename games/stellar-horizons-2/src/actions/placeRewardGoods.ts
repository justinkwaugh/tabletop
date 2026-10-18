import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import {
    GoodsCount,
    RewardGoodsResult,
    goodsRewardProblem,
    placeRewardGoods
} from '../model/trade.js'

export type PlaceRewardGoods = Type.Static<typeof PlaceRewardGoods>
export const PlaceRewardGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceRewardGoods),
            playerId: Type.String(),
            placements: Type.Array(GoodsCount),
            metadata: Type.Optional(RewardGoodsResult)
        })
    ])
)

export const PlaceRewardGoodsValidator = Compile(PlaceRewardGoods)

export function isPlaceRewardGoods(action?: GameAction): action is PlaceRewardGoods {
    return action?.type === ActionType.PlaceRewardGoods
}

// Goods the Player does not place are destroyed for $1B each.
export class HydratedPlaceRewardGoods
    extends HydratableAction<typeof PlaceRewardGoods>
    implements PlaceRewardGoods
{
    declare type: ActionType.PlaceRewardGoods
    declare playerId: string
    declare placements: GoodsCount[]
    declare metadata?: RewardGoodsResult

    constructor(data: PlaceRewardGoods) {
        super(data, PlaceRewardGoodsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.goodsRewards.at(0)?.playerId !== this.playerId ||
            goodsRewardProblem(state, this.placements) !== undefined
        ) {
            throw Error('Invalid PlaceRewardGoods action')
        }
        this.metadata = placeRewardGoods(state, this.placements)
    }
}
