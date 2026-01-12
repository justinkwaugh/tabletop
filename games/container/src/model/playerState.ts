import { Hydratable, PlayerState, type Color } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ContainerColor, PricedContainer, ShipLocation } from './container.js'
import { ContainerValueCard } from './valueCard.js'

export type Ship = Static<typeof Ship>
export const Ship = Type.Object({
    location: ShipLocation,
    cargo: Type.Array(Type.Enum(ContainerColor))
})

export type ContainerPlayerState = Static<typeof ContainerPlayerState>
export const ContainerPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Number(),
            loans: Type.Number(),
            score: Type.Number(),
            machines: Type.Array(Type.Enum(ContainerColor)),
            warehouses: Type.Number(),
            factoryStore: Type.Array(PricedContainer),
            harborStore: Type.Array(PricedContainer),
            ship: Ship,
            island: Type.Array(Type.Enum(ContainerColor)),
            valueCard: ContainerValueCard
        })
    ])
)

export const ContainerPlayerStateValidator = Compile(ContainerPlayerState)

export class HydratedContainerPlayerState
    extends Hydratable<typeof ContainerPlayerState>
    implements ContainerPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare loans: number
    declare score: number
    declare machines: ContainerColor[]
    declare warehouses: number
    declare factoryStore: PricedContainer[]
    declare harborStore: PricedContainer[]
    declare ship: Ship
    declare island: ContainerColor[]
    declare valueCard: ContainerValueCard

    constructor(data: ContainerPlayerState) {
        super(data, ContainerPlayerStateValidator)
    }

    factoryCapacity(): number {
        return this.machines.length * 2
    }

    harborCapacity(): number {
        return this.warehouses
    }

    canAfford(amount: number): boolean {
        return this.money >= amount
    }
}
