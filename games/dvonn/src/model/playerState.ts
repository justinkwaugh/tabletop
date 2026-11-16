import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Compile } from 'typebox/compile'

export type DvonnPlayerState = PlayerState
export const DvonnPlayerState = PlayerState

export const DvonnPlayerStateValidator = Compile(DvonnPlayerState)

export class HydratedDvonnPlayerState
    extends Hydratable<typeof DvonnPlayerState>
    implements DvonnPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: DvonnPlayerState) {
        super(data, DvonnPlayerStateValidator)
    }
}
