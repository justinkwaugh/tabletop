import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceBusLineMetadata = Type.Static<typeof PlaceBusLineMetadata>
export const PlaceBusLineMetadata = Type.Object({})

export type PlaceBusLine = Type.Static<typeof PlaceBusLine>
export const PlaceBusLine = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceBusLine), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PlaceBusLineMetadata), // Always optional, because it is an output
            segment: Type.Tuple([Type.String(), Type.String()]) // The two building sites that the player wants to connect with a bus line
        })
    ])
)

export const PlaceBusLineValidator = Compile(PlaceBusLine)

export function isPlaceBusLine(action?: GameAction): action is PlaceBusLine {
    return action?.type === ActionType.PlaceBusLine
}

export class HydratedPlaceBusLine
    extends HydratableAction<typeof PlaceBusLine>
    implements PlaceBusLine
{
    declare type: ActionType.PlaceBusLine
    declare playerId: string
    declare metadata?: PlaceBusLineMetadata
    declare segment: [string, string]

    constructor(data: PlaceBusLine) {
        super(data, PlaceBusLineValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidPlaceBusLine(state)) {
            throw Error('Invalid PlaceBusLine action')
        }

        this.metadata = {}
    }

    isValidPlaceBusLine(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canPlaceBusLine(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
