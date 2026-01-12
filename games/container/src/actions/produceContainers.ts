import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { ContainerColor } from '../model/container.js'

export type ProduceContainers = Static<typeof ProduceContainers>
export const ProduceContainers = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ProduceContainers),
            playerId: Type.String(),
            produceColors: Type.Array(Type.Enum(ContainerColor)),
            factoryPrices: Type.Array(Type.Number())
        })
    ])
)

export const ProduceContainersValidator = Compile(ProduceContainers)

export function isProduceContainers(action: GameAction): action is ProduceContainers {
    return action.type === ActionType.ProduceContainers
}

export class HydratedProduceContainers
    extends HydratableAction<typeof ProduceContainers>
    implements ProduceContainers
{
    declare type: ActionType.ProduceContainers
    declare playerId: string
    declare produceColors: ContainerColor[]
    declare factoryPrices: number[]

    constructor(data: ProduceContainers) {
        super(data, ProduceContainersValidator)
    }

    apply(state: HydratedContainerGameState): void {
        assert(!state.producedThisTurn, 'Already produced this turn')
        const player = state.getPlayerState(this.playerId)

        const availableColors = player.machines.filter(
            (color) => state.supply.containers[color] > 0
        )

        const uniqueColors = new Set(this.produceColors)
        assert(uniqueColors.size === this.produceColors.length, 'Duplicate produce colors')
        this.produceColors.forEach((color) => {
            assert(player.machines.includes(color), 'Cannot produce without machine')
            assert(state.supply.containers[color] > 0, 'Container color not available')
        })

        const reserved = state.getBrokerReservedCount(this.playerId, 'factory')
        const capacityRemaining = Math.max(
            0,
            player.factoryCapacity() - player.factoryStore.length - reserved
        )
        const maxProduce = Math.min(availableColors.length, capacityRemaining)
        assert(
            this.produceColors.length === maxProduce,
            'Must produce the maximum possible containers'
        )

        const unionBossId = state.getRightNeighborId(this.playerId)
        const unionBoss = state.getPlayerState(unionBossId)
        assert(player.money >= 1, 'Not enough money to pay union boss')
        player.money -= 1
        unionBoss.money += 1

        for (const color of this.produceColors) {
            state.supply.containers[color] -= 1
            player.factoryStore.push({ color, price: 1 })
        }

        assert(
            this.factoryPrices.length === player.factoryStore.length,
            'Factory prices do not match store size'
        )

        player.factoryStore.forEach((entry, index) => {
            const price = this.factoryPrices[index]
            assert(price >= 1 && price <= 4, 'Factory price out of range')
            entry.price = price
        })

        state.producedThisTurn = true
        state.checkEndCondition()
    }

    static canProduce(state: HydratedContainerGameState, playerId: string): boolean {
        if (state.producedThisTurn) {
            return false
        }
        const player = state.getPlayerState(playerId)
        const reserved = state.getBrokerReservedCount(playerId, 'factory')
        const capacityRemaining = Math.max(
            0,
            player.factoryCapacity() - player.factoryStore.length - reserved
        )
        return capacityRemaining > 0 || player.factoryStore.length > 0
    }
}
