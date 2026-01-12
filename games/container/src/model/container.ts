import { Type, type Static } from 'typebox'

export enum ContainerColor {
    Purple = 'purple',
    Brown = 'brown',
    Blue = 'blue',
    Red = 'red',
    Green = 'green'
}

export type Container = Static<typeof Container>
export const Container = Type.Object({
    color: Type.Enum(ContainerColor)
})

export type PricedContainer = Static<typeof PricedContainer>
export const PricedContainer = Type.Object({
    color: Type.Enum(ContainerColor),
    price: Type.Number()
})

export type ShipLocation = Static<typeof ShipLocation>
export const ShipLocation = Type.Union([
    Type.Object({ type: Type.Literal('open_sea') }),
    Type.Object({ type: Type.Literal('foreign_island') }),
    Type.Object({ type: Type.Literal('harbor'), ownerId: Type.String() }),
    Type.Object({ type: Type.Literal('investment_bank') })
])
