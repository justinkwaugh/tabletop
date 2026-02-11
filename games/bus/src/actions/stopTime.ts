import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type StopTimeMetadata = Type.Static<typeof StopTimeMetadata>
export const StopTimeMetadata = Type.Object({})

export type StopTime = Type.Static<typeof StopTime>
export const StopTime = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.StopTime), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(StopTimeMetadata) // Always optional, because it is an output
        })
    ])
)

export const StopTimeValidator = Compile(StopTime)

export function isStopTime(action?: GameAction): action is StopTime {
    return action?.type === ActionType.StopTime
}

export class HydratedStopTime extends HydratableAction<typeof StopTime> implements StopTime {
    declare type: ActionType.StopTime
    declare playerId: string
    declare metadata?: StopTimeMetadata

    constructor(data: StopTime) {
        super(data, StopTimeValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidStopTime(state)) {
            throw Error('Invalid StopTime action')
        }

        const playerState = state.getPlayerState(this.playerId)
        playerState.stones += 1

        this.metadata = {}
    }

    isValidStopTime(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canStopTime(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
