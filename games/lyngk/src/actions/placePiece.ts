import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedLyngkGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceColor } from '../model/pieces.js'

// A piece of `color` put on an empty point while the players set the board.
export type PlacePiece = Type.Static<typeof PlacePiece>
export const PlacePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePiece),
            playerId: Type.String(),
            coords: AxialCoordinates,
            color: Type.Enum(PieceColor)
        })
    ])
)

export const PlacePieceValidator = Compile(PlacePiece)

export function isPlacePiece(action?: GameAction): action is PlacePiece {
    return action?.type === ActionType.PlacePiece
}

export class HydratedPlacePiece extends HydratableAction<typeof PlacePiece> implements PlacePiece {
    declare type: ActionType.PlacePiece
    declare playerId: string
    declare coords: AxialCoordinates
    declare color: PieceColor

    constructor(data: PlacePiece) {
        super(data, PlacePieceValidator)
    }

    apply(state: HydratedLyngkGameState, _context?: MachineContext) {
        const [piece] = state.piecesLeft(this.color)
        if (piece === undefined || !this.isValid(state)) {
            throw Error('Invalid PlacePiece action')
        }
        state.board.drop(this.coords, [piece])
    }

    isValid(state: HydratedLyngkGameState): boolean {
        return state.board.vacantPoints().some((coords) => sameCoordinates(coords, this.coords))
    }
}
