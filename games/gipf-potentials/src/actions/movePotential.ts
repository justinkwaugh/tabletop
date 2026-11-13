import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceKind, PotentialKind, Unit } from '../model/pieces.js'

export type MovePotentialMetadata = Type.Static<typeof MovePotentialMetadata>
export const MovePotentialMetadata = Type.Object({
    kind: PotentialKind,
    covered: Type.Optional(Unit),
    landed: Unit
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
            cover: Type.Optional(Type.Integer({ minimum: 1, maximum: 2 })),
            metadata: Type.Optional(MovePotentialMetadata)
        })
    ])
)

export const MovePotentialValidator = Compile(MovePotential)

export function isMovePotential(action?: GameAction): action is MovePotential {
    return action?.type === ActionType.MovePotential
}

export class HydratedMovePotential
    extends HydratableAction<typeof MovePotential>
    implements MovePotential
{
    declare type: ActionType.MovePotential
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare cover?: number
    declare metadata?: MovePotentialMetadata

    constructor(data: MovePotential) {
        super(data, MovePotentialValidator)
    }

    apply(state: HydratedGipfPotentialsGameState, _context?: MachineContext) {
        const kind = state.board.topAt(this.from)?.load
        if (kind === undefined || !this.isValid(state)) {
            throw Error('Invalid MovePotential action')
        }
        const result = state.movePotential(this.playerId, this.from, this.to, this.cover ?? 0)
        this.metadata = { kind, ...structuredClone(result) }
    }

    isValid(state: HydratedGipfPotentialsGameState): boolean {
        if (!state.isPotentialMove(this.playerId, this.from, this.to)) {
            return false
        }
        const coversGipf = state.board.topAt(this.to)?.kind === PieceKind.Gipf
        if (!coversGipf) {
            return this.cover === undefined
        }
        return this.cover !== undefined && this.cover <= state.getPlayerState(this.playerId).reserve
    }
}
