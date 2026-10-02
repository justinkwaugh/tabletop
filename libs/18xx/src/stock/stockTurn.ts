import * as Type from 'typebox'
import { Owner } from '../finance/finance.js'

export const StockTurn = Type.Object(
    {
        acted: Type.Boolean(),
        bought: Type.Boolean(),
        soldBeforeBuying: Type.Boolean(),
        companiesSold: Type.Array(Type.String()),
        corporateAction: Type.Optional(
            Type.Object(
                { companyId: Type.String(), boughtBack: Type.Optional(Type.Literal(true)) },
                { additionalProperties: false }
            )
        ),
        saleBlocks: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        id: Type.String(),
                        companyId: Type.String(),
                        seller: Owner,
                        shares: Type.Integer({ minimum: 1 }),
                        price: Type.Integer({ minimum: 1 }),
                        movement: Type.Integer({ minimum: 0 }),
                        direction: Type.String()
                    },
                    { additionalProperties: false }
                )
            )
        )
    },
    { additionalProperties: false }
)
export type StockTurn = Type.Static<typeof StockTurn>
