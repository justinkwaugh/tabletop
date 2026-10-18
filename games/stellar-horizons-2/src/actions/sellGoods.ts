import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { TradeGood } from '../components/tradeGoods.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { GoodsCount, SaleResult, saleProblem, sellGoods } from '../model/trade.js'

export type SellGoods = Type.Static<typeof SellGoods>
export const SellGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SellGoods),
            playerId: Type.String(),
            systemId: Type.String(),
            good: Type.Enum(TradeGood),
            sources: Type.Array(GoodsCount),
            payeeId: Type.Optional(Type.String()),
            metadata: Type.Optional(SaleResult)
        })
    ])
)

export const SellGoodsValidator = Compile(SellGoods)

export function isSellGoods(action?: GameAction): action is SellGoods {
    return action?.type === ActionType.SellGoods
}

export class HydratedSellGoods extends HydratableAction<typeof SellGoods> implements SellGoods {
    declare type: ActionType.SellGoods
    declare playerId: string
    declare systemId: string
    declare good: TradeGood
    declare sources: GoodsCount[]
    declare payeeId?: string
    declare metadata?: SaleResult

    constructor(data: SellGoods) {
        super(data, SellGoodsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (saleProblem(state, this.playerId, this) !== undefined) {
            throw Error('Invalid SellGoods action')
        }
        this.metadata = sellGoods(state, this.playerId, this)
    }
}
