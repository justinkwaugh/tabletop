import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { GoodsDraw, drawTradeGoods } from '../model/trade.js'

export type DrawTradeGoodsMetadata = Type.Static<typeof DrawTradeGoodsMetadata>
export const DrawTradeGoodsMetadata = Type.Object({
    draws: Type.Array(GoodsDraw)
})

export type DrawTradeGoods = Type.Static<typeof DrawTradeGoods>
export const DrawTradeGoods = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DrawTradeGoods),
            metadata: Type.Optional(DrawTradeGoodsMetadata)
        })
    ])
)

export const DrawTradeGoodsValidator = Compile(DrawTradeGoods)

export function isDrawTradeGoods(action?: GameAction): action is DrawTradeGoods {
    return action?.type === ActionType.DrawTradeGoods
}

export class HydratedDrawTradeGoods
    extends HydratableAction<typeof DrawTradeGoods>
    implements DrawTradeGoods
{
    declare type: ActionType.DrawTradeGoods
    declare metadata?: DrawTradeGoodsMetadata

    constructor(data: DrawTradeGoods) {
        super(data, DrawTradeGoodsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { draws: drawTradeGoods(state) }
    }
}
