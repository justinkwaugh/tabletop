import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Compile } from 'typebox/compile'

export type PunctPlayerState = PlayerState
export const PunctPlayerState = PlayerState

export const PunctPlayerStateValidator = Compile(PunctPlayerState)

export class HydratedPunctPlayerState
    extends Hydratable<typeof PunctPlayerState>
    implements PunctPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: PunctPlayerState) {
        super(data, PunctPlayerStateValidator)
    }
}
