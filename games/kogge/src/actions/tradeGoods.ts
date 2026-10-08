import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { GoodCounts, addGoods, removeGoods } from '../components/goods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type TradeGoods = Type.Static<typeof TradeGoods>
export const TradeGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TradeGoods),
            playerId: Type.String(),
            give: GoodCounts,
            take: GoodCounts
        })
    ])
)

export const TradeGoodsValidator = Compile(TradeGoods)

export function isTradeGoods(action?: GameAction): action is TradeGoods {
    return action?.type === ActionType.TradeGoods
}

export class HydratedTradeGoods extends HydratableAction<typeof TradeGoods> implements TradeGoods {
    declare type: ActionType.TradeGoods
    declare playerId: string
    declare give: GoodCounts
    declare take: GoodCounts

    constructor(data: TradeGoods) {
        super(data, TradeGoodsValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.isValidTrade(this.playerId, this.give, this.take)) {
            throw Error('Invalid TradeGoods action')
        }
        const player = state.getPlayerState(this.playerId)
        const city = state.city(player.location())
        removeGoods(player.goods, this.give)
        addGoods(city.goods, this.give)
        removeGoods(city.goods, this.take)
        addGoods(player.goods, this.take)
        state.recordTurnAction(this.playerId, TurnAction.TradeGoods)
    }

    static canTradeGoods(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.canTradeGoods(playerId)
    }
}
