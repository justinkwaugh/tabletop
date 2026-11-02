import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { PIECE_KINDS, PieceKind } from './pieces.js'

// The pieces a player has yet to bring into play, by kind.
export type Reserve = Type.Static<typeof Reserve>
export const Reserve = Type.Object({
    [PieceKind.Triangle]: Type.Integer({ minimum: 0 }),
    [PieceKind.StraightEnd]: Type.Integer({ minimum: 0 }),
    [PieceKind.StraightCentre]: Type.Integer({ minimum: 0 }),
    [PieceKind.AngleCorner]: Type.Integer({ minimum: 0 }),
    [PieceKind.AngleLeft]: Type.Integer({ minimum: 0 }),
    [PieceKind.AngleRight]: Type.Integer({ minimum: 0 })
})

export type PunctPlayerState = Type.Static<typeof PunctPlayerState>
export const PunctPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            reserve: Reserve
        })
    ])
)

export const PunctPlayerStateValidator = Compile(PunctPlayerState)

export class HydratedPunctPlayerState
    extends Hydratable<typeof PunctPlayerState>
    implements PunctPlayerState
{
    declare playerId: string
    declare color: Color
    declare reserve: Reserve

    constructor(data: PunctPlayerState) {
        super(data, PunctPlayerStateValidator)
    }

    reserveSize(): number {
        return PIECE_KINDS.reduce((total, kind) => total + this.reserve[kind], 0)
    }

    kindsInReserve(): PieceKind[] {
        return PIECE_KINDS.filter((kind) => this.reserve[kind] > 0)
    }
}
