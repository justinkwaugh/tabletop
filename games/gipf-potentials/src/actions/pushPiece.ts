import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceKind, PotentialCounts } from '../model/pieces.js'

// The line a push moved, how many stacks it shifted on, whose TAMSK-loaded piece it put on the
// centre, and the potentials a plain piece left unplayed.
export type PushMetadata = Type.Static<typeof PushMetadata>
export const PushMetadata = Type.Object({
    line: Type.Array(AxialCoordinates),
    shifted: Type.Integer({ minimum: 0 }),
    tamskOwnerId: Type.Optional(Type.String()),
    forfeited: Type.Optional(PotentialCounts)
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
            kind: Type.Enum(PieceKind),
            metadata: Type.Optional(PushMetadata)
        })
    ])
)

export const PushPieceValidator = Compile(PushPiece)

export function isPushPiece(action?: GameAction): action is PushPiece {
    return action?.type === ActionType.PushPiece
}

// Brings a piece from the reserve, loaded, plain or doubled as a GIPF-piece: onto a dot, then
// pushed in.
export class HydratedPushPiece extends HydratableAction<typeof PushPiece> implements PushPiece {
    declare type: ActionType.PushPiece
    declare playerId: string
    declare dot: AxialCoordinates
    declare to: AxialCoordinates
    declare kind: PieceKind
    declare metadata?: PushMetadata

    constructor(data: PushPiece) {
        super(data, PushPieceValidator)
    }

    apply(state: HydratedGipfPotentialsGameState, _context?: MachineContext) {
        const entry = state.board.findEntry(this.dot, this.to)
        if (entry === undefined || !this.isValid(state)) {
            throw Error('Invalid PushPiece action')
        }
        const shifted = state.board.shiftedBy(entry)
        const result = state.pushPiece(this.playerId, entry, this.kind)
        this.metadata = { line: structuredClone(entry.line), shifted, ...result }
    }

    isValid(state: HydratedGipfPotentialsGameState): boolean {
        const entry = state.board.findEntry(this.dot, this.to)
        return (
            entry !== undefined &&
            state.board.canPush(entry) &&
            state.pushableKinds(this.playerId).includes(this.kind)
        )
    }
}
