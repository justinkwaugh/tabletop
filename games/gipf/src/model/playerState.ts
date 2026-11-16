import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export type GipfPlayerState = Type.Static<typeof GipfPlayerState>
export const GipfPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            reserve: Type.Integer({ minimum: 0 }),
            captured: Type.Integer({ minimum: 0 }),
            playedSingle: Type.Boolean()
        })
    ])
)

export const GipfPlayerStateValidator = Compile(GipfPlayerState)

export class HydratedGipfPlayerState
    extends Hydratable<typeof GipfPlayerState>
    implements GipfPlayerState
{
    declare playerId: string
    declare color: Color
    declare reserve: number
    declare captured: number
    declare playedSingle: boolean

    constructor(data: GipfPlayerState) {
        super(data, GipfPlayerStateValidator)
    }
}
