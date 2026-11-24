import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isSpace } from '../model/geometry.js'
import { PieceColor, PieceKind } from '../model/board.js'
import { stuckPlayerAtOpening } from '../stateHandlers/turnFlow.js'
import { TzaarVersion, versionFromConfig } from '../definition/config.js'

// `stuckPlayerId` names White when the last placement leaves them no opening capture. `color` is
// the placed piece's when the setter of an I set, you choose board places for both.
export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    color: Type.Optional(PieceColor),
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

    apply(state: HydratedTzaarGameState, context?: MachineContext) {
        assertExists(context, 'A placement is applied by the engine')
        if (!this.isValid(state)) {
            throw Error('Invalid PlacePiece action')
        }
        const color = state.colorToPlace()
        state.board.place(this.coords, state.pieceToPlace(this.kind))
        this.metadata =
            versionFromConfig(context.gameConfig) === TzaarVersion.ISetYouChoose
                ? { color }
                : this.openingOutcome(state)
    }

    private openingOutcome(state: HydratedTzaarGameState): PlacePieceMetadata {
        const stuckPlayerId = state.board.isFull() ? stuckPlayerAtOpening(state) : undefined
        return stuckPlayerId === undefined ? {} : { stuckPlayerId }
    }

    isValid(state: HydratedTzaarGameState): boolean {
        return (
            isSpace(this.coords) &&
            !state.board.isOccupied(this.coords) &&
            state.piecesInHand(state.ownerOfNextPiece(), this.kind) > 0
        )
    }
}
