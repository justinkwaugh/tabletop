import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { TradeGood } from '../components/tradeGoods.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { GoodsHolder, canDestroyGoods, destroyGoods } from '../model/trade.js'

export type DestroyGoods = Type.Static<typeof DestroyGoods>
export const DestroyGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DestroyGoods),
            playerId: Type.String(),
            holder: GoodsHolder,
            good: Type.Enum(TradeGood),
            count: Type.Integer()
        })
    ])
)

export const DestroyGoodsValidator = Compile(DestroyGoods)

export function isDestroyGoods(action?: GameAction): action is DestroyGoods {
    return action?.type === ActionType.DestroyGoods
}

// Rulebook 1.9: goods may be destroyed for $1B each at any time outside combat, which here
// means whenever the Player is acting.
export class HydratedDestroyGoods
    extends HydratableAction<typeof DestroyGoods>
    implements DestroyGoods
{
    declare type: ActionType.DestroyGoods
    declare playerId: string
    declare holder: GoodsHolder
    declare good: TradeGood
    declare count: number

    constructor(data: DestroyGoods) {
        super(data, DestroyGoodsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!canDestroyGoods(state, this.playerId, this.holder, this.good, this.count)) {
            throw Error('Invalid DestroyGoods action')
        }
        destroyGoods(state, this.playerId, this.holder, this.good, this.count)
    }
}
