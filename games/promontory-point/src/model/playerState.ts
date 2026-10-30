import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export type PromontoryPointPlayerState = Type.Static<typeof PromontoryPointPlayerState>
export const PromontoryPointPlayerState = Type.Evaluate(
    Type.Intersect([PlayerState, Type.Object({})])
)

export const PromontoryPointPlayerStateValidator = Compile(PromontoryPointPlayerState)

export class HydratedPromontoryPointPlayerState
    extends Hydratable<typeof PromontoryPointPlayerState>
    implements PromontoryPointPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: PromontoryPointPlayerState) {
        super(data, PromontoryPointPlayerStateValidator)
    }
}
