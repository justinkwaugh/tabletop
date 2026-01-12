import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { ShipLocation } from '../model/container.js'

export type SailShip = Static<typeof SailShip>
export const SailShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SailShip),
            playerId: Type.String(),
            destination: ShipLocation,
            purchaseIndices: Type.Optional(Type.Array(Type.Number())),
            pickupIndices: Type.Optional(Type.Array(Type.Number()))
        })
    ])
)

export const SailShipValidator = Compile(SailShip)

export function isSailShip(action: GameAction): action is SailShip {
    return action.type === ActionType.SailShip
}

export class HydratedSailShip extends HydratableAction<typeof SailShip> implements SailShip {
    declare type: ActionType.SailShip
    declare playerId: string
    declare destination: ShipLocation
    declare purchaseIndices?: number[]
    declare pickupIndices?: number[]

    constructor(data: SailShip) {
        super(data, SailShipValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const player = state.getPlayerState(this.playerId)
        const ship = player.ship

        switch (ship.location.type) {
            case 'open_sea': {
                assert(this.destination.type !== 'open_sea', 'Must move to a new area')
                if (this.destination.type === 'harbor') {
                    assert(
                        this.destination.ownerId !== this.playerId,
                        'Cannot move to own harbor'
                    )
                }
                if (this.destination.type === 'investment_bank') {
                    assert(state.investmentBank, 'Investment Bank not enabled')
                }
                break
            }
            case 'harbor': {
                assert(this.destination.type === 'open_sea', 'Must move to open sea first')
                break
            }
            case 'foreign_island': {
                assert(this.destination.type === 'open_sea', 'Must move to open sea first')
                break
            }
            case 'investment_bank': {
                assert(state.investmentBank, 'Investment Bank not enabled')
                assert(this.destination.type === 'open_sea', 'Must move to open sea first')
                break
            }
        }

        ship.location = this.destination

        if (this.destination.type === 'harbor') {
            const owner = state.getPlayerState(this.destination.ownerId)
            const purchases = this.purchaseIndices ?? []
            if (purchases.length === 0) {
                return
            }

            const uniquePurchases = new Set(purchases)
            assert(uniquePurchases.size === purchases.length, 'Duplicate purchase indices')

            const maxIndex = owner.harborStore.length - 1
            for (const index of purchases) {
                assert(index >= 0 && index <= maxIndex, 'Purchase index out of bounds')
            }

            const capacity = state.shipCapacity() - ship.cargo.length
            assert(purchases.length <= capacity, 'Not enough ship capacity')

            const purchaseList = purchases.map((index) => owner.harborStore[index])
            const totalCost = purchaseList.reduce((sum, entry) => sum + entry.price, 0)
            assert(player.money >= totalCost, 'Not enough money to buy containers')

            player.money -= totalCost
            owner.money += totalCost

            const sorted = [...purchases].sort((a, b) => b - a)
            for (const index of sorted) {
                owner.harborStore.splice(index, 1)
            }

            ship.cargo.push(...purchaseList.map((entry) => entry.color))
            return
        }

        if (this.destination.type === 'investment_bank') {
            const bank = state.investmentBank
            assert(bank, 'Investment Bank not enabled')

            const personalHarbor = bank.personalHarbors[this.playerId] ?? []
            bank.personalHarbors[this.playerId] = personalHarbor
            const pickups = this.pickupIndices ?? []
            if (pickups.length === 0) {
                return
            }

            const uniquePickups = new Set(pickups)
            assert(uniquePickups.size === pickups.length, 'Duplicate pickup indices')

            const maxIndex = personalHarbor.length - 1
            for (const index of pickups) {
                assert(index >= 0 && index <= maxIndex, 'Pickup index out of bounds')
            }

            const capacity = state.shipCapacity() - ship.cargo.length
            assert(pickups.length <= capacity, 'Not enough ship capacity')

            const pickupList = pickups.map((index) => personalHarbor[index])
            const sorted = [...pickups].sort((a, b) => b - a)
            for (const index of sorted) {
                personalHarbor.splice(index, 1)
            }

            ship.cargo.push(...pickupList)
        }
    }

    static canSail(state: HydratedContainerGameState, playerId: string): boolean {
        state.getPlayerState(playerId)
        return true
    }
}
