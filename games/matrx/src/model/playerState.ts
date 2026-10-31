import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { PieceKind, type PotentialKind } from './board.js'

// Single potentials in reserve, by kind; two of a kind make a stack that can be brought in.
export type Potentials = Type.Static<typeof Potentials>
export const Potentials = Type.Object({
    [PieceKind.Tamsk]: Type.Integer({ minimum: 0 }),
    [PieceKind.Zertz]: Type.Integer({ minimum: 0 }),
    [PieceKind.Dvonn]: Type.Integer({ minimum: 0 }),
    [PieceKind.Yinsh]: Type.Integer({ minimum: 0 }),
    [PieceKind.Punct]: Type.Integer({ minimum: 0 })
})

export type MatrxPlayerState = Type.Static<typeof MatrxPlayerState>
export const MatrxPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            gipfPieces: Type.Integer({ minimum: 0 }),
            potentials: Potentials,
            // The opponent's pieces taken, one per disc, in the order they were taken.
            captured: Type.Array(Type.Enum(PieceKind))
        })
    ])
)

export const MatrxPlayerStateValidator = Compile(MatrxPlayerState)

export class HydratedMatrxPlayerState
    extends Hydratable<typeof MatrxPlayerState>
    implements MatrxPlayerState
{
    declare playerId: string
    declare color: Color
    declare gipfPieces: number
    declare potentials: Potentials
    declare captured: PieceKind[]

    constructor(data: MatrxPlayerState) {
        super(data, MatrxPlayerStateValidator)
    }

    stacksOf(kind: PotentialKind): number {
        return Math.floor(this.potentials[kind] / 2)
    }
}
