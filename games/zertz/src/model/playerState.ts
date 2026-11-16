import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MarbleCounts, MarbleColor, hasAnyMarble } from './marbles.js'

export type ZertzPlayerState = Type.Static<typeof ZertzPlayerState>
export const ZertzPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            captured: MarbleCounts
        })
    ])
)

export const ZertzPlayerStateValidator = Compile(ZertzPlayerState)

export class HydratedZertzPlayerState
    extends Hydratable<typeof ZertzPlayerState>
    implements ZertzPlayerState
{
    declare playerId: string
    declare color: Color
    declare captured: MarbleCounts

    constructor(data: ZertzPlayerState) {
        super(data, ZertzPlayerStateValidator)
    }

    capture(color: MarbleColor, count: number = 1) {
        this.captured[color] += count
    }

    hasCapturedMarbles(): boolean {
        return hasAnyMarble(this.captured)
    }
}
