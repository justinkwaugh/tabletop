import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { PieceColor, Stack } from './pieces.js'

export type LyngkPlayerState = Type.Static<typeof LyngkPlayerState>
export const LyngkPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            claimed: Type.Array(Type.Enum(PieceColor)),
            scored: Type.Array(Stack)
        })
    ])
)

export const LyngkPlayerStateValidator = Compile(LyngkPlayerState)

export const CLAIMS_PER_PLAYER = 2

export class HydratedLyngkPlayerState
    extends Hydratable<typeof LyngkPlayerState>
    implements LyngkPlayerState
{
    declare playerId: string
    declare color: Color
    declare claimed: PieceColor[]
    declare scored: PieceColor[][]

    constructor(data: LyngkPlayerState) {
        super(data, LyngkPlayerStateValidator)
    }

    hasClaimsLeft(): boolean {
        return this.claimed.length < CLAIMS_PER_PLAYER
    }
}
