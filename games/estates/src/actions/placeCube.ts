import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Cube } from '../components/cube.js'

export type PlaceCube = Type.Static<typeof PlaceCube>
export const PlaceCube = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceCube),
            playerId: Type.String(),
            cube: Cube,
            coords: Type.Optional(OffsetCoordinates)
        })
    ])
)

export const PlaceCubeValidator = Compile(PlaceCube)

export function isPlaceCube(action: GameAction): action is PlaceCube {
    return action.type === ActionType.PlaceCube
}

export class HydratedPlaceCube extends HydratableAction<typeof PlaceCube> implements PlaceCube {
    declare type: ActionType.PlaceCube
    declare playerId: string
    declare cube: Cube
    declare coords: OffsetCoordinates

    constructor(data: PlaceCube) {
        super(data, PlaceCubeValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const board = state.board
        if (!HydratedPlaceCube.isValidPlacement(state, this.coords, this.cube)) {
            throw Error(
                `Cube: ${this.cube.value} cannot be placed at ${this.coords.row},${this.coords.col}`
            )
        }
        board.placeCubeAtSite(this.cube, this.coords)
        delete state.chosenPiece
    }

    static isValidPlacement(
        state: HydratedEstatesGameState,
        coords: OffsetCoordinates,
        cube: Cube
    ): boolean {
        return state.board.canPlaceCubeAtCoords(cube, coords)
    }
}
