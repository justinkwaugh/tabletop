import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Compile } from 'typebox/compile'

export type TzaarPlayerState = PlayerState
export const TzaarPlayerState = PlayerState

export const TzaarPlayerStateValidator = Compile(TzaarPlayerState)

export class HydratedTzaarPlayerState
    extends Hydratable<typeof TzaarPlayerState>
    implements TzaarPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: TzaarPlayerState) {
        super(data, TzaarPlayerStateValidator)
    }
}
