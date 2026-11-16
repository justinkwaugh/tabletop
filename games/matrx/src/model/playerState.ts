import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { PAIR_SIZE, PieceKind, type PotentialKind } from './board.js'

// Single potentials in reserve; any two of a kind make a stack (rule G6).
export type Potentials = Type.Static<typeof Potentials>
export const Potentials = Type.Object({
    [PieceKind.Tamsk]: Type.Integer({ minimum: 0 }),
    [PieceKind.Zertz]: Type.Integer({ minimum: 0 }),
    [PieceKind.Dvonn]: Type.Integer({ minimum: 0 }),
    [PieceKind.Yinsh]: Type.Integer({ minimum: 0 }),
    [PieceKind.Punct]: Type.Integer({ minimum: 0 })
})

export type Captured = Type.Static<typeof Captured>
export const Captured = Type.Object({
    [PieceKind.Gipf]: Type.Integer({ minimum: 0 }),
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
            captured: Captured
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
    declare captured: Captured

    constructor(data: MatrxPlayerState) {
        super(data, MatrxPlayerStateValidator)
    }

    capturedCount(): number {
        return Object.values(this.captured).reduce((sum, count) => sum + count, 0)
    }

    stacksOf(kind: PotentialKind): number {
        return Math.floor(this.potentials[kind] / PAIR_SIZE)
    }
}
