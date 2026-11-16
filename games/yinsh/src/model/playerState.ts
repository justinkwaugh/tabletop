import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export type YinshPlayerState = Type.Static<typeof YinshPlayerState>
export const YinshPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            // The ids of the rings the player has removed, in the order they came off.
            removedRingIds: Type.Array(Type.Integer({ minimum: 0 }))
        })
    ])
)

export const YinshPlayerStateValidator = Compile(YinshPlayerState)

export class HydratedYinshPlayerState
    extends Hydratable<typeof YinshPlayerState>
    implements YinshPlayerState
{
    declare playerId: string
    declare color: Color
    declare removedRingIds: number[]

    constructor(data: YinshPlayerState) {
        super(data, YinshPlayerStateValidator)
    }

    get ringsRemoved(): number {
        return this.removedRingIds.length
    }
}
