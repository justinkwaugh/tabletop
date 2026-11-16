import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PushPieceMetadata = Type.Static<typeof PushPieceMetadata>
export const PushPieceMetadata = Type.Object({
    line: Type.Array(AxialCoordinates),
    shifted: Type.Integer({ minimum: 0 })
})

export type PushPiece = Type.Static<typeof PushPiece>
export const PushPiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PushPiece),
            playerId: Type.String(),
            dot: AxialCoordinates,
            to: AxialCoordinates,
            gipf: Type.Boolean(),
            metadata: Type.Optional(PushPieceMetadata)
        })
    ])
)

export const PushPieceValidator = Compile(PushPiece)

export function isPushPiece(action?: GameAction): action is PushPiece {
    return action?.type === ActionType.PushPiece
}

export class HydratedPushPiece extends HydratableAction<typeof PushPiece> implements PushPiece {
    declare type: ActionType.PushPiece
    declare playerId: string
    declare dot: AxialCoordinates
    declare to: AxialCoordinates
    declare gipf: boolean
    declare metadata?: PushPieceMetadata

    constructor(data: PushPiece) {
        super(data, PushPieceValidator)
    }

    apply(state: HydratedGipfGameState, _context?: MachineContext) {
        const entry = state.board.findEntry(this.dot, this.to)
        if (entry === undefined || !this.isValid(state)) {
            throw Error('Invalid PushPiece action')
        }
        const shifted = entry.line.findIndex((coords) => state.board.pieceAt(coords) === undefined)
        state.pushPiece(this.playerId, this.dot, this.to, this.gipf)
        this.metadata = { line: structuredClone(entry.line), shifted }
    }

    isValid(state: HydratedGipfGameState): boolean {
        const entry = state.board.findEntry(this.dot, this.to)
        const canPlay = this.gipf
            ? state.canPlayGipf(this.playerId)
            : state.canPlaySingle(this.playerId)
        return entry !== undefined && canPlay && state.board.canPush(entry)
    }
}
