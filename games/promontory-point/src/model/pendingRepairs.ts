import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { RailroadIdSchema } from './schemas.js'

// R-4.3, R-4.3-H1: the bill fixed when the tile was reached.
export type Debtor = Type.Static<typeof Debtor>
export const Debtor = Type.Object({
    playerId: Type.String(),
    owed: Type.Integer({ minimum: 1 })
})

export type PendingRepairs = Type.Static<typeof PendingRepairs>
export const PendingRepairs = Type.Object({
    railroadId: RailroadIdSchema,
    // R-4.3-H4: in deciding order; the first debtor decides.
    debtors: Type.Array(Debtor, { minItems: 1 })
})

// R-4.3-H4: the debtor at the head of the queue decides.
export function firstDebtor(pendingRepairs: PendingRepairs): Debtor {
    const debtor = pendingRepairs.debtors[0]
    assertExists(debtor, 'A pending Repairs has a debtor')
    return debtor
}
