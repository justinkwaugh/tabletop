import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type IndonesiaPlayerState = Type.Static<typeof IndonesiaPlayerState>
export const IndonesiaPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({

        })
    ])
)

export const IndonesiaPlayerStateValidator = Compile(IndonesiaPlayerState)

export class HydratedIndonesiaPlayerState
    extends Hydratable<typeof IndonesiaPlayerState>
    implements IndonesiaPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: IndonesiaPlayerState) {
        super(data, IndonesiaPlayerStateValidator)
    }
}
