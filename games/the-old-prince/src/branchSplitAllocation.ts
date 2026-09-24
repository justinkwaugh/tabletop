import * as Type from 'typebox'
import { CashPayment, Owner } from '@tabletop/18xx'

export const BranchSplitAllocation = Type.Object(
    {
        stationIds: Type.Array(Type.String(), { minItems: 1, uniqueItems: true, default: [''] }),
        homeStationId: Type.String(),
        trainIds: Type.Array(Type.String(), { uniqueItems: true, default: [] }),
        cash: Type.Integer({ minimum: 0 }),
        hunslet: Type.Boolean()
    },
    { additionalProperties: false }
)
export type BranchSplitAllocation = Type.Static<typeof BranchSplitAllocation>
export const BranchSplitSettlement = Type.Object(
    {
        childFunding: Type.Integer({ minimum: 0 }),
        certificateTransfers: Type.Array(
            Type.Object(
                {
                    certificateId: Type.String(),
                    owner: Owner,
                    poolId: Type.Optional(Type.String())
                },
                { additionalProperties: false }
            )
        ),
        stationReplacements: Type.Array(
            Type.Object(
                {
                    parentStationId: Type.String(),
                    childStationId: Type.String()
                },
                { additionalProperties: false }
            )
        ),
        payments: Type.Array(CashPayment)
    },
    { additionalProperties: false }
)
export type BranchSplitSettlement = Type.Static<typeof BranchSplitSettlement>
