import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Building, BuildingType } from '../components/building.js'
import { nanoid } from 'nanoid'
import { isSiteId } from '../utils/busGraph.js'
import { MachineState } from 'src/index.js'

export type PlaceBuildingMetadata = Type.Static<typeof PlaceBuildingMetadata>
export const PlaceBuildingMetadata = Type.Object({
    building: Building
})

export type PlaceBuilding = Type.Static<typeof PlaceBuilding>
export const PlaceBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceBuilding), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PlaceBuildingMetadata), // Always optional, because it is an output
            siteId: Type.String(), // The ID of the building site where the player wants to place a building
            buildingType: Type.Enum(BuildingType) // The type of building the player wants to place
        })
    ])
)

export const PlaceBuildingValidator = Compile(PlaceBuilding)

export function isPlaceBuilding(action?: GameAction): action is PlaceBuilding {
    return action?.type === ActionType.PlaceBuilding
}

export class HydratedPlaceBuilding
    extends HydratableAction<typeof PlaceBuilding>
    implements PlaceBuilding
{
    declare type: ActionType.PlaceBuilding
    declare playerId: string
    declare metadata?: PlaceBuildingMetadata
    declare siteId: string
    declare buildingType: BuildingType

    constructor(data: PlaceBuilding) {
        super(data, PlaceBuildingValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidPlaceBuilding(state)) {
            throw Error('Invalid PlaceBuilding action')
        }

        const building: Building = {
            id: nanoid(),
            type: this.buildingType,
            site: this.siteId
        }

        state.board.addBuilding(building)
        if (state.numSitesRemainingForCurrentPhase() === 0) {
            state.nextBuildingPhase()
        }

        this.metadata = {
            building
        }
    }

    isValidPlaceBuilding(state: HydratedBusGameState): boolean {
        return isSiteId(this.siteId) && !state.board.hasBuildingAt(this.siteId)
    }

    static canPlaceBuilding(state: HydratedBusGameState, playerId: string): boolean {
        return state.currentBuildingPhase < 4 || state.numSitesRemainingForCurrentPhase() > 0
    }
}
