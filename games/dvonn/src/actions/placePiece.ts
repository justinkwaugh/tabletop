import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSpace } from '../model/geometry.js'
import { isPlayerPiece, Piece, PieceColor } from '../model/board.js'
import { DvonnVersion, versionFromConfig } from '../definition/config.js'

export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
// `passedPlayerId` names White when the last placement leaves them no first move. `color` is the
// placed piece's when the setter of an I set, you choose board places for both.
export const PlacePieceMetadata = Type.Object({
    piece: Piece,
    color: Type.Optional(PieceColor),
    passedPlayerId: Type.Optional(Type.String())
})

export type PlacePiece = Type.Static<typeof PlacePiece>
export const PlacePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePiece),
            playerId: Type.String(),
            coords: AxialCoordinates,
            metadata: Type.Optional(PlacePieceMetadata)
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
    declare metadata?: PlacePieceMetadata

    constructor(data: PlacePiece) {
        super(data, PlacePieceValidator)
    }

    apply(state: HydratedDvonnGameState, context?: MachineContext) {
        assertExists(context, 'A placement is applied by the engine')
        if (!this.isValid(state)) {
            throw Error('Invalid PlacePiece action')
        }
        const color = state.colorToPlace()
        const piece = state.pieceToPlace(this.coords)
        state.board.place(this.coords, piece)
        const placedForEither =
            isPlayerPiece(piece) &&
            versionFromConfig(context.gameConfig) === DvonnVersion.ISetYouChoose
        this.metadata = placedForEither
            ? { piece: structuredClone(piece), color }
            : { piece: structuredClone(piece) }
    }

    isValid(state: HydratedDvonnGameState): boolean {
        return isSpace(this.coords) && !state.board.isOccupied(this.coords)
    }
}
