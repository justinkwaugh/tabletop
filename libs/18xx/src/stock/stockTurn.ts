import * as Type from 'typebox'

export const StockTurn = Type.Object(
    {
        bought: Type.Boolean(),
        soldBeforeBuying: Type.Boolean(),
        companiesSold: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type StockTurn = Type.Static<typeof StockTurn>
