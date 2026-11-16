import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSpace } from '../model/geometry.js'
import { PieceKind } from '../model/board.js'
import { stuckPlayerAtOpening } from '../stateHandlers/turnFlow.js'

// `stuckPlayerId` names White when the last placement leaves them no opening capture.
export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    stuckPlayerId: Type.Optional(Type.String())
})

export type PlacePiece = Type.Static<typeof PlacePiece>
export const PlacePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePiece),
            playerId: Type.String(),
            coords: AxialCoordinates,
            kind: Type.Enum(PieceKind),
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
    declare kind: PieceKind
    declare metadata?: PlacePieceMetadata

    constructor(data: PlacePiece) {
        super(data, PlacePieceValidator)
    }

    apply(state: HydratedTzaarGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlacePiece action')
        }
        state.board.place(this.coords, state.pieceToPlace(this.playerId, this.kind))
        const metadata: PlacePieceMetadata = {}
        if (state.board.isFull()) {
            const stuckPlayerId = stuckPlayerAtOpening(state)
            if (stuckPlayerId !== undefined) {
                metadata.stuckPlayerId = stuckPlayerId
            }
        }
        this.metadata = metadata
    }

    isValid(state: HydratedTzaarGameState): boolean {
        return (
            isSpace(this.coords) &&
            !state.board.isOccupied(this.coords) &&
            state.piecesInHand(this.playerId, this.kind) > 0
        )
    }
}
