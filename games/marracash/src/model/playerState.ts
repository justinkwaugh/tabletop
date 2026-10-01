import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type MarracashPlayerState = Type.Static<typeof MarracashPlayerState>
export const MarracashPlayerState = Type.Evaluate(Type.Intersect([PlayerState, Type.Object({})]))

export const MarracashPlayerStateValidator = Compile(MarracashPlayerState)

export class HydratedMarracashPlayerState
    extends Hydratable<typeof MarracashPlayerState>
    implements MarracashPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: MarracashPlayerState) {
        super(data, MarracashPlayerStateValidator)
    }
}
