import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedPunctGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceKind } from '../model/pieces.js'

export type MovePieceMetadata = Type.Static<typeof MovePieceMetadata>
// `passedPlayerId` names a player whose turn this move's end skipped, as they could not act.
export const MovePieceMetadata = Type.Object({
    pieceId: Type.Integer({ minimum: 0 }),
    kind: Type.Enum(PieceKind),
    fromLevel: Type.Integer({ minimum: 0 }),
    level: Type.Integer({ minimum: 0 }),
    passedPlayerId: Type.Optional(Type.String())
})

export type MovePiece = Type.Static<typeof MovePiece>
export const MovePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePiece),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            rotation: Type.Integer({ minimum: 0, maximum: 5 }),
            metadata: Type.Optional(MovePieceMetadata)
        })
    ])
)

export const MovePieceValidator = Compile(MovePiece)

export function isMovePiece(action?: GameAction): action is MovePiece {
    return action?.type === ActionType.MovePiece
}

// Rules B2/2 and B3: a piece in play moves its PÜNCT in a straight line, may turn about it, and
// may land on top of pieces with its PÜNCT on one of the player's own.
export class HydratedMovePiece extends HydratableAction<typeof MovePiece> implements MovePiece {
    declare type: ActionType.MovePiece
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare rotation: number
    declare metadata?: MovePieceMetadata

    constructor(data: MovePiece) {
        super(data, MovePieceValidator)
    }

    apply(state: HydratedPunctGameState, _context?: MachineContext) {
        const piece = state.pieceWithPunctAt(this.playerId, this.from)
        const placement = state.moveFor(this.playerId, this.from, this.to, this.rotation)
        if (piece === undefined || placement === undefined) {
            throw Error('Invalid MovePiece action')
        }
        const fromLevel = piece.level
        state.movePiece(piece, placement)
        this.metadata = { pieceId: piece.id, kind: piece.kind, fromLevel, level: placement.level }
    }
}
