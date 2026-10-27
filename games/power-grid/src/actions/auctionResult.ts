import * as Type from 'typebox'

export type AuctionResult = Type.Static<typeof AuctionResult>
export const AuctionResult = Type.Object({
    plant: Type.Integer(),
    withdrawn: Type.Array(Type.String()),
    winner: Type.Optional(Type.Object({ playerId: Type.String(), amount: Type.Integer() }))
})
