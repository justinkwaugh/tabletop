import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BuildingType } from '../components/building.js'
import { getValidPlacementsForType, hasAnyValidPlacement } from '../logic/board.js'

export type PlaceBuildingMetadata = Type.Static<typeof PlaceBuildingMetadata>
export const PlaceBuildingMetadata = Type.Object({})

export type PlaceBuilding = Type.Static<typeof PlaceBuilding>
export const PlaceBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBuilding),
            playerId: Type.String(),
            position: Type.Number(),
            buildingType: Type.Enum(BuildingType),
            metadata: Type.Optional(PlaceBuildingMetadata),
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
    declare position: number
    declare buildingType: BuildingType
    declare metadata?: PlaceBuildingMetadata

    constructor(data: PlaceBuilding) {
        super(data, PlaceBuildingValidator)
    }

    apply(state: HydratedUrbinoGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceBuilding action')
        }
        state.board[this.position] = { playerId: this.playerId, buildingType: this.buildingType }
        const player = state.getPlayerState(this.playerId)
        switch (this.buildingType) {
            case BuildingType.House:
                player.houses--
                break
            case BuildingType.Palace:
                player.palaces--
                break
            case BuildingType.Tower:
                player.towers--
                break
        }
        state.consecutivePasses = 0
        state.hasRepositionedThisTurn = false
        this.metadata = {}
    }

    isValid(state: HydratedUrbinoGameState): boolean {
        const player = state.getPlayerState(this.playerId)
        const count =
            this.buildingType === BuildingType.House
                ? player.houses
                : this.buildingType === BuildingType.Palace
                  ? player.palaces
                  : player.towers
        if (count <= 0) return false
        const validSquares = getValidPlacementsForType(
            state.board,
            state.architects,
            this.playerId,
            this.buildingType,
            state.monumentsVariant
        )
        return validSquares.includes(this.position)
    }

    static canPlace(state: HydratedUrbinoGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return hasAnyValidPlacement(
            state.board,
            state.architects,
            playerId,
            player.remainingBuildings,
            state.monumentsVariant
        )
    }
}
