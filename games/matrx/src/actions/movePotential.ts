import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceKind, Unit } from '../model/board.js'

export type MovePotentialMetadata = Type.Static<typeof MovePotentialMetadata>
export const MovePotentialMetadata = Type.Object({
    kind: Type.Enum(PieceKind),
    covered: Type.Optional(Unit)
})

export type MovePotential = Type.Static<typeof MovePotential>
export const MovePotential = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePotential),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(MovePotentialMetadata)
        })
    ])
)

export const MovePotentialValidator = Compile(MovePotential)

export function isMovePotential(action?: GameAction): action is MovePotential {
    return action?.type === ActionType.MovePotential
}

// Rule G2: the top piece of a stack of two potentials on the board moves by its kind's ability.
export class HydratedMovePotential
    extends HydratableAction<typeof MovePotential>
    implements MovePotential
{
    declare type: ActionType.MovePotential
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: MovePotentialMetadata

    constructor(data: MovePotential) {
        super(data, MovePotentialValidator)
    }

    apply(state: HydratedMatrxGameState, _context?: MachineContext) {
        const unit = state.board.topAt(this.from)
        if (unit === undefined || !this.isValid(state)) {
            throw Error('Invalid MovePotential action')
        }
        const kind = unit.kind
        const covered = state.movePotential(this.from, this.to)
        this.metadata = { kind, ...(covered === undefined ? {} : { covered: { ...covered } }) }
    }

    isValid(state: HydratedMatrxGameState): boolean {
        return state
            .potentialMoves(this.playerId)
            .some(
                (move) => sameCoordinates(move.from, this.from) && sameCoordinates(move.to, this.to)
            )
    }
}
