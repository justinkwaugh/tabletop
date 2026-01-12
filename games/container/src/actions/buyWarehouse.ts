import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'

export type BuyWarehouse = Static<typeof BuyWarehouse>
export const BuyWarehouse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyWarehouse),
            playerId: Type.String()
        })
    ])
)

export const BuyWarehouseValidator = Compile(BuyWarehouse)

export function isBuyWarehouse(action: GameAction): action is BuyWarehouse {
    return action.type === ActionType.BuyWarehouse
}

export class HydratedBuyWarehouse
    extends HydratableAction<typeof BuyWarehouse>
    implements BuyWarehouse
{
    declare type: ActionType.BuyWarehouse
    declare playerId: string

    constructor(data: BuyWarehouse) {
        super(data, BuyWarehouseValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const player = state.getPlayerState(this.playerId)
        assert(player.warehouses < 5, 'No warehouse slots remaining')
        assert(state.supply.warehouses > 0, 'No warehouses available')

        const cost = state.getWarehouseCost(player.warehouses)
        assert(player.money >= cost, 'Not enough money to buy warehouse')

        player.money -= cost
        player.warehouses += 1
        state.supply.warehouses -= 1
    }

    static canBuy(state: HydratedContainerGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        if (player.warehouses >= 5 || state.supply.warehouses <= 0) {
            return false
        }
        const cost = state.getWarehouseCost(player.warehouses)
        return player.money >= cost
    }
}
