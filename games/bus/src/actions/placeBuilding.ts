import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceBuildingMetadata = Type.Static<typeof PlaceBuildingMetadata>
export const PlaceBuildingMetadata = Type.Object({
})

export type PlaceBuilding = Type.Static<typeof PlaceBuilding>
export const PlaceBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceBuilding), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PlaceBuildingMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceBuildingValidator = Compile(PlaceBuilding)

export function isPlaceBuilding(action?: GameAction): action is PlaceBuilding {
    return action?.type === ActionType.PlaceBuilding
}

export class HydratedPlaceBuilding extends HydratableAction<typeof PlaceBuilding> implements PlaceBuilding {
    declare type: ActionType.PlaceBuilding
    declare playerId: string
    declare metadata?: PlaceBuildingMetadata

    constructor(data: PlaceBuilding) {
        super(data, PlaceBuildingValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidPlaceBuilding(state)) {
            throw Error('Invalid PlaceBuilding action')
        }

        this.metadata = {}
    }

    isValidPlaceBuilding(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canPlaceBuilding(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
