import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { type PricedContainer } from '../model/container.js'

export type BuyContainersForHarbor = Static<typeof BuyContainersForHarbor>
export const BuyContainersForHarbor = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyContainersForHarbor),
            playerId: Type.String(),
            sellerId: Type.Optional(Type.String()),
            purchaseIndices: Type.Array(Type.Number()),
            harborPrices: Type.Array(Type.Number())
        })
    ])
)

export const BuyContainersForHarborValidator = Compile(BuyContainersForHarbor)

export function isBuyContainersForHarbor(
    action: GameAction
): action is BuyContainersForHarbor {
    return action.type === ActionType.BuyContainersForHarbor
}

export class HydratedBuyContainersForHarbor
    extends HydratableAction<typeof BuyContainersForHarbor>
    implements BuyContainersForHarbor
{
    declare type: ActionType.BuyContainersForHarbor
    declare playerId: string
    declare sellerId?: string
    declare purchaseIndices: number[]
    declare harborPrices: number[]

    constructor(data: BuyContainersForHarbor) {
        super(data, BuyContainersForHarborValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const buyer = state.getPlayerState(this.playerId)

        const purchases = [...this.purchaseIndices]
        const uniquePurchases = new Set(purchases)
        assert(uniquePurchases.size === purchases.length, 'Duplicate purchase indices')

        if (purchases.length > 0) {
            assert(this.sellerId !== undefined, 'sellerId required when purchasing containers')
            assert(this.sellerId !== this.playerId, 'Cannot buy from own factory store')
            const seller = state.getPlayerState(this.sellerId)

            const maxIndex = seller.factoryStore.length - 1
            for (const index of purchases) {
                assert(index >= 0 && index <= maxIndex, 'Purchase index out of bounds')
            }

            const reserved = state.getBrokerReservedCount(this.playerId, 'harbor')
            const capacity = Math.max(0, buyer.harborCapacity() - reserved)
            assert(
                buyer.harborStore.length + purchases.length <= capacity,
                'Not enough harbor capacity'
            )

            const purchaseList = purchases.map((index) => seller.factoryStore[index])
            const totalCost = purchaseList.reduce((sum, entry) => sum + entry.price, 0)
            assert(buyer.money >= totalCost, 'Not enough money to buy containers')

            buyer.money -= totalCost
            seller.money += totalCost

            const sorted = [...purchases].sort((a, b) => b - a)
            for (const index of sorted) {
                seller.factoryStore.splice(index, 1)
            }

            const newStore: PricedContainer[] = [
                ...buyer.harborStore,
                ...purchaseList.map((entry) => ({ color: entry.color, price: entry.price }))
            ]

            assert(
                this.harborPrices.length === newStore.length,
                'Harbor prices do not match store size'
            )

            newStore.forEach((entry, index) => {
                const price = this.harborPrices[index]
                assert(price >= 2 && price <= 6, 'Harbor price out of range')
                entry.price = price
            })

            buyer.harborStore = newStore
        } else {
            assert(
                this.harborPrices.length === buyer.harborStore.length,
                'Harbor prices do not match store size'
            )
            buyer.harborStore.forEach((entry, index) => {
                const price = this.harborPrices[index]
                assert(price >= 2 && price <= 6, 'Harbor price out of range')
                entry.price = price
            })
        }
    }

    static canBuy(state: HydratedContainerGameState, playerId: string): boolean {
        const buyer = state.getPlayerState(playerId)
        const canReprice = buyer.harborStore.length > 0
        const reserved = state.getBrokerReservedCount(playerId, 'harbor')
        const capacity = Math.max(0, buyer.harborCapacity() - buyer.harborStore.length - reserved)
        const canPurchase = state.players.some((player) => {
            if (player.playerId === playerId) {
                return false
            }
            if (player.factoryStore.length === 0) {
                return false
            }
            const lowestPrice = Math.min(...player.factoryStore.map((entry) => entry.price))
            return capacity > 0 && buyer.money >= lowestPrice
        })

        return canReprice || canPurchase
    }
}
