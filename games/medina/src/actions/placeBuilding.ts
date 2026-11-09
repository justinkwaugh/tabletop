import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Point, samePoint } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { PalaceColor } from '../components/pieces.js'
import type { HydratedMedinaGameState } from '../model/gameState.js'

export type PlaceBuildingMetadata = Type.Static<typeof PlaceBuildingMetadata>
export const PlaceBuildingMetadata = Type.Object({
    palaceId: Type.String(),
    startedPalace: Type.Boolean()
})

export type PlaceBuilding = Type.Static<typeof PlaceBuilding>
export const PlaceBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBuilding),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceBuildingMetadata),
            color: Type.Enum(PalaceColor),
            coords: Point
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
    declare color: PalaceColor
    declare coords: Point

    constructor(data: PlaceBuilding) {
        super(data, PlaceBuildingValidator)
    }

    apply(state: HydratedMedinaGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            player.buildingStock()[this.color] <= 0 ||
            !state.buildingSpaces(this.color).some((space) => samePoint(space, this.coords))
        ) {
            throw Error('Invalid PlaceBuilding action')
        }
        const joined = state.palaceJoinedBy(this.coords, this.color)
        const palaceId = joined?.id ?? `palace-${state.palaces.length + 1}`
        if (!joined) {
            state.palaces.push({ id: palaceId, color: this.color })
        }
        state.buildings.push({ coords: this.coords, palaceId })
        player.buildingStock()[this.color] -= 1
        this.metadata = { palaceId, startedPalace: !joined }
    }
}
