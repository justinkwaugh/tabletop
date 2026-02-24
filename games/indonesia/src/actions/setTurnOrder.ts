import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SetTurnOrderMetadata = Type.Static<typeof SetTurnOrderMetadata>
export const SetTurnOrderMetadata = Type.Object({
})

export type SetTurnOrder = Type.Static<typeof SetTurnOrder>
export const SetTurnOrder = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.SetTurnOrder), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(SetTurnOrderMetadata) // Always optional, because it is an output
        })
    ])
)

export const SetTurnOrderValidator = Compile(SetTurnOrder)

export function isSetTurnOrder(action?: GameAction): action is SetTurnOrder {
    return action?.type === ActionType.SetTurnOrder
}

export class HydratedSetTurnOrder extends HydratableAction<typeof SetTurnOrder> implements SetTurnOrder {
    declare type: ActionType.SetTurnOrder
    declare playerId: string
    declare metadata?: SetTurnOrderMetadata

    constructor(data: SetTurnOrder) {
        super(data, SetTurnOrderValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidSetTurnOrder(state)) {
            throw Error('Invalid SetTurnOrder action')
        }

        this.metadata = {}
    }

    isValidSetTurnOrder(state: HydratedIndonesiaGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canSetTurnOrder(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
