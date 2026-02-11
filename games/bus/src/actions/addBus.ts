import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type AddBusMetadata = Type.Static<typeof AddBusMetadata>
export const AddBusMetadata = Type.Object({
    newBusAmount: Type.Number()
})

export type AddBus = Type.Static<typeof AddBus>
export const AddBus = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.AddBus), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(AddBusMetadata) // Always optional, because it is an output
        })
    ])
)

export const AddBusValidator = Compile(AddBus)

export function isAddBus(action?: GameAction): action is AddBus {
    return action?.type === ActionType.AddBus
}

export class HydratedAddBus extends HydratableAction<typeof AddBus> implements AddBus {
    declare type: ActionType.AddBus
    declare playerId: string
    declare metadata?: AddBusMetadata

    constructor(data: AddBus) {
        super(data, AddBusValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidAddBus(state)) {
            throw Error('Invalid AddBus action')
        }

        console.log('Applying AddBus action for player', this.playerId)
        const playerState = state.getPlayerState(this.playerId)
        playerState.buses += 1

        this.metadata = { newBusAmount: playerState.buses }
    }

    isValidAddBus(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return playerState.buses < 5
    }

    static canAddBus(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return playerState.buses < 5
    }
}
