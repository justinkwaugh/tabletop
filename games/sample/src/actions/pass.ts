import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSampleGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// Define the shape of the Pass action based on GameAction
export type Pass = Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Pass), // This action is always this type
            playerId: Type.String() // Required now
        })
    ])
)

// All hydrated classes need a validator to validate the raw action data before hydration
export const PassValidator = Compile(Pass)

// Type guard to check if a GameAction is a PassAction.  Useful for narrowing types.
export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

// Hydrated version of the Pass which has methods to apply the action to the game state
export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    // The properties are declared here to satisfy the interface, but are populated by the HydratableAction base class
    // They cannot be initialized in the constructor directly because the base class needs to process the input data first
    declare type: ActionType.Pass
    declare playerId: string
    declare amount: number

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    // This method applies the action to the game state, it's also given a context which can provide additional information
    // such as the game config, and can be used to add more actions as a result of this action
    apply(state: HydratedSampleGameState, context?: MachineContext) {
        if (!this.isValidPass(state)) {
            throw Error('Invalid pass action')
        }

        // Passing is a no-op in this example
    }

    isValidPass(state: HydratedSampleGameState): boolean {
        return true // You can always pass
    }

    static canPass(state: HydratedSampleGameState, playerId: string): boolean {
        return true // Anyone can always pass
    }
}
