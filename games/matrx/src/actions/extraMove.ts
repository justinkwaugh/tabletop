import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PushMetadata } from './pushPiece.js'

export type ExtraMove = Type.Static<typeof ExtraMove>
export const ExtraMove = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExtraMove),
            playerId: Type.String(),
            dot: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(PushMetadata)
        })
    ])
)

export const ExtraMoveValidator = Compile(ExtraMove)

export function isExtraMove(action?: GameAction): action is ExtraMove {
    return action?.type === ActionType.ExtraMove
}

// Rule H1: the top piece of the TAMSK stack on the centre goes onto a dot and is pushed in.
export class HydratedExtraMove extends HydratableAction<typeof ExtraMove> implements ExtraMove {
    declare type: ActionType.ExtraMove
    declare playerId: string
    declare dot: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: PushMetadata

    constructor(data: ExtraMove) {
        super(data, ExtraMoveValidator)
    }

    apply(state: HydratedMatrxGameState, _context?: MachineContext) {
        const entry = state.board.findEntry(this.dot, this.to)
        if (entry === undefined || !this.isValid(state)) {
            throw Error('Invalid ExtraMove action')
        }
        const shifted = state.board.shiftedBy(entry)
        const tamskOwnerId = state.pushTamsk(entry)
        this.metadata = {
            line: structuredClone(entry.line),
            shifted,
            ...(tamskOwnerId === undefined ? {} : { tamskOwnerId })
        }
    }

    isValid(state: HydratedMatrxGameState): boolean {
        const entry = state.board.findEntry(this.dot, this.to)
        return (
            entry !== undefined &&
            state.board.canPush(entry) &&
            state.ownTamskOnCentre(this.playerId)
        )
    }
}
