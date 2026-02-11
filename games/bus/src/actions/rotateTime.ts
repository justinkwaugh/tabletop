import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BuildingType } from 'src/components/building.js'

export type RotateTimeMetadata = Type.Static<typeof RotateTimeMetadata>
export const RotateTimeMetadata = Type.Object({})

export type RotateTime = Type.Static<typeof RotateTime>
export const RotateTime = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.RotateTime), // This action is always this type
            source: Type.Literal(ActionSource.System), // This action is always from the system
            metadata: Type.Optional(RotateTimeMetadata) // Always optional, because it is an output
        })
    ])
)

export const RotateTimeValidator = Compile(RotateTime)

export function isRotateTime(action?: GameAction): action is RotateTime {
    return action?.type === ActionType.RotateTime
}

export class HydratedRotateTime extends HydratableAction<typeof RotateTime> implements RotateTime {
    declare type: ActionType.RotateTime
    declare source: ActionSource.System
    declare metadata?: RotateTimeMetadata

    constructor(data: RotateTime) {
        super(data, RotateTimeValidator)
    }

    apply(state: HydratedBusGameState, context: MachineContext) {
        if (!this.isValidRotateTime(state)) {
            throw Error('Invalid RotateTime action')
        }

        if (state.currentLocation === BuildingType.House) {
            state.currentLocation = BuildingType.Office
        } else if (state.currentLocation === BuildingType.Office) {
            state.currentLocation = BuildingType.Pub
        } else if (state.currentLocation === BuildingType.Pub) {
            state.currentLocation = BuildingType.House
        }
    }

    isValidRotateTime(state: HydratedBusGameState): boolean {
        return true
    }

    static canRotateTime(state: HydratedBusGameState, playerId: string): boolean {
        return true
    }
}
