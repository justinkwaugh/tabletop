import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type VroomMetadata = Type.Static<typeof VroomMetadata>
export const VroomMetadata = Type.Object({
})

export type Vroom = Type.Static<typeof Vroom>
export const Vroom = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Vroom), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(VroomMetadata) // Always optional, because it is an output
        })
    ])
)

export const VroomValidator = Compile(Vroom)

export function isVroom(action?: GameAction): action is Vroom {
    return action?.type === ActionType.Vroom
}

export class HydratedVroom extends HydratableAction<typeof Vroom> implements Vroom {
    declare type: ActionType.Vroom
    declare playerId: string
    declare metadata?: VroomMetadata

    constructor(data: Vroom) {
        super(data, VroomValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidVroom(state)) {
            throw Error('Invalid Vroom action')
        }

        this.metadata = {}
    }

    isValidVroom(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canVroom(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
