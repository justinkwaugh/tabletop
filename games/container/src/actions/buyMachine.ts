import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { ContainerColor } from '../model/container.js'
import { HydratedContainerGameState } from '../model/gameState.js'

export type BuyMachine = Static<typeof BuyMachine>
export const BuyMachine = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyMachine),
            playerId: Type.String(),
            color: Type.Enum(ContainerColor)
        })
    ])
)

export const BuyMachineValidator = Compile(BuyMachine)

export function isBuyMachine(action: GameAction): action is BuyMachine {
    return action.type === ActionType.BuyMachine
}

export class HydratedBuyMachine
    extends HydratableAction<typeof BuyMachine>
    implements BuyMachine
{
    declare type: ActionType.BuyMachine
    declare playerId: string
    declare color: ContainerColor

    constructor(data: BuyMachine) {
        super(data, BuyMachineValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const player = state.getPlayerState(this.playerId)
        assert(player.machines.length < 4, 'No machine slots remaining')
        assert(!player.machines.includes(this.color), 'Machine color already owned')
        assert(state.supply.machines[this.color] > 0, 'Machine color not available')

        const cost = state.getMachineCost(player.machines.length)
        assert(player.money >= cost, 'Not enough money to buy machine')

        player.money -= cost
        player.machines.push(this.color)
        state.supply.machines[this.color] -= 1
    }

    static canBuy(state: HydratedContainerGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        if (player.machines.length >= 4) {
            return false
        }
        const availableColor = Object.entries(state.supply.machines).some(
            ([color, count]) => count > 0 && !player.machines.includes(color as ContainerColor)
        )
        if (!availableColor) {
            return false
        }
        const cost = state.getMachineCost(player.machines.length)
        return player.money >= cost
    }
}
