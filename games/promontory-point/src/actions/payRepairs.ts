import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { RailroadId } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import type { Debtor, PendingRepairs } from '../model/pendingRepairs.js'
import { RailroadIdSchema } from '../model/schemas.js'
import { SaleListRefusal, saleListRefusal, settleRepairs } from '../rules/repairs.js'

export enum PayRepairsRefusal {
    NoRepairsPending = 'NoRepairsPending',
    NotFirstDebtor = 'NotFirstDebtor'
}

// R-4.3, R-4.3-H2: one distress sale and what it raised.
export type DistressSale = Type.Static<typeof DistressSale>
export const DistressSale = Type.Object({
    railroadId: RailroadIdSchema,
    proceeds: Type.Integer({ minimum: 0 })
})

// R-4.3, R-4.3-H3: the sales in order, the amount paid and the amount forgiven.
export type PayRepairsMetadata = Type.Static<typeof PayRepairsMetadata>
export const PayRepairsMetadata = Type.Object({
    sales: Type.Array(DistressSale),
    paid: Type.Integer({ minimum: 0 }),
    forgiven: Type.Integer({ minimum: 0 })
})

export type PayRepairs = Type.Static<typeof PayRepairs>
export const PayRepairs = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PayRepairs),
            playerId: Type.String(),
            // R-4.3-H2: every share the debtor sells, in the order sold.
            sales: Type.Array(RailroadIdSchema),
            metadata: Type.Optional(PayRepairsMetadata)
        })
    ])
)

export const PayRepairsValidator = Compile(PayRepairs)

export function isPayRepairs(action?: GameAction): action is PayRepairs {
    return action?.type === ActionType.PayRepairs
}

// R-4.3, R-4.3-H1 to H4: the first debtor, whoever's turn it is, with a legal sale list.
export function payRepairsRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    sales: RailroadId[]
): PayRepairsRefusal | SaleListRefusal | undefined {
    if (state.machineState !== MachineState.PayingRepairs || state.pendingRepairs === undefined) {
        return PayRepairsRefusal.NoRepairsPending
    }
    const debtor = firstDebtor(state.pendingRepairs)
    if (playerId !== debtor.playerId) {
        return PayRepairsRefusal.NotFirstDebtor
    }
    return saleListRefusal(state.getPlayerState(playerId), debtor.owed, state.priceIndex, sales)
}

// R-4.3, R-4.3-H1, R-4.3-H2, R-4.3-H3, R-4.3-H4, R-3.2: the first debtor's one payment.
export class HydratedPayRepairs extends HydratableAction<typeof PayRepairs> implements PayRepairs {
    declare type: ActionType.PayRepairs
    declare playerId: string
    declare sales: RailroadId[]
    declare metadata?: PayRepairsMetadata

    constructor(data: PayRepairs) {
        super(data, PayRepairsValidator)
    }

    apply(state: HydratedPromontoryPointGameState, _context?: MachineContext) {
        const refusal = payRepairsRefusal(state, this.playerId, this.sales)
        if (refusal !== undefined) {
            throw new Error(`PayRepairs refused: ${refusal}`)
        }
        assertExists(state.pendingRepairs, 'A Repairs waits on its debtors')
        const debtor = firstDebtor(state.pendingRepairs)
        const player = state.getPlayerState(this.playerId)
        // R-4.3-H1: the bill stays as fixed when the tile was reached, whatever is sold.
        const { proceeds, raised, paid, forgiven } = settleRepairs(
            player,
            debtor.owed,
            state.priceIndex,
            this.sales
        )

        // R-4.3: each share returns to its deck; R-3.2: no price moves; not a trade.
        for (const railroadId of this.sales) {
            player.shares[railroadId] -= 1
        }
        // R-4.3-H3: whatever is not paid is forgiven; the seat stays in the game.
        player.money += raised - paid

        // R-4.3-H4: the next debtor decides, or the Repairs is over.
        const [, ...waiting] = state.pendingRepairs.debtors
        state.pendingRepairs =
            waiting.length > 0 ? { ...state.pendingRepairs, debtors: waiting } : undefined

        this.metadata = {
            sales: this.sales.map((railroadId, index) => ({
                railroadId,
                proceeds: proceeds[index]
            })),
            paid,
            forgiven
        }
    }

    static canPayRepairs(
        state: HydratedPromontoryPointGameState,
        playerId: string,
        sales: RailroadId[]
    ): boolean {
        return payRepairsRefusal(state, playerId, sales) === undefined
    }
}

// R-4.3-H4: the debtor at the head of the queue decides.
function firstDebtor(pendingRepairs: PendingRepairs): Debtor {
    const debtor = pendingRepairs.debtors[0]
    assertExists(debtor, 'A pending Repairs has a debtor')
    return debtor
}
