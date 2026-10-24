import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedDvonnGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSpace } from '../model/geometry.js'
import { Piece } from '../model/board.js'
import { firstMovingTurn } from '../stateHandlers/turnFlow.js'

export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    piece: Piece,
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

    apply(state: HydratedDvonnGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlacePiece action')
        }
        const piece = state.pieceToPlace(this.playerId, this.coords)
        state.board.place(this.coords, piece)
        this.metadata = { piece: structuredClone(piece) }
        if (state.board.isFull()) {
            const passedPlayerId = firstMovingTurn(state).passedPlayerId
            if (passedPlayerId !== undefined) {
                this.metadata.passedPlayerId = passedPlayerId
            }
        }
    }

    isValid(state: HydratedDvonnGameState): boolean {
        return isSpace(this.coords) && !state.board.isOccupied(this.coords)
    }
}
