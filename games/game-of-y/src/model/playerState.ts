import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { StoneColor } from './board.js'

// A player plays the stones of one colour, Black or White.
export type YPlayerState = Type.Static<typeof YPlayerState>
export const YPlayerState = Type.Evaluate(
    Type.Intersect([Type.Omit(PlayerState, ['color']), Type.Object({ color: StoneColor })])
)

export const YPlayerStateValidator = Compile(YPlayerState)

export class HydratedYPlayerState extends Hydratable<typeof YPlayerState> implements YPlayerState {
    declare playerId: string
    declare color: StoneColor

    constructor(data: YPlayerState) {
        super(data, YPlayerStateValidator)
    }
}
