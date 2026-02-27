import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState, TurnOrderBid } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SetTurnOrderMetadata = Type.Static<typeof SetTurnOrderMetadata>
export const SetTurnOrderMetadata = Type.Object({
    bids: Type.Record(Type.String(), TurnOrderBid), // Map of playerId to their turn order bid
    newOrder: Type.Array(Type.String()) // The new turn order, sorted by bid amount
})

export type SetTurnOrder = Type.Static<typeof SetTurnOrder>
export const SetTurnOrder = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.SetTurnOrder), // This action is always this type
            metadata: Type.Optional(SetTurnOrderMetadata) // Always optional, because it is an output
        })
    ])
)

export const SetTurnOrderValidator = Compile(SetTurnOrder)

export function isSetTurnOrder(action?: GameAction): action is SetTurnOrder {
    return action?.type === ActionType.SetTurnOrder
}

export class HydratedSetTurnOrder
    extends HydratableAction<typeof SetTurnOrder>
    implements SetTurnOrder
{
    declare type: ActionType.SetTurnOrder
    declare playerId?: string
    declare metadata?: SetTurnOrderMetadata

    constructor(data: SetTurnOrder) {
        super(data, SetTurnOrderValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidSetTurnOrder(state)) {
            throw Error('Invalid SetTurnOrder action')
        }
        assertExists(
            state.turnOrderBids,
            'turnOrderBids should be initialized when setting turn order'
        )

        // Sort players by their bid total (bid amount multiplied by multiplier), highest first, tiebreak by current turn order
        const newTurnOrder = [...state.players]
            .sort((a, b) => {
                const bidA = state.turnOrderBids?.[a.playerId]?.total ?? 0
                const bidB = state.turnOrderBids?.[b.playerId]?.total ?? 0
                if (bidA === bidB) {
                    // Tiebreak by current turn order
                    return (
                        state.turnManager.turnOrder.indexOf(a.playerId) -
                        state.turnManager.turnOrder.indexOf(b.playerId)
                    )
                }
                return bidB - bidA
            })
            .map((player) => player.playerId)

        state.turnManager.turnOrder = newTurnOrder

        this.metadata = {
            bids: structuredClone(state.turnOrderBids),
            newOrder: structuredClone(newTurnOrder)
        }
    }

    isValidSetTurnOrder(state: HydratedIndonesiaGameState): boolean {
        return Object.keys(state.turnOrderBids ?? {}).length === state.players.length
    }
}
