import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Roof } from '../components/roof.js'

export type PlaceRoof = Type.Static<typeof PlaceRoof>
export const PlaceRoof = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceRoof),
            playerId: Type.String(),
            roof: Roof,
            coords: Type.Optional(OffsetCoordinates)
        })
    ])
)

export const PlaceRoofValidator = Compile(PlaceRoof)

export function isPlaceRoof(action: GameAction): action is PlaceRoof {
    return action.type === ActionType.PlaceRoof
}

export class HydratedPlaceRoof extends HydratableAction<typeof PlaceRoof> implements PlaceRoof {
    declare type: ActionType.PlaceRoof
    declare playerId: string
    declare roof: Roof
    declare coords: OffsetCoordinates

    constructor(data: PlaceRoof) {
        super(data, PlaceRoofValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const board = state.board
        if (!HydratedPlaceRoof.isValidPlacement(state, this.coords)) {
            throw Error(
                `Roof: ${this.roof.value} cannot be placed at ${this.coords.row},${this.coords.col}`
            )
        }
        board.placeRoofAtSite(this.roof, this.coords)
        delete state.chosenPiece
    }

    static isValidPlacement(state: HydratedEstatesGameState, coords: OffsetCoordinates): boolean {
        return state.board.canPlaceRoofAtSite(coords)
    }
}
