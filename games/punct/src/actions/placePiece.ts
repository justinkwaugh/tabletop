import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedPunctGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceKind } from '../model/pieces.js'
import { outcomeAfter } from '../stateHandlers/turnFlow.js'

export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    pieceId: Type.Integer({ minimum: 0 }),
    passedPlayerId: Type.Optional(Type.String())
})

export type PlacePiece = Type.Static<typeof PlacePiece>
export const PlacePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePiece),
            playerId: Type.String(),
            kind: Type.Enum(PieceKind),
            punct: AxialCoordinates,
            rotation: Type.Integer({ minimum: 0, maximum: 5 }),
            metadata: Type.Optional(PlacePieceMetadata)
        })
    ])
)

export const PlacePieceValidator = Compile(PlacePiece)

export function isPlacePiece(action?: GameAction): action is PlacePiece {
    return action?.type === ActionType.PlacePiece
}

// Rule B1/1: a piece from the player's set goes onto three empty spaces of the board.
export class HydratedPlacePiece extends HydratableAction<typeof PlacePiece> implements PlacePiece {
    declare type: ActionType.PlacePiece
    declare playerId: string
    declare kind: PieceKind
    declare punct: AxialCoordinates
    declare rotation: number
    declare metadata?: PlacePieceMetadata

    constructor(data: PlacePiece) {
        super(data, PlacePieceValidator)
    }

    apply(state: HydratedPunctGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlacePiece action')
        }
        const piece = state.placePiece(this.playerId, this.kind, this.punct, this.rotation)
        const outcome = outcomeAfter(state, this.playerId, true)
        this.metadata = {
            pieceId: piece.id,
            ...(outcome.kind === 'next' && outcome.passedPlayerId !== undefined
                ? { passedPlayerId: outcome.passedPlayerId }
                : {})
        }
    }

    isValid(state: HydratedPunctGameState): boolean {
        return state.canEnter(this.playerId, this.kind, this.punct, this.rotation)
    }
}
