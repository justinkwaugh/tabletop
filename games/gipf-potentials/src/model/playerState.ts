import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { PieceKind, PotentialCounts } from './pieces.js'

export type GipfPotentialsPlayerState = Type.Static<typeof GipfPotentialsPlayerState>
export const GipfPotentialsPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            // Basic pieces in reserve.
            reserve: Type.Integer({ minimum: 0 }),
            // Potentials still to be loaded onto pieces from the reserve.
            potentials: PotentialCounts,
            // The opponent's pieces taken, one per disc, in the order they were taken.
            captured: Type.Array(Type.Enum(PieceKind)),
            // Tournament: GIPF-pieces only until the first other piece.
            playedOther: Type.Boolean()
        })
    ])
)

export const GipfPotentialsPlayerStateValidator = Compile(GipfPotentialsPlayerState)

export class HydratedGipfPotentialsPlayerState
    extends Hydratable<typeof GipfPotentialsPlayerState>
    implements GipfPotentialsPlayerState
{
    declare playerId: string
    declare color: Color
    declare reserve: number
    declare potentials: PotentialCounts
    declare captured: PieceKind[]
    declare playedOther: boolean

    constructor(data: GipfPotentialsPlayerState) {
        super(data, GipfPotentialsPlayerStateValidator)
    }

    potentialsInHand(): number {
        return Object.values(this.potentials).reduce((sum, count) => sum + count, 0)
    }
}
