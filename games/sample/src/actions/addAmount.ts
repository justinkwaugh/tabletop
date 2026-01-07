import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSampleGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// Metadata can be used to store additional information about the action, generally for logging or UI purposes
// It tends to be output of the action, and is often denormalized data from the game state at the time of the action
// This allows for display and logging without needing to reference the game state at the time of action execution
export type AddAmountMetadata = Static<typeof AddAmountMetadata>
export const AddAmountMetadata = Type.Object({
    priorTotal: Type.Number(),
    newTotal: Type.Number()
})

// Define the shape of the AddAmount based on GameAction
export type AddAmount = Static<typeof AddAmount>
export const AddAmount = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.AddAmount), // This action is always this type
            playerId: Type.String(), // Required now
            amount: Type.Number(), // Some input data specific to this action
            metadata: Type.Optional(AddAmountMetadata) // Always optional, because it is an output
        })
    ])
)

// All hydrated classes need a validator to validate the raw action data before hydration
// It's reasonable to compile it once and reuse it
export const AddAmountValidator = Compile(AddAmount)

// Type guard to check if a GameAction is a AddAmount.  Useful for narrowing types.
export function isAddAmount(action?: GameAction): action is AddAmount {
    return action?.type === ActionType.AddAmount
}

// Hydrated version of the AddAmount which has methods to apply the action to the game state
export class HydratedAddAmount extends HydratableAction<typeof AddAmount> implements AddAmount {
    // The properties are declared here to satisfy the interface, but are populated by the HydratableAction base class
    // They cannot be initialized in the constructor directly because the base class needs to process the input data first
    declare type: ActionType.AddAmount
    declare playerId: string
    declare amount: number
    declare metadata?: AddAmountMetadata

    constructor(data: AddAmount) {
        super(data, AddAmountValidator)
    }

    // This method applies the action to the game state, it's also given a context which can provide additional information
    // such as the game config, and can be used to add more actions as a result of this action
    apply(state: HydratedSampleGameState, context?: MachineContext) {
        if (!this.isValidAddAmount(state)) {
            throw Error('Invalid add amount action')
        }

        const priorTotal = state.total
        state.addToTotal(this.amount)

        // Populate metadata as an example of output and relevant state data
        this.metadata = {
            priorTotal,
            newTotal: state.total
        }
    }

    // Generally it is good to have a validation method to make sure the specific constraints of the action are met
    isValidAddAmount(state: HydratedSampleGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        if (!playerState) {
            return false
        }

        return (
            this.amount > 0 && playerState.amount >= this.amount && state.canAddToTotal(this.amount)
        )
    }

    // Generally it is useful to have a static method here to check if the action can be performed by a specific player.
    // This can be used by the UI to enable/disable things, and by the state handlers to produce a set of valid actions
    // for the given player in that state.
    static canDoAddAmount(state: HydratedSampleGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (!playerState) {
            return false
        }
        // In this example, any player can do the action if they have at least an amount of 1 and the state allows it
        return playerState.amount > 0 && state.canAddToTotal(1)
    }
}
