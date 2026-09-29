import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RoadEnds } from '../components/pieces.js'
import { OracleChange } from '../model/board.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'

export type PlaceRoadMetadata = Type.Static<typeof PlaceRoadMetadata>
export const PlaceRoadMetadata = Type.Object({
    oracleChanges: Type.Array(OracleChange)
})

export type PlaceRoad = Type.Static<typeof PlaceRoad>
export const PlaceRoad = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceRoad),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceRoadMetadata),
            coords: AxialCoordinates,
            ends: RoadEnds
        })
    ])
)

export const PlaceRoadValidator = Compile(PlaceRoad)

export function isPlaceRoad(action?: GameAction): action is PlaceRoad {
    return action?.type === ActionType.PlaceRoad
}

export class HydratedPlaceRoad extends HydratableAction<typeof PlaceRoad> implements PlaceRoad {
    declare type: ActionType.PlaceRoad
    declare playerId: string
    declare metadata?: PlaceRoadMetadata
    declare coords: AxialCoordinates
    declare ends: RoadEnds

    constructor(data: PlaceRoad) {
        super(data, PlaceRoadValidator)
    }

    apply(state: HydratedMagnaGreciaGameState, _context?: MachineContext) {
        if (!state.canPlaceRoad(this.playerId, this.coords, this.ends)) {
            throw Error('Invalid PlaceRoad action')
        }
        state.board.addRoad({ playerId: this.playerId, coords: this.coords, ends: this.ends })
        state.getPlayerState(this.playerId).supplyRoads -= 1
        state.activeTurn(this.playerId).roadsPlaced += 1
        this.metadata = {
            oracleChanges: state.board.updateOracleAttention(state.board.network())
        }
    }

    static canPlaceRoad(state: HydratedMagnaGreciaGameState, playerId: string): boolean {
        return state.roadPlacementsRemaining(playerId) > 0
    }
}
