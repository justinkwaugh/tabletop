import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Compile } from 'typebox/compile'

export type HexPlayerState = PlayerState
export const HexPlayerState = PlayerState

export const HexPlayerStateValidator = Compile(HexPlayerState)

export class HydratedHexPlayerState
    extends Hydratable<typeof HexPlayerState>
    implements HexPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: HexPlayerState) {
        super(data, HexPlayerStateValidator)
    }
}
