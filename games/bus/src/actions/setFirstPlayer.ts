import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SetFirstPlayerMetadata = Type.Static<typeof SetFirstPlayerMetadata>
export const SetFirstPlayerMetadata = Type.Object({})

export type SetFirstPlayer = Type.Static<typeof SetFirstPlayer>
export const SetFirstPlayer = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.SetFirstPlayer), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(SetFirstPlayerMetadata) // Always optional, because it is an output
        })
    ])
)

export const SetFirstPlayerValidator = Compile(SetFirstPlayer)

export function isSetFirstPlayer(action?: GameAction): action is SetFirstPlayer {
    return action?.type === ActionType.SetFirstPlayer
}

export class HydratedSetFirstPlayer
    extends HydratableAction<typeof SetFirstPlayer>
    implements SetFirstPlayer
{
    declare type: ActionType.SetFirstPlayer
    declare playerId: string
    declare metadata?: SetFirstPlayerMetadata

    constructor(data: SetFirstPlayer) {
        super(data, SetFirstPlayerValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidSetFirstPlayer(state)) {
            throw Error('Invalid SetFirstPlayer action')
        }
        state.turnManager.newFirstPlayer(this.playerId)
        this.metadata = {}
    }

    isValidSetFirstPlayer(state: HydratedBusGameState): boolean {
        return true
    }

    static canSetFirstPlayer(state: HydratedBusGameState, playerId: string): boolean {
        return true
    }
}
