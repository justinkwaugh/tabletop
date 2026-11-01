import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type FeudumPlayerState = Type.Static<typeof FeudumPlayerState>
export const FeudumPlayerState = Type.Evaluate(Type.Intersect([PlayerState, Type.Object({})]))

export const FeudumPlayerStateValidator = Compile(FeudumPlayerState)

export class HydratedFeudumPlayerState
    extends Hydratable<typeof FeudumPlayerState>
    implements FeudumPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: FeudumPlayerState) {
        super(data, FeudumPlayerStateValidator)
    }
}
