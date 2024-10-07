import { Type, type Static } from '@sinclair/typebox'
import { GameAction, HydratableAction } from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionType } from '../definition/actions.js'
import { isBarrier, isCancelCube, isMayor, Piece } from '../components/pieces.js'

export type DiscardPiece = Static<typeof DiscardPiece>
export const DiscardPiece = Type.Composite([
    Type.Omit(GameAction, ['playerId', 'type']),
    Type.Object({
        type: Type.Literal(ActionType.DiscardPiece),
        playerId: Type.String(),
        piece: Piece
    })
])

export const DiscardPieceValidator = TypeCompiler.Compile(DiscardPiece)

export function isDiscardPiece(action: GameAction): action is DiscardPiece {
    return action.type === ActionType.DiscardPiece
}

export class HydratedDiscardPiece
    extends HydratableAction<typeof DiscardPiece>
    implements DiscardPiece
{
    declare type: ActionType.DiscardPiece
    declare playerId: string
    declare piece: Piece

    constructor(data: DiscardPiece) {
        super(data, DiscardPieceValidator)
    }

    apply(state: HydratedEstatesGameState) {
        if (!HydratedDiscardPiece.isValidDiscard(this.piece)) {
            throw Error(`Piece: ${this.piece} cannot be discarded`)
        }
        state.chosenPiece = undefined
    }

    static isValidDiscard(piece: Piece) {
        return isBarrier(piece) || isMayor(piece) || isCancelCube(piece)
    }
}
